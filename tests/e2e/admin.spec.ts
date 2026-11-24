import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? "admin@cadgram.local", password: process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe-2026!" };

test("admin area requires sign-in", async ({ page }) => {
  await page.goto("/admin/software");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fsoftware/);
});

test("an admin can sign in, create a draft listing and publish it", async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);

  const name = `E2E Product ${Date.now()}`;
  await page.goto("/admin/software/new");
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Tagline").fill("Created by an end-to-end test");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/software\/c[a-z0-9]+$/);
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
});

test("a sales manager cannot open settings", async ({ page }) => {
  await signIn(page, "sales@cadgram.local", "Demo-Password-2026");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/admin\/forbidden/);
});
