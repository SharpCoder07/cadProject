import "server-only";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";

/**
 * Downloads a file from a URL someone pasted, for the "Paste URL" option next to every upload.
 * The result goes through the normal upload pipeline (processUpload), so pasted files get exactly
 * the same type checks, re-encoding and size limits as uploaded ones.
 *
 * Server-side request forgery guards: http(s) only, ports 80/443 only, no credentials in the URL,
 * every hostname is resolved and rejected if ANY address is private, loopback, link-local or
 * otherwise reserved; the connection is pinned to the checked address (no DNS-rebinding window);
 * redirects are followed by hand (max 3) and each hop is checked again; 15 s timeout; the body is
 * streamed and cut off at the upload size limit.
 */

// Separate lists per family: Node's BlockList also applies IPv4-mapped IPv6 rules to plain IPv4
// checks, so mixing them would block ordinary public addresses.
const BLOCKED_V4 = new net.BlockList();
const BLOCKED_V6 = new net.BlockList();
for (const [net4, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED_V4.addSubnet(net4, prefix, "ipv4");
for (const [net6, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) BLOCKED_V6.addSubnet(net6, prefix, "ipv6");

/** True for addresses on private, loopback, link-local or reserved networks. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return BLOCKED_V4.check(address, "ipv4");
  if (family !== 6) return true;
  // Canonical compressed form, so every spelling of an address is judged the same way.
  const c = new URL(`http://[${address}]`).hostname.slice(1, -1).toLowerCase();
  // IPv4-mapped addresses (::ffff:10.0.0.1 or ::ffff:a00:1) are judged by their IPv4 part.
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(c);
  if (dotted) return BLOCKED_V4.check(dotted[1] as string, "ipv4");
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(c);
  if (hex) {
    const hi = parseInt(hex[1] as string, 16);
    const lo = parseInt(hex[2] as string, 16);
    return BLOCKED_V4.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, "ipv4");
  }
  return BLOCKED_V6.check(c, "ipv6");
}

const fail = (message: string) => new AppError(message, "BAD_REQUEST", { url: [message] });

function parseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw fail("Paste a full link starting with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw fail("Only http and https links can be used.");
  if (url.username || url.password) throw fail("Links with a username or password can't be used.");
  if (url.port && url.port !== "80" && url.port !== "443") throw fail("That link uses an unusual port and can't be used.");
  return url;
}

async function safeAddress(hostname: string): Promise<{ address: string; family: number }> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw fail("Links to private or internal network addresses can't be used.");
    return { address: host, family: net.isIP(host) };
  }
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw fail("Links to private or internal network addresses can't be used.");
  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw fail("That website couldn't be found. Check the link.");
  }
  if (!addrs.length || addrs.some((a) => isBlockedAddress(a.address))) throw fail("Links to private or internal network addresses can't be used.");
  return addrs[0] as { address: string; family: number };
}

interface Hop {
  status: number;
  location?: string;
  contentType: string;
  disposition: string;
  body?: Buffer;
}

function request(url: URL, pinned: { address: string; family: number }, maxBytes: number, deadline: number): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MediaImporter/1.0)", Accept: "image/*,application/pdf;q=0.9,*/*;q=0.5", "Accept-Encoding": "identity" },
        // Connect to the address we already checked, never a fresh DNS answer.
        lookup: (_host, opts, cb) => {
          const o = opts as { all?: boolean };
          if (o?.all) (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [pinned]);
          else (cb as (e: null, a: string, f: number) => void)(null, pinned.address, pinned.family);
        },
        timeout: Math.max(1000, deadline - Date.now()),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const head = { status, contentType: String(res.headers["content-type"] ?? ""), disposition: String(res.headers["content-disposition"] ?? "") };
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ ...head, location: res.headers.location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return resolve(head);
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          res.destroy();
          return reject(fail(`That file is larger than ${env.MAX_UPLOAD_MB} MB.`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            res.destroy();
            reject(fail(`That file is larger than ${env.MAX_UPLOAD_MB} MB.`));
          } else chunks.push(c);
        });
        res.on("end", () => resolve({ ...head, body: Buffer.concat(chunks) }));
        res.on("error", () => reject(fail("The download was interrupted. Try again.")));
      },
    );
    const kill = () => req.destroy(Object.assign(new Error("timeout"), { code: "TIMEOUT" }));
    // Hard overall limit as well as the idle timeout, so a slow drip can't hold the request open.
    const timer = setTimeout(kill, Math.max(1000, deadline - Date.now()));
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", kill);
    req.on("error", (e: NodeJS.ErrnoException) => {
      if (e instanceof AppError) return reject(e);
      reject(fail(e.code === "TIMEOUT" ? "That website took too long to respond." : "That link couldn't be downloaded. Check it opens in your browser."));
    });
    req.end();
  });
}

function nameFrom(url: URL, disposition: string): string {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  let name = m?.[1] ?? url.pathname.split("/").filter(Boolean).pop() ?? "";
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep raw */
  }
  return name.slice(0, 120) || `${url.hostname}-image`;
}

/** Downloads a pasted link and returns its bytes and a file name for processUpload/storeImage. */
export async function fetchRemoteFile(raw: string, maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024): Promise<{ buffer: Buffer; name: string }> {
  let url = parseUrl(raw);
  const deadline = Date.now() + 15_000;
  for (let hop = 0; hop <= 3; hop++) {
    const pinned = await safeAddress(url.hostname);
    const res = await request(url, pinned, maxBytes, deadline);
    if (res.location) {
      if (hop === 3) throw fail("That link redirects too many times.");
      url = parseUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status === 401 || res.status === 403) throw fail("That file is private or blocks downloads. Download it and upload the file instead.");
    if (res.status === 404) throw fail("Nothing was found at that link.");
    if (!res.body) throw fail(`That website returned an error (${res.status}). Try again or upload the file.`);
    if (/^text\/html/i.test(res.contentType)) {
      throw fail("That link opens a web page, not a file. Right-click the image and choose “Copy image address”, then paste that.");
    }
    if (!res.body.length) throw fail("That link returned an empty file.");
    return { buffer: res.body, name: nameFrom(url, res.disposition) };
  }
  throw fail("That link redirects too many times.");
}
