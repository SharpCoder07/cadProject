/**
 * Seeds roles, permissions, an initial Super Admin and (on an empty catalogue)
 * realistic sample content. Safe to re-run: roles/permissions/settings are
 * upserted; sample content is only created when there is no software yet.
 *
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD  initial Super Admin (defaults below for local dev only)
 *   SEED_SAMPLE_DATA=false                  skip sample content
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import sharp from "sharp";
import { PERMISSIONS, SYSTEM_ROLES, permissionGroup, type Permission } from "../src/server/rbac/permissions";
import { settingSchemas, SETTING_KEYS } from "../src/server/settings/schemas";
import { defaultBlockData } from "../src/lib/blocks/schemas";
import { slugify } from "../src/lib/utils";
import { ATTRIBUTES, CATEGORIES, INDUSTRIES, POSTS, PRODUCTS, VENDORS } from "./seed-data";
import { STARTER_TERMS, TAXONOMY_KINDS, slugifyTerm, type TaxonomyKind } from "../src/lib/taxonomies";
import { GEO_STARTER } from "../src/lib/geo-starter";
import { CAD_CATEGORIES, CAD_GEO_PAGES, CAD_PRODUCTS, CAD_TERM_PAGES, CAD_VENDORS } from "./seed-cad-data";
import { BLOG_CATEGORIES, COVER_COLOURS, DEMO_POSTS } from "./seed-blog";
import { PRODUCT_EXTRAS } from "./seed-product-extras";
import { brandLogoSvg } from "./brand-logo";

const db = new PrismaClient();
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

async function seedAccessControl() {
  for (const key of Object.keys(PERMISSIONS) as Permission[]) {
    await db.permission.upsert({ where: { key }, create: { key, group: permissionGroup(key), description: PERMISSIONS[key] }, update: { group: permissionGroup(key), description: PERMISSIONS[key] } });
  }
  const perms = await db.permission.findMany();
  const idOf = new Map(perms.map((p) => [p.key, p.id]));
  for (const [key, def] of Object.entries(SYSTEM_ROLES)) {
    const role = await db.role.upsert({ where: { key }, create: { key, name: def.name, description: def.description, isSystem: true }, update: { name: def.name, description: def.description, isSystem: true } });
    // System roles are reset to their defaults on every seed run.
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: def.permissions.map((p) => ({ roleId: role.id, permissionId: idOf.get(p)! })) });
  }
  console.log(`✓ ${perms.length} permissions, ${Object.keys(SYSTEM_ROLES).length} roles`);
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@cadgram.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe-2026!";
  if (process.env.NODE_ENV === "production" && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error("Set SEED_ADMIN_PASSWORD when seeding a production database.");
  }
  const role = await db.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({ data: { email, name: "Platform Admin", passwordHash: await hash(password, ARGON), roleId: role.id, status: "ACTIVE" } });
    console.log(`✓ Super Admin ${email} (password from SEED_ADMIN_PASSWORD or the local default — change it after first sign-in)`);
  } else console.log(`• Super Admin ${email} already exists`);
}

async function seedSettings() {
  for (const key of SETTING_KEYS) {
    const value = settingSchemas[key].parse({}) as Prisma.InputJsonValue;
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  // One-time upgrade: sites still on the original (untouched) palette move to the 2026 refresh.
  const theme = await db.setting.findUnique({ where: { key: "theme" } });
  const t = (theme?.value ?? {}) as Record<string, unknown>;
  // Covers every earlier default palette (including the short-lived cadgram.com purple), so untouched sites get the current one.
  const OLD_DEFAULTS = [["#2B3A8C", "#F2A007"], ["#2350F0", "#FFB020"], ["#432DA6", "#FF8A00"], ["#5145CD", "#FF8A00"]];
  if (OLD_DEFAULTS.some(([p, a]) => t.primary === p && t.accent === a) && t.ink !== settingSchemas.theme.parse({}).ink) {
    const fresh = settingSchemas.theme.parse({}) as Record<string, unknown>;
    const value = { ...t, primary: fresh.primary, accent: fresh.accent, ink: fresh.ink, background: fresh.background, success: fresh.success, displayFont: fresh.displayFont, bodyFont: fresh.bodyFont, radius: fresh.radius };
    await db.setting.update({ where: { key: "theme" }, data: { value: value as Prisma.InputJsonValue } });
    console.log("✓ theme upgraded to the new default palette");
  }
  for (const key of ["email", "storage"]) await db.integration.upsert({ where: { key }, create: { key, isEnabled: true }, update: {} });
  console.log("✓ default settings");
}

/** Generates a simple square logo PNG (initials on a coloured tile) into local storage. */
async function makeLogo(slug: string, name: string, color: string) {
  if ((process.env.STORAGE_DRIVER || "local") !== "local") return null;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="48" fill="${color}"/><text x="50%" y="54%" font-family="Arial, Helvetica, sans-serif" font-size="104" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const key = `seed/${slug}.png`;
  const file = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  return db.mediaAsset.upsert({
    where: { storageKey: key },
    create: { storageKey: key, provider: "local", url: `/uploads/${key}`, filename: `${slug}.png`, mimeType: "image/png", sizeBytes: buf.byteLength, width: 256, height: 256, alt: `${name} logo` },
    update: {},
  });
}

const pick = <T,>(arr: readonly T[], n: number, seed: number) => arr.filter((_, i) => (i * 7 + seed) % arr.length < n);

async function seedCatalogue() {
  // Categories (tree with materialized path)
  const catId = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const parent = await db.category.create({ data: { name: c.name, slug: c.slug, icon: c.icon, description: c.description, sortOrder: i, depth: 0, path: "/" } });
    catId.set(c.slug, parent.id);
    for (const [j, sc] of (c.children ?? []).entries()) {
      const child = await db.category.create({ data: { name: sc.name, slug: sc.slug, description: sc.description, icon: c.icon, parentId: parent.id, depth: 1, path: `/${parent.id}/`, sortOrder: j } });
      catId.set(sc.slug, child.id);
    }
  }
  const indId = new Map<string, string>();
  for (const [i, ind] of INDUSTRIES.entries()) indId.set(ind.slug, (await db.industry.create({ data: { ...ind, sortOrder: i } })).id);

  // Attributes
  const attr = new Map<string, { id: string; type: string; options: Map<string, string> }>();
  for (const [i, a] of ATTRIBUTES.entries()) {
    const created = await db.attribute.create({
      data: { key: a.key, label: a.label, type: a.type, group: a.group, unit: "unit" in a ? a.unit : null, isFilterable: a.isFilterable, sortOrder: i, options: { create: a.options.map((o, j) => ({ value: slugify(o), label: o, sortOrder: j })) } },
      include: { options: true },
    });
    attr.set(a.key, { id: created.id, type: a.type, options: new Map(created.options.map((o) => [o.label, o.id])) });
  }
  // Category filters: platforms, integrations and business size everywhere; GST-related on accounting.
  for (const [slug, id] of catId) {
    const keys = ["business_size", "platforms", "integrations", ...(slug.includes("accounting") || slug.includes("gst") || slug.includes("invoic") ? ["data_center"] : [])];
    await db.categoryAttribute.createMany({ data: keys.map((k, i) => ({ categoryId: id, attributeId: attr.get(k)!.id, sortOrder: i })) });
  }

  // Vendors
  const vendorId = new Map<string, string>();
  for (const v of VENDORS) {
    const logo = await makeLogo(`vendor-${v.slug}`, v.name, "#44403C");
    const created = await db.vendor.create({
      data: {
        name: v.name, slug: v.slug, city: v.city, state: null, country: "India", foundedYear: v.founded, employeeRange: v.size, website: `https://${v.slug}.example.com`, email: `sales@${v.slug}.example.com`,
        description: `${v.name} builds business software for Indian companies from its headquarters in ${v.city}. Founded in ${v.founded}, the team of ${v.size} people focuses on products that handle local compliance out of the box.`,
        verification: v.verified ? "VERIFIED" : "PENDING", verifiedAt: v.verified ? new Date() : null, canPublish: v.verified, logoId: logo?.id,
      },
    });
    vendorId.set(v.slug, created.id);
  }

  // Software
  const swId = new Map<string, string>();
  for (const [n, p] of PRODUCTS.entries()) {
    const slug = slugify(p.name);
    const logo = await makeLogo(slug, p.name, p.color);
    const flags = new Set(p.flags ?? []);
    const vid = vendorId.get(p.vendor)!;
    const primary = catId.get(p.category)!;
    const sw = await db.software.create({
      data: {
        name: p.name, slug, tagline: p.tagline, status: "PUBLISHED", publishedAt: new Date(Date.now() - (n + 3) * 86_400_000), vendorId: vid, primaryCategoryId: primary, logoId: logo?.id,
        shortDescription: `${p.tagline}. ${p.features.slice(0, 2).map(([t]) => t).join(" and ")} for ${p.industries.map((i) => INDUSTRIES.find((x) => x.slug === i)?.name.toLowerCase()).filter(Boolean).slice(0, 2).join(" and ")} businesses.`,
        description: `<p>${p.name} is built by ${VENDORS.find((v) => v.slug === p.vendor)?.name} for businesses that want ${p.tagline.toLowerCase()}.</p><h2>What it does well</h2><ul>${p.features.map(([t, d]) => `<li><strong>${t}.</strong> ${d}</li>`).join("")}</ul><h2>Who it's for</h2><p>Teams in ${p.industries.map((i) => INDUSTRIES.find((x) => x.slug === i)?.name).join(", ")} that need ${p.deployment.includes("CLOUD") ? "access from anywhere" : "software that runs on their own machines"} and responsive support in Indian time zones.</p>`,
        websiteUrl: `https://${slug}.example.com`, pricingModel: p.pricing, startingPrice: p.price, priceUnit: p.unit || null, hasFreeTrial: Boolean(p.trial), hasFreeVersion: p.pricing === "FREEMIUM" || p.pricing === "FREE",
        deployment: p.deployment, isFeatured: flags.has("featured"), isPopular: flags.has("popular"), isTrending: flags.has("trending"), isRecommended: flags.has("recommended"), isSponsored: flags.has("sponsored"), sponsoredRank: flags.has("sponsored") ? n + 1 : null,
        viewCount: 200 + ((n * 137) % 1800),
        categories: { create: [p.category, ...(p.also ?? [])].map((c) => ({ categoryId: catId.get(c)!, isPrimary: c === p.category })) },
        industries: { create: p.industries.map((i) => ({ industryId: indId.get(i)! })) },
        features: { create: p.features.map(([title, description], i) => ({ title, description, sortOrder: i })) },
        plans: { create: (p.plans ?? []).map((pl, i) => ({ name: pl.name, price: pl.price, billingPeriod: pl.period ?? (pl.price === null ? "CUSTOM" : "MONTHLY"), priceUnit: pl.unit ?? null, features: pl.features, isPopular: Boolean(pl.popular), sortOrder: i })) },
        faqs: { create: [
          { question: `Does ${p.name} offer a free trial?`, answer: p.trial ? `Yes. ${p.name} offers a free trial so you can try it with your own data before buying.` : `${p.name} doesn't advertise a free trial, but you can request a guided demo.`, sortOrder: 0 },
          { question: `Is ${p.name} available in the cloud?`, answer: p.deployment.includes("CLOUD") ? "Yes, it runs in the cloud and works in any modern browser." : `It is installed ${p.deployment.includes("ON_PREMISE") ? "on your own servers" : "on your computers"}; ask the vendor about hosted options.`, sortOrder: 1 },
          { question: `How is ${p.name} priced?`, answer: p.price ? `Plans start at ₹${p.price.toLocaleString("en-IN")} ${p.unit ?? ""}. Final pricing depends on users and modules.`.trim() : "Pricing is shared on request based on your requirements.", sortOrder: 2 },
        ] },
      },
    });
    swId.set(slug, sw.id);

    // Attribute values (deterministic variety)
    const values: Prisma.SoftwareAttributeValueCreateManyInput[] = [];
    const add = (key: string, labels: readonly string[]) => labels.forEach((l) => { const a = attr.get(key)!; const o = a.options.get(l); if (o) values.push({ softwareId: sw.id, attributeId: a.id, optionId: o }); });
    add("platforms", [...(p.deployment.includes("CLOUD") ? ["Web"] : []), ...(p.deployment.includes("MOBILE") ? ["Android", "iOS"] : []), ...(p.deployment.includes("DESKTOP") || p.deployment.includes("ON_PREMISE") ? ["Windows"] : [])]);
    add("languages", ["English", ...pick(["Hindi", "Tamil", "Telugu", "Marathi", "Gujarati", "Bengali", "Kannada"], 2, n)]);
    add("integrations", pick(["Razorpay", "WhatsApp", "Google Workspace", "Microsoft 365", "Shopify", "Tally export", "Zapier", "Slack"], 3, n));
    add("support", ["Email", ...pick(["Phone", "Chat", "On-site", "24×7"], 2, n)]);
    add("business_size", p.price === null ? ["Mid-size", "Enterprise"] : p.pricing === "FREEMIUM" ? ["Freelancers", "Small business"] : ["Small business", "Mid-size"]);
    add("data_center", [n % 3 === 0 ? "On request" : "Yes"]);
    const isFinance = p.category.includes("account") || p.category.includes("gst") || p.category.includes("invoic") || p.category.includes("erp");
    values.push({ softwareId: sw.id, attributeId: attr.get("gst_compliant")!.id, valueBool: isFinance || p.category.includes("pos") });
    if (isFinance) values.push({ softwareId: sw.id, attributeId: attr.get("e_invoicing")!.id, valueBool: n % 2 === 0 });
    values.push({ softwareId: sw.id, attributeId: attr.get("api_access")!.id, valueBool: p.price === null || n % 2 === 1 });
    values.push({ softwareId: sw.id, attributeId: attr.get("max_users")!.id, valueNumber: p.price === null ? 10000 : 25 * ((n % 4) + 1) });
    await db.softwareAttributeValue.createMany({ data: values, skipDuplicates: true });
  }

  // Alternatives = other products in the same primary category
  for (const p of PRODUCTS) {
    const same = PRODUCTS.filter((q) => q !== p && (q.category === p.category || (q.also ?? []).includes(p.category))).slice(0, 4);
    if (same.length) await db.relatedSoftware.createMany({ data: same.map((q, i) => ({ softwareId: swId.get(slugify(p.name))!, relatedId: swId.get(slugify(q.name))!, kind: "ALTERNATIVE" as const, sortOrder: i })) });
  }

  // Featured per category
  for (const c of CATEGORIES) {
    const items = PRODUCTS.filter((p) => p.category === c.slug || (p.also ?? []).includes(c.slug)).slice(0, 4);
    if (items.length) await db.categoryFeatured.createMany({ data: items.map((p, i) => ({ categoryId: catId.get(c.slug)!, softwareId: swId.get(slugify(p.name))!, sortOrder: i })) });
  }

  // Reviews (approved + a few pending for moderation)
  const reviewers = [["Ananya Iyer", "Finance Manager", "Iyer Textiles", "51–200"], ["Rohit Sharma", "Founder", "Sharma Traders", "1–10"], ["Fatima Khan", "HR Lead", "Crescent Logistics", "201–1000"], ["Vikram Reddy", "Operations Head", "Reddy Foods", "11–50"], ["Neha Kulkarni", "Accountant", "Kulkarni & Co.", "11–50"], ["Arjun Mehta", "IT Manager", "Mehta Pharma", "201–1000"]] as const;
  const bodies = [
    ["Saved our team hours every month", "Setup took a week with their onboarding team and month-end now takes two days instead of five. Support answers on WhatsApp within an hour.", "Fast support, clear reports", "Mobile app is missing a few reports"],
    ["Good value for a small business", "We moved from spreadsheets and the learning curve was gentle. The pricing works for our size and we haven't needed to call support much.", "Easy to learn", "Customisation is limited"],
    ["Solid, but plan the migration", "The product does what it promises. Importing five years of old data took longer than expected, so give yourself time.", "Reliable day to day", "Data migration was slow"],
    ["Exactly what our branches needed", "Each branch manages its own work while head office sees everything. Statutory reports are accurate and audit-ready.", "Multi-location support", "Price rises with each module"],
  ] as const;
  let r = 0;
  for (const [slug, id] of swId) {
    const count = (slug.length % 4) + 1;
    for (let i = 0; i < count; i++) {
      const who = reviewers[(r + i) % reviewers.length]!;
      const b = bodies[(r + i) % bodies.length]!;
      const rating = 3 + ((r + i) % 3);
      await db.review.create({ data: { softwareId: id, authorName: who[0], authorRole: who[1], companyName: who[2], companySize: who[3], authorEmail: `${slugify(who[0])}@example.in`, rating, ratingEase: rating, ratingValue: Math.max(3, rating - 1), ratingSupport: rating, ratingFeatures: Math.min(5, rating + 1), title: b[0], body: b[1], pros: b[2], cons: b[3], status: i === count - 1 && r % 5 === 0 ? "PENDING" : "APPROVED", createdAt: new Date(Date.now() - (r * 3 + i) * 86_400_000) } });
    }
    r++;
  }
  // Ratings + search documents
  for (const id of swId.values()) {
    const agg = await db.review.aggregate({ where: { softwareId: id, status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
    const sw = await db.software.findUniqueOrThrow({ where: { id }, select: { viewCount: true } });
    await db.software.update({ where: { id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all, popularityScore: agg._count._all * 3 + (agg._avg.rating ?? 0) * 2 + Math.log10(1 + sw.viewCount) * 4 } });
    await db.$executeRaw`SELECT refresh_software_search(${id})`;
  }

  // Curated comparisons
  await db.comparisonPage.create({ data: { slug: "ledgerline-books-vs-kanakku-prime", title: "Ledgerline Books vs Kanakku Prime", status: "PUBLISHED", publishedAt: new Date(), intro: "<p>Cloud-first convenience or a desktop workhorse? Here is how two popular accounting tools compare for Indian SMEs.</p>", verdict: "<p>Choose Ledgerline Books if your CA and team work remotely; choose Kanakku Prime for heavy single-site data entry.</p>", items: { create: [{ softwareId: swId.get("ledgerline-books")!, sortOrder: 0 }, { softwareId: swId.get("kanakku-prime")!, sortOrder: 1 }] } } });
  await db.comparisonPage.create({ data: { slug: "peoplefirst-hrms-vs-paystack-india", title: "PeopleFirst HRMS vs PayStack India", status: "PUBLISHED", publishedAt: new Date(), intro: "<p>An all-in-one HR suite against a payroll specialist.</p>", items: { create: [{ softwareId: swId.get("peoplefirst-hrms")!, sortOrder: 0 }, { softwareId: swId.get("paystack-india")!, sortOrder: 1 }] } } });

  console.log(`✓ ${CATEGORIES.length} top categories, ${VENDORS.length} vendors, ${PRODUCTS.length} products with reviews`);
  return { catId, swId, vendorId };
}

async function seedContent(ids: { catId: Map<string, string>; swId: Map<string, string>; vendorId: Map<string, string> }) {
  const admin = await db.user.findFirstOrThrow({ where: { role: { key: "SUPER_ADMIN" } } });
  const section = (type: Parameters<typeof defaultBlockData>[0], data: Record<string, unknown> = {}, i = 0) => ({ type, sortOrder: i, data: { ...(defaultBlockData(type) as object), ...data } as Prisma.InputJsonValue });

  await db.page.create({
    data: {
      title: "Home", slug: "home", template: "HOMEPAGE", status: "PUBLISHED", isSystem: true, publishedAt: new Date(), updatedById: admin.id,
      sections: { create: [
        section("HERO", { quickLinks: [{ label: "GST billing", href: "/categories/gst-billing-software" }, { label: "Payroll", href: "/categories/payroll-software" }, { label: "CRM", href: "/categories/crm-software" }, { label: "Restaurant POS", href: "/categories/restaurant-pos" }, { label: "School ERP", href: "/categories/school-management-software" }] }, 0),
        section("CATEGORY_GRID", { title: "Popular software categories", limit: 12 }, 1),
        section("HOW_IT_WORKS", {}, 1),
        section("FEATURED_SOFTWARE", { title: "Popular with Indian businesses", source: "popular", limit: 8, viewAllHref: "/search" }, 2),
        section("SOFTWARE_TABS", { title: "Top picks by category", tabs: [{ label: "Accounting", categoryId: ids.catId.get("accounting-software") }, { label: "HR & Payroll", categoryId: ids.catId.get("hr-software") }, { label: "CRM", categoryId: ids.catId.get("crm-software") }, { label: "POS", categoryId: ids.catId.get("pos-software") }] }, 3),
        section("DEALS", {}, 3),
        section("BANNER_CAROUSEL", { placement: "home.promo" }, 4),
        section("CTA", { heading: "Not sure what to buy?", body: "Tell us what you need. A software advisor will shortlist options that fit your budget — free, in under 24 hours." }, 5),
        section("FEATURED_SOFTWARE", { title: "Trending this month", source: "trending", limit: 4 }, 6),
        section("INDUSTRY_GRID", { title: "Software by industry", limit: 8 }, 7),
        section("STATS", { items: [{ value: "1,200+", label: "Products listed" }, { value: "40,000+", label: "Buyers helped" }, { value: "4.6/5", label: "Advisor rating" }, { value: "24 hrs", label: "Average response" }] }, 8),
        section("COMPARISONS", { title: "Popular comparisons" }, 9),
        section("TESTIMONIALS", {}, 10),
        section("BLOG_POSTS", { eyebrow: "Expert guidance", title: "Latest software insights", linkLabel: "Visit the blog", limit: 3 }, 11),
        section("FAQ", { groupKey: "general" }, 12),
      ] },
    },
  });

  const rich = (html: string) => [{ type: "RICH_TEXT", sortOrder: 0, data: { html, width: "narrow" } as Prisma.InputJsonValue }];
  const pages = [
    { title: "About us", slug: "about", template: "DEFAULT" as const, html: "<p>We help Indian businesses find, compare and buy the right software. Our advisors have reviewed thousands of products so you don't have to.</p><h2>How we make money</h2><p>Listings are free to browse. Vendors may pay for sponsored placement, which is always labelled. Our recommendations are based on your requirements, not commissions.</p>" },
    { title: "Contact us", slug: "contact", template: "CONTACT" as const, html: "<p>Questions about a product, a listing or a partnership? Send us a message and we'll reply within one business day.</p>" },
    { title: "Privacy policy", slug: "privacy-policy", template: "LEGAL" as const, html: "<p>This sample policy is a placeholder. Replace it with your own policy reviewed by a lawyer, covering what you collect (enquiry details, analytics), why, who you share it with (vendors you're matched with) and how users can access or delete their data under the Digital Personal Data Protection Act, 2023.</p>" },
    { title: "Terms and conditions", slug: "terms", template: "LEGAL" as const, html: "<p>This sample text is a placeholder. Replace it with terms reviewed by a lawyer.</p>" },
    { title: "Frequently asked questions", slug: "faq", template: "DEFAULT" as const, html: "" },
    { title: "List your software", slug: "list-your-software", template: "LANDING" as const, html: "<h2>Reach businesses actively looking for software</h2><p>Create a free listing, receive qualified enquiries and manage everything from the vendor portal.</p>" },
  ];
  for (const p of pages) {
    await db.page.create({
      data: {
        title: p.title, slug: p.slug, template: p.template, status: "PUBLISHED", publishedAt: new Date(), updatedById: admin.id,
        sections: { create: p.slug === "faq" ? [{ type: "FAQ", sortOrder: 0, data: { title: "", groupKey: "general" } }, { type: "FAQ", sortOrder: 1, data: { title: "For vendors", groupKey: "vendors" } }] : p.slug === "list-your-software" ? [...rich(p.html), { type: "LEAD_FORM", sortOrder: 1, data: { title: "Talk to our partnerships team", subtitle: "" } }] : rich(p.html) },
      },
    });
  }

  await db.faqGroup.create({ data: { key: "general", title: "Frequently asked questions", items: { create: [
    { question: "Is it free to use?", answer: "Yes. Browsing, comparing and getting advice is free for buyers.", sortOrder: 0 },
    { question: "How do you choose which software to recommend?", answer: "Advisors match your requirements — users, budget, industry and must-have features — against verified product data and reviews. Sponsored listings are always labelled.", sortOrder: 1 },
    { question: "Will vendors call me?", answer: "Only the vendors relevant to your enquiry, and only if you agree on the form. You can ask us to stop at any time.", sortOrder: 2 },
    { question: "Are prices inclusive of GST?", answer: "Prices are shown as published by vendors. Each listing says whether GST is included; confirm the final quote with the vendor.", sortOrder: 3 },
  ] } } });
  await db.faqGroup.create({ data: { key: "vendors", title: "For vendors", sortOrder: 1, items: { create: [
    { question: "How do I list my product?", answer: "Fill in the form on the List your software page. Once approved, you get a vendor portal login to manage listings and see enquiries.", sortOrder: 0 },
    { question: "How does verification work?", answer: "We check your company registration and product details. Verified vendors get a badge and can publish updates without review.", sortOrder: 1 },
  ] } } });

  await db.testimonial.createMany({ data: [
    { name: "Priya Nair", role: "Director", company: "Nair Exports", quote: "We shortlisted three ERP vendors in a day and had demos booked the same week. The comparison saved us from an expensive mistake.", rating: 5, sortOrder: 0 },
    { name: "Karan Malhotra", role: "Co-founder", company: "Chai Point Cafés", quote: "The advisor understood restaurant billing better than most vendors did. Our POS was live in ten days.", rating: 5, sortOrder: 1 },
    { name: "Dr. Sneha Rao", role: "Clinic owner", company: "Rao Dental Care", quote: "Clear pricing and honest reviews. I knew exactly what I was paying for.", rating: 4, sortOrder: 2 },
  ] });

  await db.banner.createMany({ data: [
    { title: "Year-end offers on accounting software", subtitle: "Up to 25% off annual plans from verified vendors.", placement: "home.promo", ctaLabel: "See offers", ctaUrl: "/categories/accounting-software", theme: "brand", sortOrder: 0 },
    { title: "Free payroll setup this month", subtitle: "Migrate from spreadsheets with vendor-assisted onboarding.", placement: "home.promo", ctaLabel: "Explore payroll", ctaUrl: "/categories/payroll-software", theme: "dark", sortOrder: 1 },
    { title: "Talk to a GST software expert", placement: "category.accounting", ctaLabel: "Get free advice", ctaUrl: "/contact", theme: "brand" },
  ] });
  await db.category.update({ where: { id: ids.catId.get("accounting-software")! }, data: { layout: { view: "rows", defaultSort: "popular", showSubcategories: true, showFeatured: true, showBuyingGuide: true, showFaq: true, bannerPlacement: "category.accounting" } } });
  await db.announcement.create({ data: { message: "New: compare up to four products side by side.", linkLabel: "Try it", linkUrl: "/compare", variant: "info" } });

  // Menus
  const menu = async (key: string, name: string, items: { label: string; url?: string; categorySlug?: string; pageSlug?: string; badge?: string; children?: { label: string; url?: string; categorySlug?: string }[] }[]) => {
    const m = await db.menu.create({ data: { key, name } });
    for (const [i, it] of items.entries()) {
      const page = it.pageSlug ? await db.page.findUnique({ where: { slug: it.pageSlug } }) : null;
      const parent = await db.menuItem.create({ data: { menuId: m.id, label: it.label, url: it.url ?? null, categoryId: it.categorySlug ? ids.catId.get(it.categorySlug) : null, pageId: page?.id ?? null, badge: it.badge ?? null, sortOrder: i } });
      for (const [j, ch] of (it.children ?? []).entries()) {
        await db.menuItem.create({ data: { menuId: m.id, parentId: parent.id, label: ch.label, url: ch.url ?? null, categoryId: ch.categorySlug ? ids.catId.get(ch.categorySlug) : null, sortOrder: j } });
      }
    }
  };
  await menu("header", "Header", [
    { label: "Brands", url: "/brands" },
    { label: "Compare", url: "/compare", badge: "New" },
    { label: "Industries", url: "/industries" },
    { label: "Resources", url: "/blog", children: [{ label: "Buying guides", url: "/blog?category=buying-guides" }, { label: "All articles", url: "/blog" }, { label: "FAQs", url: "/faq" }] },
    { label: "For vendors", pageSlug: "list-your-software" },
  ]);
  await menu("footer.software", "Footer: Software", [
    { label: "Accounting", categorySlug: "accounting-software" }, { label: "HR & Payroll", categorySlug: "hr-software" }, { label: "CRM", categorySlug: "crm-software" }, { label: "ERP", categorySlug: "erp-software" }, { label: "POS", categorySlug: "pos-software" }, { label: "All categories", url: "/categories" },
  ]);
  await menu("footer.resources", "Footer: Resources", [{ label: "Blog", url: "/blog" }, { label: "Comparisons", url: "/compare" }, { label: "Vendors", url: "/vendors" }, { label: "FAQs", pageSlug: "faq" }]);
  await menu("footer.company", "Footer: Company", [{ label: "About us", pageSlug: "about" }, { label: "Contact", pageSlug: "contact" }, { label: "List your software", pageSlug: "list-your-software" }, { label: "Privacy policy", pageSlug: "privacy-policy" }, { label: "Terms", pageSlug: "terms" }]);

  // Blog
  const author = await db.author.create({ data: { name: "Meera Joshi", slug: "meera-joshi", jobTitle: "Senior Software Advisor", bio: "Meera has helped over 2,000 Indian SMEs choose accounting, HR and ERP software." } });
  const cats = new Map<string, string>();
  for (const [i, c] of [["Buying guides", "buying-guides"], ["HR", "hr"], ["Marketing", "marketing"], ["Accounting", "accounting"]].entries()) {
    cats.set(c[1]!, (await db.blogCategory.create({ data: { name: c[0]!, slug: c[1]!, sortOrder: i } })).id);
  }
  for (const [i, p] of POSTS.entries()) {
    const words = p.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    await db.post.create({
      data: {
        title: p.title, slug: p.slug, type: p.type as "GUIDE" | "ARTICLE", content: p.body, excerpt: p.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180).replace(/\s+\S*$/, "") + "…",
        status: "PUBLISHED", publishedAt: new Date(Date.now() - (i + 1) * 5 * 86_400_000), readingMinutes: Math.max(1, Math.round(words / 220)), authorId: author.id, categoryId: cats.get(p.category),
        software: { create: p.products.map((s) => ({ softwareId: ids.swId.get(s)! })).filter((x) => x.softwareId) },
      },
    });
  }

  // Demo staff for each role (local only), a vendor-portal user, and sample leads.
  if (process.env.NODE_ENV !== "production") {
    const pw = await hash("Demo-Password-2026", ARGON);
    const demo = [["editor@cadgram.local", "Riya (Content Editor)", "CONTENT_EDITOR"], ["catalogue@cadgram.local", "Aman (Product Manager)", "PRODUCT_MANAGER"], ["sales@cadgram.local", "Sana (Sales Manager)", "SALES_MANAGER"], ["analyst@cadgram.local", "Dev (Analyst)", "ANALYST"]] as const;
    for (const [email, name, key] of demo) {
      const role = await db.role.findUniqueOrThrow({ where: { key } });
      await db.user.upsert({ where: { email }, create: { email, name, roleId: role.id, passwordHash: pw }, update: {} });
    }
    const vRole = await db.role.findUniqueOrThrow({ where: { key: "VENDOR" } });
    await db.user.upsert({ where: { email: "vendor@ledgerline.example.com" }, create: { email: "vendor@ledgerline.example.com", name: "Ledgerline Partner", roleId: vRole.id, vendorId: ids.vendorId.get("ledgerline"), passwordHash: pw }, update: {} });

    const sales = await db.user.findUniqueOrThrow({ where: { email: "sales@cadgram.local" } });
    const people = [["Suresh Patel", "Patel Hardware", "Ahmedabad"], ["Lakshmi Menon", "Menon Clinics", "Kochi"], ["Imran Qureshi", "Qureshi Logistics", "Lucknow"], ["Divya Sinha", "Sinha Interiors", "Patna"], ["Harpreet Gill", "Gill Agro", "Ludhiana"], ["Tanvi Desai", "Desai Studio", "Mumbai"], ["Manoj Pillai", "Pillai Constructions", "Thiruvananthapuram"], ["Ayesha Siddiqui", "Bloom Bakery", "Hyderabad"]] as const;
    const statuses = ["NEW", "NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "WON", "LOST", "NEW"] as const;
    const slugs = [...ids.swId.keys()];
    for (let i = 0; i < 40; i++) {
      const who = people[i % people.length]!;
      const sw = slugs[(i * 5) % slugs.length]!;
      const created = new Date(Date.now() - ((i * 17) % 28) * 86_400_000 - i * 3_600_000);
      const status = statuses[i % statuses.length]!;
      const swRow = await db.software.findUniqueOrThrow({ where: { slug: sw }, select: { id: true, vendorId: true } });
      await db.lead.create({
        data: {
          referenceNo: `CG-DEMO${String(i).padStart(3, "0")}`, name: who[0], email: `${slugify(who[0])}@example.in`, phone: `+9198${String(76543210 + i * 1013).slice(0, 8)}`, company: who[1], city: who[2], companySize: ["1–10", "11–50", "51–200"][i % 3],
          message: "Looking for pricing and a demo for our team.", source: (["PRODUCT_PAGE", "CATEGORY_PAGE", "COMPARE_PAGE", "GET_ADVICE"] as const)[i % 4]!, status, assignedToId: i % 3 ? sales.id : null, vendorId: swRow.vendorId, consent: true, createdAt: created,
          nextFollowUpAt: status === "CONTACTED" || status === "QUALIFIED" ? new Date(Date.now() + ((i % 5) - 2) * 86_400_000) : null,
          software: { create: [{ softwareId: swRow.id }] },
          activities: { create: [{ type: "CREATED", toValue: "PRODUCT_PAGE", createdAt: created }, ...(status !== "NEW" ? [{ type: "STATUS_CHANGED" as const, fromValue: "NEW", toValue: status, actorId: sales.id }] : [])] },
        },
      });
      await db.software.update({ where: { id: swRow.id }, data: { enquiryCount: { increment: 1 } } });
      const day = new Date(created.toISOString().slice(0, 10));
      await db.softwareDailyStat.upsert({ where: { softwareId_date: { softwareId: swRow.id, date: day } }, create: { softwareId: swRow.id, date: day, enquiries: 1, views: 20 + i }, update: { enquiries: { increment: 1 }, views: { increment: 20 + i } } });
    }
    console.log("✓ demo users (password Demo-Password-2026), vendor portal user vendor@ledgerline.example.com, 40 sample leads");
  }
  console.log("✓ homepage, pages, menus, banners, FAQs, testimonials, blog");
}

/** Local demo accounts for each vendor role (Ledgerline). Safe to re-run; never in production. */
async function seedVendorDemoUsers() {
  if (process.env.NODE_ENV === "production" || process.env.SEED_SAMPLE_DATA === "false") return;
  const vendor = await db.vendor.findUnique({ where: { slug: "ledgerline" }, select: { id: true } });
  if (!vendor) return;
  const pw = await hash("Demo-Password-2026", ARGON);
  const people = [
    ["vendor@ledgerline.example.com", "Ledgerline Partner", "VENDOR"],
    ["editor@ledgerline.example.com", "Ledgerline Editor", "VENDOR_EDITOR"],
    ["viewer@ledgerline.example.com", "Ledgerline Viewer", "VENDOR_VIEWER"],
  ] as const;
  for (const [email, name, key] of people) {
    const role = await db.role.findUniqueOrThrow({ where: { key } });
    await db.user.upsert({ where: { email }, create: { email, name, roleId: role.id, vendorId: vendor.id, passwordHash: pw }, update: {} });
  }
  console.log("✓ vendor demo users (Vendor Admin, Vendor Editor, Vendor Viewer)");
  const buyerRole = await db.role.findUniqueOrThrow({ where: { key: "BUYER" } });
  await db.user.upsert({ where: { email: "buyer@cadgram.example.com" }, create: { email: "buyer@cadgram.example.com", name: "Demo Buyer", roleId: buyerRole.id, passwordHash: pw, status: "ACTIVE" }, update: {} });
  console.log("✓ demo buyer buyer@cadgram.example.com (password Demo-Password-2026)");
}

/** Starter classifications (professions, use cases, platforms…). Only adds what's missing. */
async function seedTaxonomies() {
  let added = 0;
  for (const kind of TAXONOMY_KINDS) {
    const res = await db.taxonomyTerm.createMany({ data: STARTER_TERMS[kind].map((name, i) => ({ kind, name, slug: slugifyTerm(name), sortOrder: i })), skipDuplicates: true });
    added += res.count;
  }
  console.log(`✓ classifications (${added} new terms)`);
}

/** Tags demo products that have no classifications yet, from their category, deployment and price. */
async function seedProductTerms() {
  const terms = await db.taxonomyTerm.findMany({ select: { id: true, kind: true, slug: true } });
  const id = (kind: TaxonomyKind, name: string) => terms.find((t) => t.kind === kind && t.slug === slugifyTerm(name))?.id;
  const products = await db.software.findMany({
    where: { terms: { none: {} } },
    select: { id: true, deployment: true, pricingModel: true, startingPrice: true, priceUnit: true, primaryCategory: { select: { slug: true } } },
  });
  const BY_CATEGORY: [RegExp, string[], string[], string[]][] = [
    [/account|gst|invoic|expense/, ["Accounting", "GST Billing"], ["Accountant", "Chartered Accountant"], ["GST Returns", "E-invoicing"]],
    [/hr|payroll|recruit|attendance/, ["Payroll", "Recruitment"], ["HR Manager"], ["Role-based Access"]],
    [/crm|sales|marketing/, ["Sales Pipeline"], ["Sales Manager"], ["API Access"]],
    [/project|task|collab/, ["Project Management"], ["Project Manager"], ["Cloud Collaboration"]],
    [/support|helpdesk|ticket/, ["Customer Support"], ["Sales Manager"], ["API Access"]],
    [/inventory|pos|retail|erp/, ["Inventory Management"], ["Store Owner"], ["Offline Mode"]],
  ];
  const rows: { softwareId: string; termId: string }[] = [];
  for (const p of products) {
    const names: [TaxonomyKind, string][] = [];
    const d = new Set(p.deployment);
    if (d.has("CLOUD")) names.push(["DEPLOYMENT_MODEL", "Cloud / SaaS"], ["PLATFORM", "Web"], ["PLATFORM", "Web Browser"], ["OPERATING_SYSTEM", "Web"], ["FEATURE", "Cloud Collaboration"]);
    if (d.has("DESKTOP")) names.push(["DEPLOYMENT_MODEL", "Desktop"], ["PLATFORM", "Windows"], ["OPERATING_SYSTEM", "Windows"]);
    if (d.has("ON_PREMISE")) names.push(["DEPLOYMENT_MODEL", "On-premise"]);
    if (d.has("HYBRID")) names.push(["DEPLOYMENT_MODEL", "Hybrid"]);
    if (d.has("MOBILE")) names.push(["PLATFORM", "Android"], ["PLATFORM", "iOS"], ["FEATURE", "Mobile App"]);
    const lic: Record<string, string> = { FREE: "Free", FREEMIUM: "Freemium", SUBSCRIPTION: "Subscription", ONE_TIME: "Perpetual", QUOTE_BASED: "Confirm with vendor", USAGE_BASED: "Subscription" };
    names.push(["LICENSING_MODEL", lic[p.pricingModel] ?? "Confirm with vendor"]);
    const price = p.startingPrice === null ? null : Number(p.startingPrice);
    const yearly = price === null ? null : /month/i.test(p.priceUnit ?? "") ? price * 12 : price;
    if (p.pricingModel === "FREE" || p.pricingModel === "FREEMIUM" || yearly === 0) names.push(["BUDGET_RANGE", "Free"]);
    else if (yearly !== null) names.push(["BUDGET_RANGE", yearly < 10_000 ? "Under ₹10,000" : yearly < 50_000 ? "₹10,000 – ₹50,000" : yearly < 200_000 ? "₹50,000 – ₹2,00,000" : "Above ₹2,00,000"]);
    names.push(["CUSTOMER_TYPE", "Small Business"], ["CUSTOMER_TYPE", "Professional Teams"], ["FEATURE", "Reports & Dashboards"]);
    if (p.pricingModel === "QUOTE_BASED" || (yearly ?? 0) >= 50_000) names.push(["CUSTOMER_TYPE", "Enterprise"]);
    const cat = p.primaryCategory?.slug ?? "";
    for (const [re, uses, profs, feats] of BY_CATEGORY) {
      if (!re.test(cat)) continue;
      uses.forEach((u) => names.push(["USE_CASE", u]));
      profs.forEach((u) => names.push(["PROFESSION", u]));
      feats.forEach((u) => names.push(["FEATURE", u]));
    }
    for (const termId of new Set(names.map(([k, n]) => id(k, n)).filter((x): x is string => Boolean(x)))) rows.push({ softwareId: p.id, termId });
  }
  if (rows.length) await db.softwareTerm.createMany({ data: rows, skipDuplicates: true });
  console.log(`✓ classified ${products.length} products`);
}

/** India (plus UAE and Saudi Arabia) country → state → city locations for geo pages. Adds what's missing. */
async function seedGeo() {
  let added = 0;
  const idOf = new Map((await db.geoLocation.findMany({ select: { id: true, slug: true } })).map((l) => [l.slug, l.id]));
  for (const loc of GEO_STARTER) {
    if (idOf.has(loc.slug)) continue;
    const created = await db.geoLocation.create({ data: { name: loc.name, slug: loc.slug, level: loc.level, parentId: loc.parent ? idOf.get(loc.parent) ?? null : null, priority: loc.priority ?? 0 } });
    idOf.set(loc.slug, created.id);
    added++;
  }
  console.log(`✓ geo locations (${added} new)`);
}

/**
 * Demo CAD catalogue (fictional brands) so classification pages, price comparisons, search suggestions
 * and geo pages have real content. Every step only adds what's missing, so it's safe to re-run.
 */
async function seedCadDemo() {
  if (process.env.NODE_ENV === "production") return;
  // Category tree
  let root = await db.category.findUnique({ where: { slug: CAD_CATEGORIES.root.slug } });
  if (!root) root = await db.category.create({ data: { ...CAD_CATEGORIES.root, depth: 0, path: "/", sortOrder: 50 } });
  const catId = new Map<string, string>([[root.slug, root.id]]);
  for (const [i, c] of CAD_CATEGORIES.children.entries()) {
    const found = await db.category.findUnique({ where: { slug: c.slug } });
    catId.set(c.slug, (found ?? (await db.category.create({ data: { ...c, icon: CAD_CATEGORIES.root.icon, parentId: root.id, depth: 1, path: `/${root.id}/`, sortOrder: i } }))).id);
  }

  // Vendors
  const vendorId = new Map<string, string>();
  for (const v of CAD_VENDORS) {
    const found = await db.vendor.findUnique({ where: { slug: v.slug } });
    if (found) { vendorId.set(v.slug, found.id); continue; }
    const logo = await makeLogo(`vendor-${v.slug}`, v.name, v.color);
    const created = await db.vendor.create({
      data: {
        name: v.name, slug: v.slug, city: v.city, country: "India", foundedYear: v.founded, employeeRange: v.size, website: `https://${v.slug}.example.com`, email: `sales@${v.slug}.example.com`,
        description: `${v.name} builds design and engineering software from ${v.city}. Founded in ${v.founded}, the team of ${v.size} people works with architects, engineers and manufacturers across India. (Demo vendor.)`,
        verification: "VERIFIED", verifiedAt: new Date(), canPublish: true, logoId: logo?.id,
      },
    });
    vendorId.set(v.slug, created.id);
  }

  // Products
  const terms = await db.taxonomyTerm.findMany({ select: { id: true, kind: true, slug: true } });
  const termId = (kind: string, name: string) => terms.find((t) => t.kind === kind && t.slug === slugifyTerm(name))?.id;
  const swId = new Map<string, string>();
  const created: string[] = [];
  for (const [n, p] of CAD_PRODUCTS.entries()) {
    const slug = slugify(p.name);
    const found = await db.software.findUnique({ where: { slug }, select: { id: true } });
    if (found) { swId.set(slug, found.id); continue; }
    const logo = await makeLogo(slug, p.name, p.color);
    const flags = new Set(p.flags ?? []);
    const sw = await db.software.create({
      data: {
        name: p.name, slug, tagline: p.tagline, status: "PUBLISHED", publishedAt: new Date(Date.now() - (n + 1) * 86_400_000), vendorId: vendorId.get(p.vendor)!, primaryCategoryId: catId.get(p.category)!, logoId: logo?.id,
        shortDescription: `${p.tagline}. ${p.features.slice(0, 2).map(([t]) => t).join(" and ")}.`,
        description: `<p>${p.name} is ${p.tagline.charAt(0).toLowerCase()}${p.tagline.slice(1)}.</p><h2>Key capabilities</h2><ul>${p.features.map(([t, d]) => `<li><strong>${t}.</strong> ${d}</li>`).join("")}</ul><p><em>Demo listing — brand, product and prices are fictional.</em></p>`,
        websiteUrl: `https://${slug}.example.com`, pricingModel: p.pricing, startingPrice: p.price, priceUnit: p.unit || null, priceIncludesGst: false, hasFreeTrial: Boolean(p.trial), hasFreeVersion: p.pricing === "FREE" || p.pricing === "FREEMIUM",
        deployment: p.deployment, isFeatured: flags.has("featured"), isPopular: flags.has("popular"), isTrending: flags.has("trending"), isRecommended: flags.has("recommended"),
        viewCount: 400 + ((n * 211) % 2400),
        categories: { create: [p.category, ...(p.also ?? [])].map((c) => ({ categoryId: catId.get(c)!, isPrimary: c === p.category })) },
        features: { create: p.features.map(([title, description], i) => ({ title, description, sortOrder: i })) },
        plans: { create: p.plans.map((pl, i) => ({ name: pl.name, price: pl.price, billingPeriod: pl.period ?? (pl.price === null ? "CUSTOM" : "MONTHLY"), priceUnit: pl.unit ?? null, features: pl.features, isPopular: Boolean(pl.popular), sortOrder: i })) },
        faqs: { create: [
          { question: `Does ${p.name} open DWG files?`, answer: p.terms.FEATURE?.includes("DWG Support") ? `Yes. ${p.name} reads and writes DWG, so you can exchange drawings with consultants.` : `${p.name} focuses on its own format; ask the vendor about DWG import and export.`, sortOrder: 0 },
          { question: `Is there a free trial of ${p.name}?`, answer: p.trial ? "Yes, a free trial is available. Request it from this page." : p.pricing === "FREE" || p.pricing === "FREEMIUM" ? "You can start for free." : "The vendor offers a guided demo instead of a self-serve trial.", sortOrder: 1 },
          { question: `How much does ${p.name} cost in India?`, answer: p.price ? `Plans start at ₹${p.price.toLocaleString("en-IN")} ${p.unit}. Prices exclude GST.` : p.pricing === "FREE" ? "It's free." : "Pricing is shared on request based on seats and modules.", sortOrder: 2 },
        ] },
        terms: { create: Object.entries(p.terms).flatMap(([kind, names]) => (names ?? []).map((name) => termId(kind, name)).filter((x): x is string => Boolean(x)).map((id) => ({ termId: id }))) },
      },
    });
    swId.set(slug, sw.id);
    created.push(sw.id);
    for (const [i, [rating, title, body, pros, cons, author, role, company]] of p.reviews.entries()) {
      await db.review.create({ data: { softwareId: sw.id, authorName: author, authorRole: role, companyName: company, authorEmail: `${slugify(author)}@example.in`, rating, ratingEase: rating, ratingValue: Math.max(3, rating - 1), ratingSupport: rating, ratingFeatures: rating, title, body, pros, cons, status: "APPROVED", moderatedAt: new Date(), createdAt: new Date(Date.now() - (n * 4 + i + 1) * 86_400_000) } });
    }
  }
  for (const id of created) {
    const agg = await db.review.aggregate({ where: { softwareId: id, status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
    const sw = await db.software.findUniqueOrThrow({ where: { id }, select: { viewCount: true } });
    await db.software.update({ where: { id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all, popularityScore: agg._count._all * 3 + (agg._avg.rating ?? 0) * 2 + Math.log10(1 + sw.viewCount) * 4 } });
    await db.$executeRaw`SELECT refresh_software_search(${id})`;
  }
  // Alternatives within the same primary category
  for (const p of CAD_PRODUCTS) {
    const me = swId.get(slugify(p.name));
    if (!me || !created.includes(me)) continue;
    const same = CAD_PRODUCTS.filter((q) => q !== p && (q.category === p.category || (q.also ?? []).includes(p.category))).slice(0, 4);
    if (same.length) await db.relatedSoftware.createMany({ data: same.map((q, i) => ({ softwareId: me, relatedId: swId.get(slugify(q.name))!, kind: "ALTERNATIVE" as const, sortOrder: i })), skipDuplicates: true });
  }

  // Classification page content (only fills pages nobody has written yet)
  for (const t of CAD_TERM_PAGES) {
    const term = await db.taxonomyTerm.findFirst({ where: { kind: t.kind, slug: slugifyTerm(t.name) } });
    if (!term || term.description) continue;
    await db.taxonomyTerm.update({
      where: { id: term.id },
      data: {
        description: t.description,
        content: t.content ?? null,
        promotedSoftwareId: t.promoted ? swId.get(slugify(t.promoted)) ?? null : null,
        promotedBadge: t.badge ?? null,
        faqs: t.faqs ? (t.faqs.map(([question, answer]) => ({ question, answer })) as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  // A live offer on the promoted product (already "announced", so no emails go out)
  const draftline = swId.get("draftline-2d");
  if (draftline && !(await db.productOffer.findFirst({ where: { softwareId: draftline } }))) {
    await db.productOffer.create({ data: { softwareId: draftline, title: "Festive offer", discount: "20% off the first year", couponCode: "DRAFT20", description: "On Standard and Professional plans bought this month.", terms: "New customers only. Annual billing.", startsAt: new Date(Date.now() - 2 * 86_400_000), endsAt: new Date(Date.now() + 30 * 86_400_000), status: "PUBLISHED", launchNotifiedAt: new Date() } });
  }

  // A guide linked to the 2D products (shows under "Relevant articles")
  if (!(await db.post.findUnique({ where: { slug: "how-to-choose-2d-drafting-software" } }))) {
    const author = await db.author.findFirst();
    const linked = ["draftline-2d", "opensketch", "clouddraft", "axiomcad"].map((s) => swId.get(s)).filter((x): x is string => Boolean(x));
    await db.post.create({
      data: {
        title: "How to choose 2D drafting software in 2026", slug: "how-to-choose-2d-drafting-software", type: "GUIDE", status: "PUBLISHED", publishedAt: new Date(Date.now() - 3 * 86_400_000), readingMinutes: 4, authorId: author?.id ?? null,
        excerpt: "DWG compatibility, licensing and the five things to test in a demo before you buy 2D CAD.",
        content: "<p>Choosing 2D drafting software comes down to three things: <strong>file compatibility</strong>, <strong>licensing</strong> and <strong>how your team works</strong>.</p><h2>1. File compatibility</h2><p>If you exchange DWG files with consultants, test with your own drawings.</p><h2>2. Subscription or perpetual?</h2><p>Subscriptions spread the cost; perpetual licences can be cheaper over five years.</p><h2>3. Desktop or browser?</h2><p>Browser tools such as CloudDraft are great for markups on site; desktop tools are faster for heavy drafting.</p>",
        software: { create: linked.map((softwareId) => ({ softwareId })) },
      },
    });
  }

  // Published geo pages (template text, plus one custom introduction)
  let geo = 0;
  for (const [slug, type, locations] of CAD_GEO_PAGES) {
    const targetId = type === "software" ? swId.get(slug) : vendorId.get(slug);
    if (!targetId) continue;
    for (const loc of locations) {
      const location = await db.geoLocation.findUnique({ where: { slug: loc }, select: { id: true } });
      if (!location) continue;
      const target = type === "software" ? { softwareId: targetId } : { vendorId: targetId };
      if (await db.geoPage.findFirst({ where: { locationId: location.id, ...target } })) continue;
      const custom = slug === "draftline-2d" && loc === "gurugram";
      await db.geoPage.create({
        data: {
          locationId: location.id, ...target, isPublished: true,
          sections: custom ? { introduction: "Design offices across Gurugram — from Cyber City to Sohna Road — use DraftLine 2D for construction drawings that open cleanly with every consultant. Our Gurugram partner offers on-site installation, training in Hindi or English and same-day licence activation." } : {},
        },
      });
      geo++;
    }
  }
  console.log(`✓ CAD demo: ${created.length} new products, ${geo} new geo pages`);
}

/**
 * Brings an existing homepage and header menu up to the marketplace layout once: adds the
 * "How it works" and "Live deals" blocks and a Brands link if they are missing. Safe to re-run.
 */
async function seedSiteRefresh() {
  const home = await db.page.findUnique({ where: { slug: "home" }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
  if (home) {
    const has = (t: string) => home.sections.some((x) => x.type === t);
    const order: { id?: string; type: string }[] = home.sections.map((x) => ({ id: x.id, type: x.type }));
    const after = (anchor: string[], type: string) => {
      const i = order.findIndex((x) => anchor.includes(x.type));
      order.splice(i >= 0 ? i + 1 : order.length, 0, { type });
    };
    // "Latest software insights" (cadgram.com style): rename the old "Buying guides" blog block, or add one.
    const blog = home.sections.find((x) => x.type === "BLOG_POSTS");
    if (blog) {
      const d = (blog.data ?? {}) as Record<string, unknown>;
      if (!d.title || d.title === "Buying guides" || d.title === "Buying guides and articles") {
        await db.pageSection.update({ where: { id: blog.id }, data: { data: { ...d, eyebrow: "Expert guidance", title: "Latest software insights", linkLabel: "Visit the blog", limit: 3, type: d.type ?? "ANY" } as Prisma.InputJsonValue } });
        console.log("✓ homepage: blog section is now “Latest software insights”");
      }
    } else {
      const i = order.findIndex((x) => x.type === "FAQ" || x.type === "LEAD_FORM");
      order.splice(i >= 0 ? i : order.length, 0, { type: "BLOG_POSTS" });
    }
    if (!has("HOW_IT_WORKS")) after(["CATEGORY_GRID", "HERO"], "HOW_IT_WORKS");
    if (!has("DEALS")) after(["SOFTWARE_TABS", "FEATURED_SOFTWARE"], "DEALS");
    if (order.length !== home.sections.length) {
      for (const [i, x] of order.entries()) {
        if (x.id) await db.pageSection.update({ where: { id: x.id }, data: { sortOrder: i } });
        else await db.pageSection.create({ data: { pageId: home.id, type: x.type, sortOrder: i, data: defaultBlockData(x.type as Parameters<typeof defaultBlockData>[0]) as Prisma.InputJsonValue } });
      }
      console.log("✓ homepage: added marketplace blocks");
    }
  }
  const header = await db.menu.findUnique({ where: { key: "header" }, include: { items: { where: { parentId: null }, orderBy: { sortOrder: "asc" } } } });
  // Brands now have their own pages; point an earlier "Brands → /vendors" link at /brands.
  const oldBrands = header?.items.find((i) => i.label === "Brands" && i.url === "/vendors");
  if (oldBrands) {
    await db.menuItem.update({ where: { id: oldBrands.id }, data: { url: "/brands" } });
    console.log("✓ header menu: Brands now links to /brands");
  } else if (header && !header.items.some((i) => i.url === "/brands")) {
    await db.menuItem.updateMany({ where: { menuId: header.id }, data: { sortOrder: { increment: 1 } } });
    await db.menuItem.create({ data: { menuId: header.id, label: "Brands", url: "/brands", sortOrder: 0 } });
    console.log("✓ header menu: added Brands");
  }
}

/**
 * Demo data: one brand per vendor that has products (same name, logo and description), with the
 * vendor's products linked to it, so the brands pages have real content. Products that already
 * have a brand are left alone. Safe to re-run; skipped in production.
 */
const escapeXml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Blog cover (1200×630 PNG): category colours, soft shapes, topic label and the title. */
async function makeCover(slug: string, title: string, label: string, colours: [string, string]) {
  if ((process.env.STORAGE_DRIVER || "local") !== "local") return null;
  const words = title.split(/\s+/);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 26) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  const shown = lines.slice(0, 4);
  if (lines.length > 4) shown[3] = shown[3]!.replace(/\s*\S*$/, "") + "…";
  const size = shown.length > 3 ? 56 : 64;
  const startY = 315 - ((shown.length - 1) * size * 1.18) / 2 + 20;
  const text = shown.map((l, i) => `<text x="80" y="${Math.round(startY + i * size * 1.18)}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" fill="#fff">${escapeXml(l)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colours[0]}"/><stop offset="1" stop-color="${colours[1]}"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <circle cx="1060" cy="110" r="220" fill="#fff" fill-opacity="0.08"/>
    <circle cx="1120" cy="560" r="160" fill="#FF8A00" fill-opacity="0.22"/>
    <rect x="860" y="250" width="240" height="240" rx="36" fill="#fff" fill-opacity="0.07" transform="rotate(12 980 370)"/>
    <rect x="80" y="70" width="${label.length * 16 + 48}" height="44" rx="22" fill="#fff" fill-opacity="0.18"/>
    <text x="102" y="99" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="2" fill="#fff">${escapeXml(label.toUpperCase())}</text>
    ${text}
    <text x="80" y="570" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#fff" fill-opacity="0.75">Cadgram · Software insights</text>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const key = `seed/blog-${slug}.png`;
  const file = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  return db.mediaAsset.upsert({
    where: { storageKey: key },
    create: { storageKey: key, provider: "local", url: `/uploads/${key}`, filename: `blog-${slug}.png`, mimeType: "image/png", sizeBytes: buf.byteLength, width: 1200, height: 630, alt: title },
    update: { sizeBytes: buf.byteLength },
  });
}

/**
 * Demo blog: topic descriptions, full-length articles with covers and tags, and more posts so every
 * topic and post type has content. Existing posts are only filled in while they still have the short
 * demo text (anything you've written yourself is left alone). Safe to re-run; skipped in production.
 */
async function seedBlogContent() {
  if (process.env.NODE_ENV === "production") return;
  const catId = new Map<string, string>();
  for (const [i, c] of BLOG_CATEGORIES.entries()) {
    const existing = await db.blogCategory.findUnique({ where: { slug: c.slug } });
    const row = existing
      ? await db.blogCategory.update({ where: { id: existing.id }, data: existing.description ? {} : { description: c.description } })
      : await db.blogCategory.create({ data: { name: c.name, slug: c.slug, description: c.description, sortOrder: 10 + i } });
    catId.set(c.slug, row.id);
  }
  const author =
    (await db.author.findFirst({ orderBy: { name: "asc" } })) ??
    (await db.author.create({ data: { name: "Meera Joshi", slug: "meera-joshi", jobTitle: "Senior Software Advisor", bio: "Meera has helped over 2,000 Indian SMEs choose accounting, HR and ERP software." } }));
  let created = 0;
  let filled = 0;
  for (const p of DEMO_POSTS) {
    const words = p.content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(2, Math.round(words / 200));
    const label = BLOG_CATEGORIES.find((c) => c.slug === p.category)?.name ?? "Insights";
    const software = (await db.software.findMany({ where: { slug: { in: p.products } }, select: { id: true } })).map((s) => s.id);
    const existing = await db.post.findUnique({ where: { slug: p.slug }, select: { id: true, content: true, coverId: true } });
    if (existing && existing.content.length > 1500) continue; // already real content
    const cover = existing?.coverId ? null : await makeCover(p.slug, p.title, label, COVER_COLOURS[p.category] ?? ["#0F766E", "#22B39A"]);
    const data = {
      title: p.title,
      type: p.type,
      content: p.content.replace(/\n/g, ""),
      excerpt: p.excerpt,
      readingMinutes,
      isFeatured: Boolean(p.featured),
      categoryId: catId.get(p.category) ?? null,
      ...(cover ? { coverId: cover.id } : {}),
    };
    const post = existing
      ? await db.post.update({ where: { id: existing.id }, data })
      : await db.post.create({ data: { ...data, slug: p.slug, status: "PUBLISHED", publishedAt: new Date(Date.now() - p.daysAgo * 86_400_000), authorId: author.id } });
    if (existing) filled++;
    else created++;
    await db.postTag.deleteMany({ where: { postId: post.id } });
    for (const name of p.tags) {
      const tag = await db.blogTag.upsert({ where: { slug: slugify(name) }, create: { slug: slugify(name), name }, update: {} });
      await db.postTag.create({ data: { postId: post.id, tagId: tag.id } });
    }
    for (const softwareId of software) {
      await db.postSoftware.upsert({ where: { postId_softwareId: { postId: post.id, softwareId } }, create: { postId: post.id, softwareId }, update: {} });
    }
  }
  console.log(`✓ blog: ${created} posts added, ${filled} demo posts filled in with full articles and covers`);
}

/**
 * Demo product-page content: editorial pros/cons, "best for / not ideal for" and answered buyer
 * questions. Products that already have pros, or questions, are left alone. Skipped in production.
 */
async function seedProductExtras() {
  if (process.env.NODE_ENV === "production") return;
  const asker = await db.user.findUnique({ where: { email: "buyer@cadgram.example.com" }, select: { id: true } });
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@cadgram.local").toLowerCase();
  const answerer = await db.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
  let editorial = 0;
  let asked = 0;
  for (const x of PRODUCT_EXTRAS) {
    const sw = await db.software.findUnique({ where: { slug: x.slug }, select: { id: true, pros: true, _count: { select: { questions: true } } } });
    if (!sw) continue;
    if (!sw.pros.length) {
      await db.software.update({ where: { id: sw.id }, data: { pros: x.pros, cons: x.cons, bestFor: x.bestFor, notIdealFor: x.notIdealFor } });
      editorial++;
    }
    if (!sw._count.questions) {
      for (const [i, q] of x.questions.entries()) {
        const asked_at = new Date(Date.now() - (20 - i * 6) * 86_400_000);
        await db.productQuestion.create({
          data: { softwareId: sw.id, userId: asker?.id ?? null, authorName: q.by, question: q.q, answer: q.a, status: "APPROVED", answeredById: answerer?.id ?? null, answeredAt: new Date(asked_at.getTime() + 86_400_000), createdAt: asked_at },
        });
        asked++;
      }
    }
  }
  console.log(`✓ products: editorial review added to ${editorial}, ${asked} answered questions added`);
}

async function seedBrandsFromVendors() {
  if (process.env.NODE_ENV === "production") return;
  const vendors = await db.vendor.findMany({
    where: { isActive: true, software: { some: {} } },
    select: { id: true, name: true, slug: true, description: true, website: true, logoId: true },
  });
  let created = 0;
  let linked = 0;
  for (const v of vendors) {
    let brand = await db.brand.findFirst({ where: { OR: [{ slug: v.slug }, { vendorId: v.id, name: v.name }] } });
    if (!brand) {
      brand = await db.brand.create({
        data: { name: v.name, slug: v.slug, description: v.description, website: v.website, logoId: v.logoId, vendorId: v.id, isActive: true },
      });
      created++;
    }
    const r = await db.software.updateMany({ where: { vendorId: v.id, brandId: null }, data: { brandId: brand.id } });
    linked += r.count;
  }
  console.log(`✓ brands: ${created} added from vendors, ${linked} products linked`);
}

/**
 * Designed logos for the demo brands (they are invented companies, so there is no real logo).
 * Replaces only missing logos and the old initials placeholders (seed/…); logos you uploaded
 * yourself are never touched. The vendor behind the brand gets the same logo if it still has
 * a placeholder. Skipped in production and with non-local storage.
 */
async function seedBrandLogos() {
  if (process.env.NODE_ENV === "production" || (process.env.STORAGE_DRIVER || "local") !== "local") return;
  const brands = await db.brand.findMany({
    where: { OR: [{ logoId: null }, { logo: { is: { storageKey: { startsWith: "seed/" } } } }] },
    select: { id: true, name: true, slug: true, vendorId: true, logo: { select: { id: true } } },
  });
  let made = 0;
  for (const b of brands) {
    const { svg } = brandLogoSvg(b.name, b.slug);
    const buf = await sharp(Buffer.from(svg), { density: 192 }).trim({ threshold: 1 }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    const key = `brand-logos/${b.slug}.png`;
    const file = path.join(process.cwd(), "public", "uploads", key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buf);
    const data = { provider: "local", url: `/uploads/${key}`, filename: `${b.slug}.png`, mimeType: "image/png", sizeBytes: buf.byteLength, width: meta.width ?? null, height: meta.height ?? null, alt: `${b.name} logo` };
    const asset = await db.mediaAsset.upsert({ where: { storageKey: key }, create: { storageKey: key, ...data }, update: data });
    await db.brand.update({ where: { id: b.id }, data: { logoId: asset.id } });
    if (b.vendorId) {
      await db.vendor.updateMany({
        where: { id: b.vendorId, OR: [{ logoId: null }, { logo: { is: { storageKey: { startsWith: "seed/" } } } }] },
        data: { logoId: asset.id },
      });
    }
    made++;
  }
  console.log(`✓ brand logos: ${made} designed`);
}

/**
 * Sample reseller partners (fictional companies): cities served, authorised products, logos,
 * two reseller plans, a demo Reseller Admin login and the existing enquiries for their products.
 * Safe to re-run: existing resellers, plans and links are left as they are.
 */
const RESELLERS = [
  { name: "Shree Tech Solutions", slug: "shree-tech-solutions", city: "New Delhi", state: "Delhi", cities: ["Delhi", "Gurugram", "Noida", "Faridabad", "Ghaziabad"], founded: 2008, size: "51–200", verified: "VERIFIED", level: "Gold Partner", categories: ["accounting-software", "inventory-management-software", "pos-software"], vendors: [], about: "Delhi NCR's accounting and billing software partner since 2008. We help traders, distributors and retailers choose, install and run GST billing, inventory and POS software, with on-site training and same-day support." },
  { name: "Pragati Softcare", slug: "pragati-softcare", city: "Mumbai", state: "Maharashtra", cities: ["Mumbai", "Thane", "Navi Mumbai", "Pune"], founded: 2012, size: "11–50", verified: "VERIFIED", level: "Silver Partner", categories: ["hr-software", "crm-software", "collaboration-software"], vendors: [], about: "HR, payroll and CRM implementation partner for growing companies in Mumbai and Pune. Data migration, statutory setup and user training included." },
  { name: "Dakshin IT Services", slug: "dakshin-it-services", city: "Bengaluru", state: "Karnataka", cities: ["Bengaluru", "Chennai", "Hyderabad", "Mysuru", "Coimbatore"], founded: 2010, size: "51–200", verified: "VERIFIED", level: "Premier Partner", categories: ["cyber-security-software", "erp-software", "project-management-software"], vendors: [], about: "South India's IT solutions partner for ERP rollouts, endpoint security and project management tools, with support teams in five cities." },
  { name: "CADline Design Systems", slug: "cadline-design-systems", city: "Pune", state: "Maharashtra", cities: ["Pune", "Mumbai", "Nashik", "Ahmedabad", "Surat"], founded: 2006, size: "11–50", verified: "VERIFIED", level: "Authorised Training Centre", categories: [], vendors: ["vectrix-systems", "planora-technologies", "axiom-cad-labs", "formwise-software", "opensketch-foundation"], about: "CAD and design software reseller and training centre for architects, engineers and manufacturers. Licences, installation and certified courses." },
  { name: "Purvi Computers", slug: "purvi-computers", city: "Kolkata", state: "West Bengal", cities: ["Kolkata", "Howrah", "Bhubaneswar", "Guwahati"], founded: 2015, size: "11–50", verified: "PENDING", level: null, categories: ["accounting-software", "healthcare-software", "school-management-software"], vendors: [], about: "Software sales and support for clinics, schools and small businesses across East India." },
  { name: "Marudhar Software Hub", slug: "marudhar-software-hub", city: "Jaipur", state: "Rajasthan", cities: ["Jaipur", "Udaipur", "Jodhpur", "Ajmer"], founded: 2018, size: "1–10", verified: "UNVERIFIED", level: null, categories: ["pos-software", "marketing-software"], vendors: [], about: "Billing, POS and WhatsApp marketing software for shops and restaurants in Rajasthan." },
] as const;

async function seedResellers() {
  if (process.env.NODE_ENV === "production" || process.env.SEED_SAMPLE_DATA === "false") return;
  let created = 0;
  let links = 0;
  for (const r of RESELLERS) {
    const existing = await db.vendor.findUnique({ where: { slug: r.slug }, select: { id: true, kind: true } });
    if (existing && existing.kind !== "RESELLER") continue; // slug taken by a vendor: leave it alone
    const reseller = existing ?? (await db.vendor.create({
      data: {
        kind: "RESELLER", name: r.name, slug: r.slug, legalName: `${r.name} Pvt Ltd`, description: r.about,
        website: `https://${r.slug.replace(/-/g, "")}.example.com`, email: `sales@${r.slug.replace(/-/g, "")}.example.com`, phone: "+91 98100 00000",
        city: r.city, state: r.state, country: "India", foundedYear: r.founded, employeeRange: r.size, serviceCities: [...r.cities],
        verification: r.verified, verifiedAt: r.verified === "VERIFIED" ? new Date() : null, receivesLeads: true,
      },
    }));
    if (!existing) created++;

    // Logo (designed, same style as the demo brands) for the local disk storage used in development.
    if ((process.env.STORAGE_DRIVER || "local") === "local") {
      const current = await db.vendor.findUnique({ where: { id: reseller.id }, select: { logoId: true } });
      if (!current?.logoId) {
        const { svg } = brandLogoSvg(r.name, r.slug);
        const buf = await sharp(Buffer.from(svg), { density: 192 }).trim({ threshold: 1 }).png().toBuffer();
        const meta = await sharp(buf).metadata();
        const key = `brand-logos/${r.slug}.png`;
        const file = path.join(process.cwd(), "public", "uploads", key);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, buf);
        const data = { provider: "local", url: `/uploads/${key}`, filename: `${r.slug}.png`, mimeType: "image/png", sizeBytes: buf.byteLength, width: meta.width ?? null, height: meta.height ?? null, alt: `${r.name} logo` };
        const asset = await db.mediaAsset.upsert({ where: { storageKey: key }, create: { storageKey: key, ...data }, update: data });
        await db.vendor.update({ where: { id: reseller.id }, data: { logoId: asset.id } });
      }
    }

    // Authorised products: published products in their categories (incl. subcategories) or from their vendors.
    const products = await db.software.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          ...(r.categories.length ? [{ categories: { some: { category: { OR: [{ slug: { in: [...r.categories] } }, { parent: { slug: { in: [...r.categories] } } }] } } } }] : []),
          ...(r.vendors.length ? [{ vendor: { slug: { in: [...r.vendors] } } }] : []),
        ],
      },
      orderBy: { popularityScore: "desc" },
      take: 8,
      select: { id: true },
    });
    for (const [i, p] of products.entries()) {
      const res = await db.resellerProduct.upsert({
        where: { resellerId_softwareId: { resellerId: reseller.id, softwareId: p.id } },
        create: { resellerId: reseller.id, softwareId: p.id, partnerLevel: i < 3 ? r.level : null },
        update: {},
      });
      if (res.createdAt.getTime() > Date.now() - 60_000) links++;
    }
    // Earlier enquiries for those products show up in the reseller's portal too.
    const leads = await db.lead.findMany({ where: { status: { not: "SPAM" }, software: { some: { softwareId: { in: products.map((p) => p.id) } } } }, select: { id: true, createdAt: true } });
    if (leads.length) await db.leadReseller.createMany({ data: leads.map((l) => ({ leadId: l.id, resellerId: reseller.id, createdAt: l.createdAt })), skipDuplicates: true });
  }

  // Reseller plans (only if none exist yet).
  if ((await db.vendorPlan.count({ where: { audience: "RESELLER" } })) === 0) {
    await db.vendorPlan.createMany({
      data: [
        { audience: "RESELLER", name: "Reseller Quarterly", description: "Try it for three months", pricePaise: 399900, interval: "QUARTER", features: ["Lead export (CSV)"], sortOrder: 0 },
        { audience: "RESELLER", name: "Reseller Half-yearly", description: "Six months of unlocked leads", pricePaise: 699900, interval: "HALF_YEAR", features: ["Lead export (CSV)", "Save over quarterly"], sortOrder: 1 },
        { audience: "RESELLER", name: "Reseller Annual", description: "Best value for busy partners", pricePaise: 1199900, interval: "YEAR", features: ["Lead export (CSV)", "Lowest price per month"], isFeatured: true, sortOrder: 2 },
      ],
    });
    console.log("✓ reseller plans: Quarterly, Half-yearly, Annual");
  }

  // Demo Reseller Admin login for Shree Tech Solutions.
  const shree = await db.vendor.findUnique({ where: { slug: "shree-tech-solutions" }, select: { id: true, kind: true } });
  const role = await db.role.findUnique({ where: { key: "VENDOR_RESELLER" } });
  if (shree?.kind === "RESELLER" && role) {
    const pw = await hash("Demo-Password-2026", ARGON);
    await db.user.upsert({ where: { email: "reseller@shreetech.example.com" }, create: { email: "reseller@shreetech.example.com", name: "Shree Tech Partner", roleId: role.id, vendorId: shree.id, passwordHash: pw }, update: {} });
    console.log("✓ demo reseller reseller@shreetech.example.com (password Demo-Password-2026)");
  }
  console.log(`✓ resellers: ${created} added, ${links} authorised products linked`);
}

/** Sample company & contact details for local testing: fills only fields that are still empty. */
const SITE_SAMPLES = {
  tagline: "Find, compare and buy the right business software",
  legalName: "Cadgram Technologies Pvt. Ltd.",
  contactEmail: "hello@cadgram.example",
  salesEmail: "sales@cadgram.example",
  contactPhone: "+91 80000 00000",
  whatsappNumber: "+91 80000 00001",
  address: "4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103, India",
  businessHours: "Mon–Sat, 9:30 am – 7:00 pm IST",
  adminName: "Cadgram",
} as const;
const SOCIAL_SAMPLES = {
  linkedin: "https://www.linkedin.com/company/cadgram-example",
  x: "https://x.com/cadgram_example",
  facebook: "https://www.facebook.com/cadgram.example",
  instagram: "https://www.instagram.com/cadgram.example",
  youtube: "https://www.youtube.com/@cadgram-example",
};

async function seedSiteSamples() {
  if (process.env.NODE_ENV === "production" || process.env.SEED_SAMPLE_DATA === "false") return;
  const row = await db.setting.findUnique({ where: { key: "site" } });
  const site = { ...((row?.value ?? {}) as Record<string, unknown>) };
  const filled: string[] = [];
  for (const [k, v] of Object.entries(SITE_SAMPLES)) {
    if (!site[k]) { site[k] = v; filled.push(k); }
  }
  const social = { ...((site.social ?? {}) as Record<string, string>) };
  for (const [k, v] of Object.entries(SOCIAL_SAMPLES)) {
    if (!social[k]) { social[k] = v; filled.push(`social.${k}`); }
  }
  site.social = social;
  if (!filled.length) return;
  const value = settingSchemas.site.parse(site) as unknown as Prisma.InputJsonValue;
  await db.setting.upsert({ where: { key: "site" }, create: { key: "site", value }, update: { value } });
  console.log(`✓ sample company & contact details: ${filled.join(", ")}`);
}

async function main() {
  await seedAccessControl();
  await seedAdmin();
  await seedSettings();
  await seedSiteSamples();
  await seedGeo();
  if (process.env.SEED_SAMPLE_DATA === "false") return;
  await seedTaxonomies();
  if ((await db.software.count()) > 0) {
    console.log("• Catalogue already has data — sample content skipped");
  } else {
    const ids = await seedCatalogue();
    await seedContent(ids);
  }
  await seedCadDemo();
  await seedBrandsFromVendors();
  await seedBrandLogos();
  await seedBlogContent();
  await seedProductExtras();
  await seedSiteRefresh();
  await seedProductTerms();
  await seedVendorDemoUsers();
  await seedResellers();
}

/** Tells a running dev/production server to drop cached pages, so seeded changes show at once. */
async function refreshRunningSite() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* env already set */
  }
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  if (!process.env.CRON_SECRET) return;
  try {
    const res = await fetch(`${base}/api/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(8000) });
    if (res.ok) console.log(`✓ site cache refreshed (${base})`);
  } catch {
    console.log("• site isn't running — nothing to refresh");
  }
}

main()
  .then(refreshRunningSite)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
