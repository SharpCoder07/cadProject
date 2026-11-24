/**
 * Fills the "Sections below the table" of existing comparisons (Admin › Comparisons) with sample
 * content built from each comparison's real products: overview, key facts table, screenshot,
 * image + text, demo video (when a product has one), FAQs and a call to action.
 *
 *   npm run db:demo-comparisons            # only comparisons that have no sections yet
 *   npm run db:demo-comparisons -- --force # replace the sections of every comparison
 *   npm run db:demo-comparisons -- alibre-design-vs-altair-inspire
 *       # a comparison you opened on the website (/compare/a-vs-b) that has no admin entry yet:
 *       # creates a published comparison for those products (same address) with sample sections
 *
 * Edit or delete the sample sections afterwards in Admin › Comparisons.
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const db = new PrismaClient();
const force = process.argv.includes("--force");
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--")).map((a) => a.replace(/^.*\/compare\//, "").replace(/[/?#].*$/, "").trim().toLowerCase()).filter(Boolean);

/** Creates a published comparison for /compare/a-vs-b (when none exists) so it can hold sections. */
async function ensureComparison(path: string) {
  const parts = path.split("-vs-");
  const found = await db.software.findMany({ where: { slug: { in: parts }, status: "PUBLISHED" }, select: { id: true, slug: true, name: true } });
  const products = parts.map((p) => found.find((f) => f.slug === p)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (products.length !== parts.length || products.length < 2) {
    console.log(`✗ ${path}: couldn't find all these published products (${parts.filter((p) => !found.some((f) => f.slug === p)).join(", ") || "need at least two"})`);
    return null;
  }
  products.sort((a, b) => a.slug.localeCompare(b.slug));
  const slug = products.map((p) => p.slug).join("-vs-");
  const existing = await db.comparisonPage.findMany({ where: { items: { every: { softwareId: { in: products.map((p) => p.id) } } } }, select: { id: true, slug: true, _count: { select: { items: true } } } });
  const same = existing.find((e) => e._count.items === products.length) ?? (await db.comparisonPage.findUnique({ where: { slug }, select: { id: true, slug: true, _count: { select: { items: true } } } }));
  if (same) {
    await db.comparisonPage.update({ where: { id: same.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    console.log(`· ${path}: using the existing comparison /compare/${same.slug} (published)`);
    return same.id;
  }
  const created = await db.comparisonPage.create({
    data: { slug, title: products.map((p) => p.name).join(" vs "), status: "PUBLISHED", publishedAt: new Date(), items: { create: products.map((p, i) => ({ softwareId: p.id, sortOrder: i })) } },
  });
  console.log(`+ ${path}: created a published comparison at /compare/${slug}`);
  return created.id;
}
const id = () => Math.random().toString(36).slice(2, 10);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inr = (v: Prisma.Decimal | null) => (v === null ? "On request" : Number(v) === 0 ? "Free" : `₹${Number(v).toLocaleString("en-IN")}`);
const words = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const VIDEO = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com)\//;

async function main() {
  const contact = await db.page.findFirst({ where: { slug: { in: ["contact", "contact-us"] } }, select: { slug: true } });
  const ctaUrl = contact ? `/${contact.slug}` : "/categories";
  const only: string[] = [];
  for (const w of wanted) {
    const idOf = await ensureComparison(w);
    if (idOf) only.push(idOf);
  }
  if (wanted.length && !only.length) return;
  const pages = await db.comparisonPage.findMany({
    where: only.length ? { id: { in: only } } : undefined,
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          software: {
            select: {
              name: true, slug: true, tagline: true, shortDescription: true, pricingModel: true, startingPrice: true, priceUnit: true,
              hasFreeTrial: true, hasFreeVersion: true, deployment: true, ratingAvg: true, ratingCount: true, demoVideoUrl: true,
              vendor: { select: { name: true } },
              primaryCategory: { select: { name: true } },
              logo: { select: { id: true, url: true } },
              media: { orderBy: { sortOrder: "asc" }, select: { kind: true, videoUrl: true, caption: true, media: { select: { id: true, url: true, alt: true } } } },
            },
          },
        },
      },
    },
  });

  let filled = 0;
  for (const page of pages) {
    const existing = Array.isArray(page.sections) ? page.sections.length : 0;
    if (existing && !force) {
      console.log(`· ${page.title}: already has ${existing} section(s), skipped (use --force to replace)`);
      continue;
    }
    const products = page.items.map((i) => i.software);
    if (products.length < 2) continue;
    const names = products.map((p) => p.name);
    const title = names.join(" vs ");
    const category = products[0]?.primaryCategory?.name ?? "software";
    const shots = products.flatMap((p) => p.media.filter((m) => m.kind === "SCREENSHOT" && m.media).map((m) => ({ product: p.name, ...m.media!, caption: m.caption })));
    const video = products.map((p) => ({ p, url: p.demoVideoUrl ?? p.media.find((m) => m.kind === "VIDEO" && m.videoUrl)?.videoUrl ?? null })).find((v) => v.url && VIDEO.test(v.url));
    const sideImage = shots[1] ?? (products[1]?.logo ? { product: products[1].name, id: products[1].logo.id, url: products[1].logo.url, alt: `${products[1].name} logo`, caption: null } : null);

    const factsTable = `<table><thead><tr><th></th>${products.map((p) => `<th>${esc(p.name)}</th>`).join("")}</tr></thead><tbody>
<tr><td>Made by</td>${products.map((p) => `<td>${esc(p.vendor?.name ?? "—")}</td>`).join("")}</tr>
<tr><td>Pricing</td>${products.map((p) => `<td>${esc(words(p.pricingModel))}, from ${esc(inr(p.startingPrice))}${p.priceUnit ? ` ${esc(p.priceUnit)}` : ""}</td>`).join("")}</tr>
<tr><td>Free trial</td>${products.map((p) => `<td>${p.hasFreeTrial ? "Yes" : "No"}</td>`).join("")}</tr>
<tr><td>Deployment</td>${products.map((p) => `<td>${esc(p.deployment.map(words).join(", ") || "—")}</td>`).join("")}</tr>
<tr><td>User rating</td>${products.map((p) => `<td>${p.ratingCount ? `${Number(p.ratingAvg).toFixed(1)} / 5 (${p.ratingCount} reviews)` : "Not rated yet"}</td>`).join("")}</tr>
</tbody></table>`;

    const sections: Record<string, unknown>[] = [
      { id: id(), type: "HEADING", hidden: false, heading: `${title}: which one should you choose?`, level: "h2", subtext: `A quick guide to how these ${category.toLowerCase()} tools differ, so you can shortlist the right one for your team.` },
      {
        id: id(), type: "TEXT", hidden: false, heading: "Overview",
        html: products.map((p) => `<h3>${esc(p.name)}</h3><p>${esc(p.shortDescription || p.tagline || `${p.name} is a ${category.toLowerCase()} product${p.vendor ? ` by ${p.vendor.name}` : ""}.`)}</p>`).join("") +
          `<p>Both are popular with Indian businesses. The table above compares every feature side by side; below are the points buyers ask us about most.</p>`,
      },
      { id: id(), type: "TEXT", hidden: false, heading: "Key facts at a glance", html: factsTable },
      ...(shots[0] ? [{ id: id(), type: "IMAGE", hidden: false, heading: `A look at ${shots[0].product}`, imageId: shots[0].id, imageUrl: shots[0].url, alt: shots[0].alt || `${shots[0].product} screenshot`, caption: shots[0].caption ?? `${shots[0].product} — main screen` }] : []),
      ...(sideImage
        ? [{
            id: id(), type: "IMAGE_TEXT", hidden: false, heading: `Where ${sideImage.product} stands out`, imageId: sideImage.id, imageUrl: sideImage.url, alt: sideImage.alt || sideImage.product, imageSide: "right",
            html: `<p>${esc(sideImage.product)} is a strong pick when you need:</p><ul><li>a quick setup with little training</li><li>support from a team in India</li><li>pricing that grows with your business</li></ul><p><em>Sample text — replace it with your own findings.</em></p>`,
          }]
        : []),
      ...(video ? [{ id: id(), type: "VIDEO", hidden: false, heading: `${video.p.name} demo`, url: video.url, caption: `Product walkthrough of ${video.p.name}` }] : []),
      {
        id: id(), type: "FAQ", hidden: false, heading: "Frequently asked questions",
        items: [
          { q: `Which is cheaper, ${names.join(" or ")}?`, a: `${products.map((p) => `${p.name} starts at ${inr(p.startingPrice)}${p.priceUnit ? ` ${p.priceUnit}` : ""}`).join("; ")}. Final prices depend on users, modules and GST — ask us for a quote.` },
          { q: `Do ${names.join(" and ")} offer a free trial?`, a: products.map((p) => `${p.name}: ${p.hasFreeTrial ? "yes, a free trial is available" : "no free trial; a demo can be arranged"}.`).join(" ") },
          { q: `Can I switch from ${names[0]} to ${names[1]} later?`, a: "Usually yes. Most vendors help you export your data, and our advisors can plan the move with you." },
          { q: "Can I get a free demo?", a: "Yes. Use the “Book a demo” button on either product, or contact us and we'll arrange demos of both." },
        ],
      },
      { id: id(), type: "CTA", hidden: false, heading: "Still not sure which to pick?", text: `Our software advisors compare ${title} for your exact needs and budget — free of charge.`, buttonLabel: "Get free advice", buttonUrl: ctaUrl },
    ];

    await db.comparisonPage.update({ where: { id: page.id }, data: { sections: sections as Prisma.InputJsonValue } });
    filled++;
    console.log(`✓ ${page.title}: ${sections.length} sample sections (${page.status.toLowerCase()}) → /compare/${page.slug}`);
  }
  console.log(`\nDone: ${filled} comparison(s) filled, ${pages.length} in total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
