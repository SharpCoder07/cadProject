#!/usr/bin/env node
/**
 * Local email testing with Mailpit (https://github.com/axllent/mailpit): a fake SMTP server that
 * catches every email the app sends and shows it in a web inbox. Nothing is delivered to real
 * people, so it's safe to test sign-ups, review notifications, offer emails and so on.
 *
 *   npm run mail            downloads Mailpit into .mailpit/ on first run, then starts it
 *
 *   SMTP server:  localhost:1025  (no username, no password, no encryption)
 *   Web inbox:    http://localhost:8025
 *
 * Point the app at it in Admin → Settings → Email (host localhost, port 1025, encryption None,
 * username blank), or with EMAIL_DRIVER=smtp, SMTP_HOST=localhost, SMTP_PORT=1025 in .env.
 * Works on Windows, macOS and Linux. Press Ctrl+C to stop.
 */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const DIR = join(process.cwd(), ".mailpit");
const isWin = process.platform === "win32";
const BIN = join(DIR, isWin ? "mailpit.exe" : "mailpit");
const SMTP = process.env.MAILPIT_SMTP ?? "127.0.0.1:1025";
const UI = process.env.MAILPIT_UI ?? "127.0.0.1:8025";

function assetName() {
  const os = { win32: "windows", darwin: "darwin", linux: "linux" }[process.platform];
  const arch = { x64: "amd64", arm64: "arm64", ia32: "386" }[process.arch];
  if (!os || !arch) throw new Error(`Mailpit has no download for ${process.platform}/${process.arch}. Install it yourself: https://github.com/axllent/mailpit/releases`);
  return `mailpit-${os}-${arch}.${isWin ? "zip" : "tar.gz"}`;
}

async function download() {
  const name = assetName();
  console.log(`Downloading Mailpit (${name}) from GitHub…`);
  const rel = await fetch("https://api.github.com/repos/axllent/mailpit/releases/latest", { headers: { Accept: "application/vnd.github+json", "User-Agent": "cadgram-dev" } });
  if (!rel.ok) throw new Error(`GitHub answered ${rel.status} while looking up the latest Mailpit release.`);
  const release = await rel.json();
  const asset = release.assets?.find((a) => a.name === name);
  if (!asset) throw new Error(`The latest Mailpit release has no ${name}. Download it from https://github.com/axllent/mailpit/releases into .mailpit/`);
  mkdirSync(DIR, { recursive: true });
  const archive = join(DIR, name);
  const res = await fetch(asset.browser_download_url, { headers: { "User-Agent": "cadgram-dev" } });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}).`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(archive));
  // Windows 10+ ships bsdtar, which unpacks .zip as well as .tar.gz.
  const out = spawnSync("tar", ["-xf", archive, "-C", DIR], { stdio: "inherit" });
  rmSync(archive, { force: true });
  if (out.status !== 0 || !existsSync(BIN)) throw new Error("Couldn't unpack Mailpit. Unzip it yourself into .mailpit/ from https://github.com/axllent/mailpit/releases");
  console.log(`Mailpit ${release.tag_name} installed in .mailpit/`);
}

try {
  if (!existsSync(BIN)) await download();
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : e}\n\nAlternatively, with Docker:  docker compose --profile dev up -d mailpit\n`);
  process.exit(1);
}

console.log(`
  Mailpit is running.
    Inbox:  http://${UI.replace("127.0.0.1", "localhost")}
    SMTP:   ${SMTP.replace("127.0.0.1", "localhost")}  (no username/password, encryption: None)

  In the admin panel: Settings → Email → host "localhost", port ${SMTP.split(":")[1]}, encryption "None",
  leave username empty, save, then "Send a test". Press Ctrl+C to stop.
`);

// Keep at most 500 messages so the inbox doesn't grow forever.
const child = spawn(BIN, ["--smtp", SMTP, "--listen", UI, "--max", "500"], { stdio: ["ignore", "inherit", "inherit"] });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
