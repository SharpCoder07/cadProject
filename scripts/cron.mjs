#!/usr/bin/env node
/**
 * Runs the scheduled jobs (/api/cron) on your own computer while `npm run dev` is running —
 * the same thing the "cron" container does on the server every 5 minutes:
 *   - emails buyers about offers that have just started on their favourite products
 *   - publishes scheduled products, pages and blog posts
 *   - retries failed lead emails, cleans up old sessions
 *
 *   npm run cron            every 5 minutes until you press Ctrl+C
 *   npm run cron -- --once  just once, right now
 *
 * Reads APP_URL and CRON_SECRET from .env.
 */
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env: fall back to the environment */
}

const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
const once = process.argv.includes("--once");
const every = Number(process.env.CRON_INTERVAL_SECONDS || 300) * 1000;

if (!secret) {
  console.error("CRON_SECRET is not set in .env — add one (any long random string) and restart `npm run dev`.");
  process.exit(1);
}

async function tick() {
  const at = new Date().toLocaleTimeString();
  try {
    const res = await fetch(`${base}/api/cron`, { headers: { Authorization: `Bearer ${secret}` } });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[${at}] ${res.status} ${res.status === 401 ? "— CRON_SECRET doesn't match the one the app started with (restart npm run dev)." : body.slice(0, 200)}`);
      return false;
    }
    const r = JSON.parse(body);
    const p = r.published ?? {};
    console.log(`[${at}] ok — offer emails sent: ${r.offerEmails ?? 0}, published: ${p.software ?? 0} products / ${p.pages ?? 0} pages / ${p.posts ?? 0} posts, retried notifications: ${r.retriedNotifications ?? 0}`);
    return true;
  } catch (e) {
    console.error(`[${at}] couldn't reach ${base} — is \`npm run dev\` running? (${e instanceof Error ? e.message : e})`);
    return false;
  }
}

if (once) {
  process.exit((await tick()) ? 0 : 1);
}
console.log(`Running scheduled jobs against ${base} every ${every / 1000}s. Press Ctrl+C to stop.`);
await tick();
setInterval(tick, every);
