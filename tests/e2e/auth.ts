import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { totp } from "../../src/server/auth/totp";

/**
 * Two-step verification is required for every account. The first time a test account signs in
 * it sets up an authenticator; the secret is kept in tests/e2e/.totp.json (git-ignored) so later
 * runs can produce codes. Delete that file after `npm run db:reset`, or set E2E_TOTP_<EMAIL> env vars.
 */
const STORE = path.join(__dirname, ".totp.json");
const load = (): Record<string, string> => (existsSync(STORE) ? (JSON.parse(readFileSync(STORE, "utf8")) as Record<string, string>) : {});
const envKey = (email: string) => `E2E_TOTP_${email.replace(/[^a-z0-9]/gi, "_").toUpperCase()}`;

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login\/verify/);

  const setup = page.getByRole("button", { name: "Turn on and continue" });
  if (await setup.isVisible()) {
    await page.getByRole("button", { name: "Enter a key instead" }).click();
    const secret = (await page.getByTestId("totp-secret").getAttribute("data-secret"))!;
    writeFileSync(STORE, JSON.stringify({ ...load(), [email]: secret }, null, 2));
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByLabel("I've saved my backup codes somewhere safe").check();
    await page.getByRole("button", { name: "Continue" }).click();
    return;
  }
  const secret = process.env[envKey(email)] ?? load()[email];
  if (!secret) throw new Error(`No authenticator secret for ${email}. Set ${envKey(email)} or reset its two-step verification.`);
  await page.getByLabel("6-digit code").fill(totp(secret));
}
