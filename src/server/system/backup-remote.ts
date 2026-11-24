import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

/**
 * Off-site copies of backups in Azure Blob Storage: the same storage account as the media library (or another
 * one), but always a separate **private** container, because a backup holds the whole database. Each backup is
 * stored as <prefix><name> with its details beside it as <prefix><name>.info.json. Large files are uploaded in
 * 8 MB blocks and downloaded as a stream, so a backup of any size never has to fit in memory.
 */
export interface AzureTarget { account: string; key: string; container: string; prefix: string }

const API_VERSION = "2023-11-03";
const BLOCK = 8 * 1024 * 1024;

export class BackupStorageError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "BackupStorageError";
  }
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
const xmlDecode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function request(
  t: AzureTarget,
  method: "GET" | "PUT" | "DELETE",
  path: string,
  opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: Buffer | string; allow404?: boolean } = {},
) {
  const endpoint = `https://${t.account}.blob.core.windows.net`;
  const query = opts.query ?? {};
  const url = new URL(endpoint + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const body = typeof opts.body === "string" ? Buffer.from(opts.body, "utf8") : opts.body;
  const headers: Record<string, string> = { "x-ms-date": new Date().toUTCString(), "x-ms-version": API_VERSION, ...opts.headers };
  const length = body?.byteLength ?? 0;
  const canonicalHeaders = Object.entries(headers)
    .filter(([k]) => k.toLowerCase().startsWith("x-ms-"))
    .map(([k, v]) => [k.toLowerCase(), v.trim()] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}:${v}\n`)
    .join("");
  const canonicalResource = `/${t.account}${url.pathname}` + Object.keys(query).map((k) => k.toLowerCase()).sort().map((k) => `\n${k}:${query[k]}`).join("");
  const stringToSign = [method, "", "", length ? String(length) : "", "", headers["Content-Type"] ?? "", "", "", "", "", "", ""].join("\n") + "\n" + canonicalHeaders + canonicalResource;
  headers.Authorization = `SharedKey ${t.account}:${createHmac("sha256", Buffer.from(t.key, "base64")).update(stringToSign, "utf8").digest("base64")}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body ? new Uint8Array(body) : undefined, cache: "no-store" });
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause?.code;
    if (cause === "ENOTFOUND") throw new BackupStorageError(0, "AccountNotFound", `No storage account called "${t.account}" was found.`);
    throw new BackupStorageError(0, "NetworkError", `Couldn't reach Azure (${cause ?? (e as Error).message}).`);
  }
  if (res.ok || (opts.allow404 && res.status === 404)) return res;
  const text = await res.text().catch(() => "");
  const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? res.headers.get("x-ms-error-code") ?? `HTTP${res.status}`;
  const message = text.match(/<Message>([^<]+)/)?.[1]?.split("\n")[0] ?? res.statusText;
  throw new BackupStorageError(res.status, code, message);
}

const blobPath = (t: AzureTarget, name: string) => `/${t.container}/${encodeKey(`${t.prefix}${name}`)}`;

/** Uploads a backup file in 8 MB blocks, then commits them as one blob. */
export async function remotePutFile(t: AzureTarget, name: string, file: string) {
  await stat(file);
  const ids: string[] = [];
  let i = 0;
  let pending: Buffer[] = [];
  let pendingSize = 0;
  const flush = async () => {
    if (!pendingSize) return;
    const id = Buffer.from(`block-${String(i++).padStart(6, "0")}`).toString("base64");
    await request(t, "PUT", blobPath(t, name), { query: { comp: "block", blockid: id }, body: Buffer.concat(pending) });
    ids.push(id);
    pending = [];
    pendingSize = 0;
  };
  for await (const chunk of createReadStream(file, { highWaterMark: BLOCK }) as AsyncIterable<Buffer>) {
    pending.push(chunk);
    pendingSize += chunk.length;
    if (pendingSize >= BLOCK) await flush();
  }
  await flush();
  const xml = `<?xml version="1.0" encoding="utf-8"?><BlockList>${ids.map((id) => `<Latest>${id}</Latest>`).join("")}</BlockList>`;
  await request(t, "PUT", blobPath(t, name), { query: { comp: "blocklist" }, body: xml, headers: { "Content-Type": "application/xml", "x-ms-blob-content-type": "application/gzip" } });
}

export async function remotePutText(t: AzureTarget, name: string, text: string) {
  await request(t, "PUT", blobPath(t, name), { body: text, headers: { "Content-Type": "application/json", "x-ms-blob-type": "BlockBlob", "x-ms-blob-content-type": "application/json" } });
}

export async function remoteGetText(t: AzureTarget, name: string): Promise<string | null> {
  const res = await request(t, "GET", blobPath(t, name), { allow404: true });
  return res.status === 404 ? null : res.text();
}

/** Downloads a backup to a local file as a stream. */
export async function remoteGetFile(t: AzureTarget, name: string, file: string) {
  const res = await request(t, "GET", blobPath(t, name));
  if (!res.body) throw new Error("Empty blob");
  try {
    await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), createWriteStream(file));
  } catch (e) {
    await unlink(file).catch(() => undefined);
    throw e;
  }
}

export async function remoteDelete(t: AzureTarget, name: string) {
  await request(t, "DELETE", blobPath(t, name), { allow404: true });
}

/** Names of everything under the prefix. */
export async function remoteList(t: AzureTarget): Promise<string[]> {
  const out: string[] = [];
  let marker: string | null = null;
  do {
    const query: Record<string, string> = { restype: "container", comp: "list", maxresults: "1000", ...(t.prefix ? { prefix: t.prefix } : {}), ...(marker ? { marker } : {}) };
    const xml = await (await request(t, "GET", `/${t.container}`, { query })).text();
    for (const m of xml.matchAll(/<Blob>[\s\S]*?<Name>([^<]*)<\/Name>/g)) out.push(xmlDecode(m[1]!).slice(t.prefix.length));
    const next: string | null = xml.match(/<NextMarker>([^<]+)<\/NextMarker>/)?.[1] ?? null;
    marker = next ? xmlDecode(next) : null;
  } while (marker);
  return out;
}

/**
 * Makes sure the backup container exists and is private (creates it private when missing), then writes, reads
 * back and removes a small test file. Throws a readable message when something is wrong.
 */
export async function remoteTest(t: AzureTarget) {
  try {
    const props = await request(t, "GET", `/${t.container}`, { query: { restype: "container" }, allow404: true });
    if (props.status === 404) {
      await request(t, "PUT", `/${t.container}`, { query: { restype: "container" } }); // no public-access header = private
    } else {
      const access = props.headers.get("x-ms-blob-public-access");
      if (access === "blob" || access === "container") {
        throw new BackupStorageError(0, "PublicContainer", `The container “${t.container}” can be read by anyone on the internet. Backups need a private container: use another name (it's created private) or turn off public access for this one in Azure.`);
      }
    }
    const name = `.cadgram-test-${Date.now()}.txt`;
    await remotePutText(t, name, "ok");
    const back = await remoteGetText(t, name);
    await remoteDelete(t, name);
    if (back !== "ok") throw new Error("The test file couldn't be read back.");
  } catch (e) {
    const code = (e as BackupStorageError).code;
    const hint = code === "AuthenticationFailed" || code === "AuthorizationFailure" || code === "AuthorizationPermissionMismatch"
      ? "Azure refused the access key. Check the storage account name and key."
      : code === "InvalidResourceName" ? "That container name isn't allowed: use 3–63 lowercase letters, numbers and hyphens."
      : (e as Error).message || "Unknown error";
    throw new Error(hint);
  }
}
