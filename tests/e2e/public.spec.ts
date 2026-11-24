import { expect, test } from "@playwright/test";

// Runs against a seeded database (npm run setup).

test("homepage renders CMS sections and search suggestions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("I need software for");
  const search = page.getByRole("combobox").first();
  await search.fill("ledg");
  await expect(page.getByRole("option", { name: /Ledgerline Books/ })).toBeVisible();
});

test("category listing filters update the URL and results", async ({ page }) => {
  await page.goto("/categories/accounting-software");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accounting");
  await page.getByLabel("Freemium").check();
  await expect(page).toHaveURL(/pricing=FREEMIUM/);
  await expect(page.getByText(/products?$/).first()).toBeVisible();
});

test("product page shows details and accepts an enquiry", async ({ page }) => {
  await page.goto("/software/ledgerline-books");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ledgerline Books");
  await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();
  await page.waitForTimeout(2600); // the form rejects submissions made faster than a person could type
  const form = page.locator("aside form").first();
  await form.getByLabel("Your name").fill("E2E Tester");
  await form.getByLabel("Mobile number").fill("9876501234");
  await form.getByLabel("Work email").fill("e2e@example.in");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: /quote/i }).click();
  await expect(page.getByText(/reference number is CG-/)).toBeVisible();
});

test("compare two products side by side", async ({ page }) => {
  await page.goto("/compare?p=ledgerline-books,kanakku-prime");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ledgerline Books vs Kanakku Prime");
  await expect(page.getByRole("rowheader", { name: "Starting price" })).toBeVisible();
});

test("serves sitemap index and robots", async ({ request }) => {
  const sm = await request.get("/sitemap.xml");
  expect(sm.ok()).toBeTruthy();
  expect(await sm.text()).toContain("<sitemapindex");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /admin");
});
