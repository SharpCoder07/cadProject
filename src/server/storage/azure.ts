import "server-only";
import { createHmac } from "node:crypto";
import type { StorageDriver, StoredObject } from "./index";

export interface AzureConfig {
  /** Storage account name, e.g. "cadgrammedia". */
  account: string;
  /** Storage account access key (base64). */
  key: string;
  /** Blob container, e.g. "uploads". */
  container: string;
  /** Optional CDN / custom domain in front of the container, e.g. https://media.cadgram.com */
  publicUrl: string;
}

const API_VERSION = "2023-11-03";

/** An Azure Storage REST error, with Azure's error code (e.g. AuthenticationFailed). */
export class AzureError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "AzureError";
  }
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
const xmlDecode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/**
 * Azure Blob Storage over its REST API, signed with the account's Shared Key. No SDK needed.
 * Files are served straight from the container (anonymous read access for blobs), or from a CDN
 * or custom domain in front of it.
 */
export class AzureBlobStorage implements StorageDriver {
  readonly provider = "azure" as const;
  readonly baseUrl: string;
  private readonly endpoint: string;

  constructor(private readonly cfg: AzureConfig) {
    this.endpoint = `https://${cfg.account}.blob.core.windows.net`;
    this.baseUrl = `${(cfg.publicUrl || `${this.endpoint}/${cfg.container}`).replace(/\/+$/, "")}/`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.request("PUT", `/${this.cfg.container}/${encodeKey(key)}`, {
      body,
      headers: { "Content-Type": contentType, "x-ms-blob-type": "BlockBlob", "x-ms-blob-cache-control": "public, max-age=31536000, immutable", "x-ms-blob-content-type": contentType },
    });
    return { key, url: `${this.baseUrl}${encodeKey(key)}`, provider: this.provider };
  }

  async get(key: string): Promise<Buffer | null> {
    const res = await this.request("GET", `/${this.cfg.container}/${encodeKey(key)}`, { allow404: true });
    return res.status === 404 ? null : Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await this.request("DELETE", `/${this.cfg.container}/${encodeKey(key)}`, { allow404: true });
  }

  async list(cursor: string | null, limit: number) {
    const query: Record<string, string> = { restype: "container", comp: "list", maxresults: String(limit) };
    if (cursor) query.marker = cursor;
    const xml = await (await this.request("GET", `/${this.cfg.container}`, { query })).text();
    const keys = [...xml.matchAll(/<Blob>[\s\S]*?<Name>([^<]*)<\/Name>/g)].map((m) => xmlDecode(m[1]!));
    const next = xml.match(/<NextMarker>([^<]+)<\/NextMarker>/)?.[1] ?? null;
    return { keys, next: next ? xmlDecode(next) : null };
  }

  /**
   * Makes sure the container exists and its files can be read publicly (needed so the website can
   * show them). Creates the container if missing.
   */
  async ensurePublicContainer(): Promise<void> {
    const path = `/${this.cfg.container}`;
    const res = await this.request("GET", path, { query: { restype: "container" }, allow404: true });
    if (res.status === 404) {
      await this.request("PUT", path, { query: { restype: "container" }, headers: { "x-ms-blob-public-access": "blob" } });
      return;
    }
    const access = res.headers.get("x-ms-blob-public-access");
    if (access === "blob" || access === "container") return;
    await this.request("PUT", path, { query: { restype: "container", comp: "acl" }, headers: { "x-ms-blob-public-access": "blob" } });
  }

  private async request(method: "GET" | "PUT" | "DELETE", path: string, opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: Buffer; allow404?: boolean } = {}) {
    const query = opts.query ?? {};
    const url = new URL(this.endpoint + path);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const headers: Record<string, string> = { "x-ms-date": new Date().toUTCString(), "x-ms-version": API_VERSION, ...opts.headers };
    const length = opts.body?.byteLength ?? 0;

    const canonicalHeaders = Object.entries(headers)
      .filter(([k]) => k.toLowerCase().startsWith("x-ms-"))
      .map(([k, v]) => [k.toLowerCase(), v.trim()] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}:${v}\n`)
      .join("");
    const canonicalResource =
      `/${this.cfg.account}${url.pathname}` +
      Object.keys(query)
        .map((k) => k.toLowerCase())
        .sort()
        .map((k) => `\n${k}:${query[k]}`)
        .join("");
    const stringToSign = [method, "", "", length ? String(length) : "", "", headers["Content-Type"] ?? "", "", "", "", "", "", ""].join("\n") + "\n" + canonicalHeaders + canonicalResource;
    const signature = createHmac("sha256", Buffer.from(this.cfg.key, "base64")).update(stringToSign, "utf8").digest("base64");
    headers.Authorization = `SharedKey ${this.cfg.account}:${signature}`;

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: opts.body ? new Uint8Array(opts.body) : undefined, cache: "no-store" });
    } catch (e) {
      const cause = (e as { cause?: { code?: string } }).cause?.code;
      if (cause === "ENOTFOUND") throw new AzureError(0, "AccountNotFound", `No storage account called "${this.cfg.account}" was found.`);
      throw new AzureError(0, "NetworkError", `Couldn't reach Azure (${cause ?? (e as Error).message}).`);
    }
    if (res.ok || (opts.allow404 && res.status === 404)) return res;
    const text = await res.text().catch(() => "");
    const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? res.headers.get("x-ms-error-code") ?? `HTTP${res.status}`;
    const message = text.match(/<Message>([^<]+)/)?.[1]?.split("\n")[0] ?? res.statusText;
    throw new AzureError(res.status, code, message);
  }
}
