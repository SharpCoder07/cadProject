# Cadgram — Technical Architecture

Software discovery and lead-generation marketplace (India-first, INR) with a
staff admin panel, a vendor portal, and a database-driven CMS.

## 1. Decisions (confirmed)

| Topic | Decision |
|---|---|
| Market | India-first. Prices stored as `Decimal` + `currency` (default `INR`), shown with `₹` and Indian digit grouping (`en-IN`). GST inclusion flag per product. Phone validation accepts Indian mobiles (+91) and international E.164. |
| Accounts | Staff roles + **vendor portal**. Visitors have no accounts: enquiries and reviews are submitted with name/email and reviews are moderated. |
| Hosting | Portable. Works on Vercel (managed Postgres such as Neon/Supabase, S3/R2 storage) and on Docker/VPS (`docker-compose` with Postgres, local disk or MinIO/S3). No host-specific APIs in app code. |

## 2. Stack

- **Next.js (App Router) + TypeScript strict** — RSC for public pages, Server Actions for admin mutations, Route Handlers for public JSON APIs (search suggestions, enquiry, review, uploads, sitemap).
- **Tailwind CSS** + an in-repo component system (`src/components/ui`) built on Radix primitives for accessible dialogs, menus, tabs, selects.
- **PostgreSQL + Prisma** — normalized schema, `pg_trgm` + `tsvector` search, migrations committed.
- **Auth** — first-party, database-backed sessions (httpOnly, `SameSite=Lax`, `Secure` in prod cookies carrying a random token; only its SHA-256 hash is stored). Passwords hashed with **argon2id** (bcrypt fallback not needed). Chosen over Auth.js because we need admin-visible, revocable sessions, account lockout and RBAC on every action, all of which are simpler and auditable with our own session table.
- **Zod** for every input boundary (forms, actions, route handlers, CMS block payloads, settings values, env).
- **React Hook Form** for complex admin forms (software editor, page builder blocks).
- **dnd-kit** for drag-and-drop ordering (homepage sections, menus, screenshots, features).
- **Storage driver** interface: `local` (dev / single VPS volume) and `s3` (S3, Cloudflare R2, MinIO, DigitalOcean Spaces). Selected by `STORAGE_DRIVER`.
- **Email driver**: `console` (dev), `smtp`, `resend`. **Webhook/Slack** notifier for leads.
- **Tests**: Vitest (unit + integration against a real Postgres test DB), Playwright (critical E2E flows).

## 3. Folder structure

```
prisma/
  schema.prisma          # models (see §5)
  migrations/            # committed SQL, incl. search indexes
  seed.ts                # realistic sample data
src/
  app/
    (site)/              # public website (header/footer from CMS)
      page.tsx           # homepage = CMS page "home"
      software/[slug]/   # product detail
      categories/[...slug]/
      vendors/[slug]/  industries/[slug]/  compare/  search/
      blog/  [...slug]/  # CMS pages (about, contact, privacy, terms, faq…)
    admin/               # staff dashboard (RBAC-guarded layout)
      software/ categories/ vendors/ brands/ attributes/ leads/ reviews/
      cms/{pages,menus,banners,announcements,blocks,testimonials,faqs}/
      blog/{posts,authors,categories,tags}/ media/ seo/{redirects,defaults}/
      users/ roles/ settings/ integrations/ audit-log/
    vendor/              # vendor portal (own listings + leads)
    api/                 # route handlers: search/suggest, leads, reviews, uploads, cron, preview
    sitemap.ts robots.ts
  components/
    ui/                  # design-system primitives
    site/                # public-site components
    admin/               # admin components (DataTable, forms, page builder)
    blocks/              # CMS block renderers (one per block type)
  server/                # server-only code — never imported by client components
    db.ts  env.ts  auth/  rbac/  audit.ts  revisions.ts  rate-limit.ts
    services/            # business logic: software, categories, leads, cms, search…
    storage/  email/  notifications/  settings/  seo/
  lib/                   # isomorphic helpers: formatting, slug, validation schemas
tests/
  unit/  integration/  e2e/
```

Rule of separation: **UI → server actions / route handlers → services → Prisma**.
Services hold business rules and run permission checks via `assertCan(user, perm, resource?)`; actions only parse input (Zod), call services, revalidate caches and map errors to user-facing messages.

## 4. Security model

- Every admin/vendor mutation passes through `requireUser()` + `assertCan()` server-side; UI hiding is cosmetic only.
- Vendor users are additionally scoped: `assertCan` receives the resource and checks `resource.vendorId === user.vendorId`. Vendor edits to software set status `IN_REVIEW` unless `vendor.canPublish`.
- CSRF: Server Actions are origin-checked by Next.js; public POST route handlers verify `Origin` and use `SameSite=Lax` cookies.
- Rate limits (DB-backed fixed window, pluggable): login (per IP + per email), lead/review submission, search suggest.
- Sign-in attempts (`src/server/auth/login-guard.ts`, tables `LoginGuard` per email and `IpBlock` per hashed IP):
  3 wrong passwords → account locked 15 minutes; then 2 more tries, each message saying how many are left;
  the 5th wrong password blocks that network (IP) and the email for 24 hours, and any other network that tries the
  blocked email (even with the right password) is blocked for 24 hours too. Counts are kept for unknown emails as
  well, so the messages don't reveal which emails have accounts. A correct sign-in clears the count; a password
  reset, password change or admin reactivation also lifts the network blocks started on that email. The cron job
  removes expired blocks. Extra flood limits stay: 20 tries / 15 min per IP, 8 / 15 min per email. Timing-safe compare.
- **Two-step verification (TOTP) is required for every staff and vendor account.** A correct password only opens a
  10-minute challenge (`AuthToken` type `TWO_FACTOR`, cookie `cg_2fa`); the session is created after a 6-digit code from
  an authenticator app (Google/Microsoft Authenticator, 2FAS, Authy…) or a single-use backup code. Accounts without an
  authenticator set one up during that challenge (QR code or manual key, then 10 backup codes). Invite and password-reset
  links also go through it. `getCurrentUser()` ignores sessions of accounts with no authenticator.
  RFC 6238: SHA-1, 6 digits, 30 s, ±1 step for clock drift, a code can't be reused (`totpLastStep`), 6 code checks
  per person every 15 minutes (right or wrong; a wrong code says how many are left).
  Secrets are AES-256-GCM encrypted (`APP_SECRET`); backup codes stored as salted SHA-256. QR codes are drawn by
  `src/lib/qr.ts` (no dependency). Users move to a new phone / regenerate backup codes in My account (needs a current
  code). Admins with `users.manage` reset another user's authenticator (Super Admin only for Super Admins and vendor
  users); break-glass: `npm run auth:reset-2fa -- <email>`.
- Uploads: MIME sniffing by magic bytes (not just extension), size limits per type, SVG rejected unless sanitized, randomised storage keys, images re-encoded with `sharp`.
- Rich text sanitized server-side on save (allow-list) and again on render.
- Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) in `next.config`/middleware.
- Secrets only in env; `src/server/env.ts` validates env with Zod at boot; no `NEXT_PUBLIC_` secrets. Integrations in DB store only non-secret config.
- Audit log for: auth events, role/permission changes, user status changes, publish/unpublish/delete, settings and integration changes, lead exports, redirects.

## 4a. Vendor approval workflow

Vendor-portal users (roles whose key starts with `VENDOR`) never change live data. Every create, edit,
publish, unpublish and delete of a product, every company-profile change and every public reply to a
review becomes an `ApprovalRequest` (`src/server/services/approvals.ts`). Only users with
`approvals.manage` (Super Admin by default) can approve or reject.

| Vendor does | What happens immediately | On approval |
|---|---|---|
| Adds a product | Saved as a **draft** (not public); “Publish new” request opened | Product is published |
| Edits a draft / unpublished product | Draft updated; publish request refreshed | Product is published |
| Edits a **live** product | Nothing changes on the site; the proposal is stored in an “Edit” request and shown back to the vendor in the editor | Proposal is applied (promotion flags, vendor and SEO stay admin-controlled) |
| Requests unpublish / deletion | Nothing changes | Product unpublished / deleted |
| Edits company profile | Nothing changes; proposal stored | Profile updated (URL, visibility, lead access, SEO stay admin-controlled) |
| Replies to a review | Nothing public | Reply shown under the review |
| Adds a team member (name, email, access) | Shown as “invitation awaiting approval” | User invited by email with the chosen access |
| Changes a teammate's name or access | Nothing changes | Access applied (matching vendor role, or a custom one is created); their sessions restart |
| Removes a teammate | Nothing changes | User deleted and signed out (activity history kept) |
| Resets a teammate's password | Nothing changes | Reset link emailed to them |
| Changes own name / photo | Nothing changes | Profile updated |
| Changes own password (current one verified) | New password stored **only as a hash** in the request | Password replaced, all sessions signed out; the hash is wiped from the request once decided or withdrawn |

- **Enforced in services, not just the UI:** `createSoftware`, `updateSoftware`, `setSoftwareStatus`,
  `restoreSoftwareRevision` and `saveVendor` refuse vendor principals; the only vendor write path is
  `saveVendorDraft` (drafts, never live) called by the approvals service.
- **One pending request per record.** A newer request of the same kind updates the proposal; a different
  kind supersedes (cancels) the old one. Vendors can withdraw pending requests.
- **Rejections need a reason**, which the vendor sees on the request, in the editor and by email.
- **Approvers are notified** by email and see a count in the header bell, the sidebar and the dashboard.
- **Stale warning:** if staff edited the record after the request was made, the review page says so.
- **Vendor roles:** Vendor Admin (everything, incl. deletion requests, profile, leads, team management),
  Vendor Editor (propose products and review replies), Vendor Viewer (read-only products and leads).
  `vendor.*` permissions never apply to staff accounts, and vendor users can't use staff permissions.
- **Vendor-granted access** is limited to `vendor.*` permissions and media uploads; it can never include staff permissions.
  Signing out of devices is immediate. The public “forgot password” page still works for account recovery.
- **Super Admin visibility:** Approvals (queue, filters, side-by-side diff), Vendor portal (every vendor's
  users, products, requests and activity log).

## 4b. Email delivery
- **Settings → Email settings** (`integrations.manage`): SMTP host/port/user/password/encryption, from/reply-to,
  a master send switch, Test connection and Send test. Stored in the `Integration` row `email.smtp`; the password is
  AES-256-GCM encrypted with a key derived from `APP_SECRET` (changing `APP_SECRET` means re-entering it).
- Once a host is saved, these settings take precedence over the `.env` `EMAIL_DRIVER`; with the switch off nothing is sent.
- Notification toggles live in the `leads` setting (sales on new lead, assignee, confirmation to the lead, vendor).
- Templates (`src/server/email/templates.ts`) can be overridden per key in `email.templates`; `{{tokens}}` are
  HTML-escaped. Invite and password-reset templates can't be switched off. Every send returns `{delivered, reason}`;
  undelivered lead notifications are logged as SKIPPED and invite links are shown to the admin instead.

## 4c. Vendor plans, subscriptions and lead contact masking
- **Masking:** vendor users see every lead for their products, but the buyer's email and phone are masked
  (`su••••••@g••••.com`, `+91 98••••••10`) unless their company has an active plan. Masking happens in
  `services/leads.ts` (`vendorLeadAccess` + `redactContact`) so real values never reach the browser; it also covers
  emails/phones typed into the requirement/message, the CSV export, and the vendor notification email. Vendors can't
  search leads by email/phone. "View" opens an upgrade prompt with **Buy Now** → `/vendor/plans`.
  Vendors never receive internal notes, the staff timeline, notification targets or the assignee.
- **Plans** (`VendorPlan`, admin: Plans & billing → Vendor plans, `billing.manage`): name, price in paise (GST incl.),
  billing period (month/quarter/6 months/year), features, visibility, "most popular". Plans with history are hidden, not deleted.
- **Subscriptions** (`VendorSubscription`): one-time Razorpay payment per period, no auto-debit. Access =
  `status ACTIVE` and `periodStart ≤ now < periodEnd`; an early renewal starts when the current period ends. Plan name,
  price and interval are snapshotted. Admins can add a subscription (offline payment / free trial) or cancel one
  (access ends immediately; refunds via the Razorpay dashboard).
- **Payments** (Settings → Payment settings): Razorpay Key ID + Key secret + webhook secret, stored encrypted in the
  `payments.razorpay` Integration row. Flow: vendor (needs `vendor.billing`, Vendor Admin by default) clicks Buy now →
  server creates a PENDING subscription and a Razorpay order → Checkout.js → server verifies the signature
  (HMAC of `order_id|payment_id`), fetches the payment, captures it if only authorized, checks amount/order, activates.
  `POST /api/webhooks/razorpay` (`payment.captured`, `order.paid`, verified with the webhook secret) activates the same
  subscription if the browser never returned. Activation is idempotent. A confirmation email (`subscription_active`)
  goes to the buyer. CSP allows checkout.razorpay.com / api.razorpay.com.
- No GST invoices are generated; Razorpay's payment receipt is the record.

## 4d. Product offers and favourites
- **Offers** (`ProductOffer`): title, discount headline, details, coupon code, terms, optional link, start/end.
  Phases are derived: draft → scheduled → live → ended. Staff with `offers.manage` (Products → Offers) create,
  publish, end or delete offers on any product. Vendors with `vendor.offers` (Vendor Admin, Vendor Editor) propose
  offers on their own products in the portal: a new offer is stored as a DRAFT and an `OFFER` approval request
  (CREATE) opens; edits to live offers and removals are UPDATE / DELETE requests. Approval applies the change with
  the approver's authority. Live offers show on the public product page (cached 5 min, filtered by time at render).
- **Favourites** (`ProductFavourite`): any vendor-portal user can favourite any published product — from the heart
  on the product page (`/api/account/favourites`) or Vendor portal → Favourites (search + list + live offers).
  `User.offerEmails` turns the emails off.
- **Launch emails:** when an offer is live (published, started, not ended, product published) and
  `launchNotifiedAt` is empty, it is claimed atomically and everyone who favourited the product gets the
  `offer_launched` email once. Triggered on publish/approval and by the cron job for offers that start later.

## 4e. Classifications (taxonomies)
- Nine lists defined in `src/lib/taxonomies.ts`: Use cases, Professions, Features, Platforms, Deployment models,
  Licensing models, Budget ranges, Customer types, Operating systems. One table (`TaxonomyTerm`, `kind` enum) plus
  `SoftwareTerm`. Use cases and Professions can be nested (parent term); a parent's page includes its children's products.
- Admin: Website → Classifications → each list (`taxonomy.manage`): add form + searchable table with product counts,
  bulk delete, "Add starter terms"; edit dialog adds page heading, promoted product + badge, page content, FAQs, SEO.
  Products get terms in the product editor → Classifications tab (vendor proposals include them; the approval diff
  shows term names).
- Public: `/{path}` index and `/{path}/{slug}` term page (`components/site/term-page.tsx`), modelled on
  cadgram.com/use-case/2d-drafting: hero with counts + anchors + promoted product, popular choices, paginated product
  directory (10/page), advice CTA, price comparison table ("Best for" = professions), page content, related articles
  (posts linked to those products), FAQs (+ FAQ JSON-LD), continue exploring, sidebar with counts, ItemList JSON-LD.
  Paths: use-case, profession, feature, platform, deployment, licensing, budget, customer-type, operating-system.
  Product pages list their terms under Specifications. Sitemap includes indexable terms with products.
- The older `deployment` and `pricingModel` fields on Software are unchanged (they drive search filters).

## 4f. Geo pages
- `GeoLocation`: Country → State → City → Area (strict parent levels), unique slug, published flag, priority,
  lat/long, PIN codes, business zones. "Install / repair starter locations" loads India (all states/UTs, major cities,
  some business areas), UAE and Saudi Arabia (`src/lib/geo-starter.ts`); the seed does the same.
- `GeoPage`: one product **or** one brand (vendor) in a city/area; draft/published; index/noindex; sections hero,
  introduction, buying guide, FAQs. A section left empty with "Inherit when empty" uses the Geo settings template
  with `{{name}} {{city}} {{state}} {{country}} {{site_name}}` filled in. Bulk-create for many cities at once.
- Geo settings (`geo` setting, `geo.manage`): enable routes, product route base (default `software`), template text.
- URLs: brand `/{location}/{vendor-slug}` (`(site)/[slug]/[sub]`), product `/{location}/{base}/{product-slug}`
  (`(site)/[slug]/[sub]/[item]`). 404 unless routes are enabled, the location is a published city/area and the page
  is published. Static routes (e.g. /use-case/…) always win over these. Included in the sitemap unless noindex.

## 4g. Public site layout (marketplace style)

The public site follows a software-marketplace layout (reference: techjockey.com — layout patterns only, no copied content or branding).

- **Theme defaults:** indigo primary `#432DA6`, orange accent `#FF8A00`, ink `#1B1640`, background `#F6F5FB`, Plus Jakarta Sans, soft radius. Every public page (homepage blocks, category, product) uses only theme tokens, so Settings → Theme recolours the whole site. `npm run db:seed` moves sites still on an earlier default palette to these; customised themes are left alone.
- **Header:** logo, wide search, expert phone, List your software, Login; second row with the Categories mega menu, the CMS header menu and the Get free advice button.
- **Footer:** promise strip (verified vendors, best price, free advice, reviews), "Need expert guidance?" band, link columns from the footer menus.
- **Homepage blocks:** HERO now has a heading, live stats (products, categories, brands, reviews from `siteStats`) and a vendor logo strip. New blocks: `HOW_IT_WORKS` (numbered steps) and `DEALS` (live published product offers via `liveDeals`). The seed adds both to an existing homepage once (`seedSiteRefresh`) and adds a Brands link to the header menu.
- **Listing cards:** logo with rank, rating pill, four aspect bars (ease of use, value, features, support — averages of approved reviews via `subRatings`), facts, starting price, Book a free demo and Get free quote buttons, Compare.
- **Category page:** same sections and behaviour as cadgram.com/category/…, styled like the homepage (light hero, accent buttons, accent-underlined headings): light hero with breadcrumb, "Best X" heading, three checks and a Featured product card (first hand-picked featured product, else the most popular); sticky section tabs (Products, Guide, Price comparison, Articles, FAQs); Popular choices (4); product directory card with a Filter toggle (Platform, Deployment, Licence from classification terms via `?term=`, pricing model, sort, free trial) and rows (logo, compare, name, vendor line, description, View product details, price, View product), an advertisement after the second row from the banner placement (`layout.bannerPlacement` or `category.<slug>`), boxed pagination; sticky sidebar (Need guidance?, Product Categories with counts); guidance banner with stats; buyer guide (category image + content); CTA strip; price comparison table (every plan, "Best for" from professions/use cases, `categoryPriceRows`); article slider; FAQs generated from live data; related categories.
- **Product page:** rating pill and "N Ratings & Reviews", trust badges, price box with top-5 feature highlights and offers (`#offers`), sticky tabs, pricing cards, review summary with % rating 4★+ and aspect bars, reviewer cards with pros/cons, company details table.

## 4h. Brands

Brands (Autodesk, Tally, Zoho…) are standalone: `Brand.vendorId` is optional and only says which vendor owns a brand. Admin: Products → Brands (name, slug, logo, website, about, optional owning vendor, display order, visible). Any product gets a brand in its editor; vendor-portal users can pick their own brands or any brand not owned by another vendor. Public: `/brands` (A–Z logo tiles) and `/brands/<slug>` (logo, about, filterable product listing, `runListing` scope `brandId`); product pages show "Brand X · sold by Vendor". The homepage hero "Top software brands" strip shows brand logos only (uploaded files, not the seed's placeholder initials), hand-picked in the hero block (`logoBrandIds`) or by display order. Migration `standalone_brands`.

## 4i. Paste URL next to every upload

Every place that uploads a file also accepts a pasted link: the media library dialog (so every logo, screenshot, cover and brand-logo picker), Admin → Media, image-URL fields in settings and page blocks (a pasted link to another site is copied into the library automatically, or via "save a copy"), the sidebar branding dialog and profile photos. The server downloads the link (`src/server/remote-file.ts`) and runs it through the normal upload pipeline (`processUpload`: magic-byte type check, re-encode, size limit). SSRF guards: http(s) on ports 80/443 only, no credentials in the URL, every resolved address checked against private/loopback/link-local/reserved ranges (IPv4 and IPv6, including IPv4-mapped forms), connection pinned to the checked address, redirects followed manually (max 3, each re-checked), 15 s overall timeout, streamed body capped at `MAX_UPLOAD_MB`. Rate limit `urlImport` (30 per 10 minutes per user). Endpoints: `POST /api/uploads` with JSON `{ url, alt?, folderId? }`; `/api/account/avatar` form field `url`; `/api/admin/branding` form field `logoUrl`.

## 4j. Buyer accounts

People can sign up on the website (`/signup`) as **buyers** (role `BUYER`, permission `buyer.account`, which no staff or vendor role has). Sign-up creates the user as `INVITED` and emails a confirmation link (`verify_email` template, `AuthToken` type `EMAIL_VERIFY`, 24 hours); `/verify-email/<token>` shows a "Confirm my email" button (a POST, so mail scanners can't use the link up), which activates the account and signs them in. Signing in while unconfirmed resends the link (max 3 an hour). Sign-up replies identically whether or not the email exists. Rate limits: `signup` (5/hour/IP), `verifyResend`.

- **Two-step verification is optional for buyers** (required for staff and vendors): `getCurrentUser` accepts buyer sessions without an authenticator; `signIn` signs buyers in directly unless they've turned it on (then the normal challenge). Buyers switch it on/off under Account settings (`startOptionalTwoFactor` / `confirmOptionalTwoFactor` / `disableOptionalTwoFactor`).
- **Areas:** `homeFor(roleKey, vendorId)` → `/account`, `/vendor` or `/admin`; each area redirects other kinds of account to their own. Middleware gates `/admin`, `/vendor` and `/account` by whole path segment (so public `/vendors` isn't caught).
- **`/account` buyer panel** — same shell as the admin panel and vendor portal (sidebar, top bar, light/dark, command palette): Overview dashboard (favourites, live offers on them, reviews, 2FA prompt), Favourites (moved from the vendor portal; product search, offer-email switch; sidebar badge = live offers), My reviews (table with status), Explore links (categories, compare), Account settings (profile card, name, photo, password, optional 2FA, devices). Sign-out returns to the website. Header shows Login / My account via `/api/account/session` (client-side, so cached pages stay shared).
- **Favourites** are buyer-only (`assertFavouriter`); offer-launch emails go to buyers only and link to `/account/favourites`. Signed-out visitors see the heart and are sent to sign in.
- **Reviews require a buyer login:** name and email come from the account, `Review.userId` links them, one review per product per buyer (`@@unique([softwareId, userId])`), still moderated. Older anonymous reviews keep `userId = null`.
- Migration `buyer_accounts`. Demo buyer (non-production seed): buyer@cadgram.example.com / Demo-Password-2026.

## 4k. Approval notifications

Everything that waits for someone's approval notifies them by email **and** on the admin bell (top bar, "Notifications"), with counts in the sidebar:

| What | Who is notified | Email template | Bell / sidebar |
| --- | --- | --- | --- |
| Vendor requests (products, profile, offers, review replies, team) — new, and when a vendor updates a waiting request | `approvals.manage` (Super Admin) | `approval_request` | Approvals badge |
| Buyer reviews | `reviews.moderate` | `review_new` | Products → Reviews badge |
| Listings staff submitted for review (`IN_REVIEW`) | `software.publish` | `software_review` | Products → All products badge |

The bell lists the latest items from all three, newest first, with shortcuts per kind. Built in `src/app/admin/layout.tsx` from `pendingApprovalSummary`, `pendingReviewSummary` and `pendingSoftwareReviewSummary`.

## 4l. Bell and browser push notifications

- `Notification` (one row per person: type, title, body, link, read) is the bell list; `PushSubscription` stores each
  browser that turned pop-ups on. `notify()` in `src/server/notifications/notify.ts` writes both and sends Web Push
  (VAPID ES256 + RFC 8291 aes128gcm, no package, `src/server/notifications/web-push.ts`); 404/410 subscriptions are
  removed. Keys from `VAPID_*` env or generated once and stored encrypted (Integration `push.vapid`).
- Types (`src/lib/notify-types.ts`): staff — new lead, lead assigned, approval request, review/question to moderate,
  payment; vendors/resellers — new lead, request decided, plan expiring (cron), payment; buyers — offer on a favourite,
  review published/rejected, question answered. Each person switches types off (`User.notifyOff`).
- UI: header bell (unread badge, 45 s polling + service-worker message), `/admin|vendor|account/notifications` page
  (history, pop-ups on this device, switches); email settings moved to `…/notifications/email`. `public/sw.js` shows
  pop-ups and opens the link. API: `/api/notifications`, `/api/push` (push hosts allow-listed). Old entries pruned
  after 90 days by the cron job.

## 4m. Comparison URLs

- Clean URLs: `/compare/{slug}-vs-{slug}[-vs-{slug}]` built by `compareUrl()` (`src/lib/compare.ts`): slugs
  de-duplicated and sorted alphabetically, so every set of products has exactly one address. All links (tray, picker,
  product pages, ready-made comparisons) use it.
- `/compare/[slug]`: a published curated comparison with that slug wins (indexable, in the sitemap). Otherwise
  `resolveCompareSlug()` (`src/server/services/compare-urls.ts`) reads the slug as published products (handles slugs
  that contain "-vs-", renamed products via their automatic `/software/old` redirect). Wrong order, repeats, upper
  case or a renamed product → permanent redirect to the one URL; an unknown product → 404. If a curated comparison
  covers exactly the same products, the URL redirects to it. Other combinations render the compare tool with a
  generated title/description and a self-referencing canonical, but `noindex, follow` and are not in the sitemap —
  publishing a curated comparison (Admin › Comparisons, slug left empty = the same a-vs-b address) is how a
  combination becomes indexable.
- Old links `/compare/?products[]=97061&products[]=…` (previous website's IDs, stored as `Software.legacyId`,
  "Old website ID" in the product editor's SEO tab), `?products[]=<id or slug>` and `?p=a,b`: the middleware
  rewrites them to `/api/compare/legacy`, which answers with one 301. Trailing slashes are removed by the middleware
  with a 301 (`skipTrailingSlashRedirect` in next.config). `robots.txt` no longer blocks `/compare?` so crawlers see the redirects.

## 5. Data model (major relationships)

- **User → Role → RolePermission → Permission.** Seeded system roles; permissions are keys (`software.publish`). `User.vendorId` marks vendor-portal accounts.
- **Vendor 1–N Brand, Vendor 1–N Software, Brand 1–N Software.**
- **Category** is a self-referencing tree (`parentId`) with a materialized `path` for fast subtree queries ("all software in Accounting incl. subcategories" = `path LIKE '/acc/%'`). Software ↔ Category is M–N with one primary.
- **Industry, Tag** M–N with Software.
- **Attribute / AttributeOption / CategoryAttribute / SoftwareAttributeValue** — admin-defined specs. The same data powers detail-page specs, listing filters (per category, configurable) and comparison rows. MULTISELECT values are one row per option so filters are indexed joins, not JSON scans.
- **Software** owns Features, PricingPlans, Media (screenshots/videos/docs), FAQs, Releases, Reviews, RelatedSoftware (related/alternatives), DailyStats.
- **SeoMeta** 1:1 optional on Software, Category, Industry, Vendor, Page, Post, ComparisonPage; **Redirect** table consulted by middleware.
- **Page → PageSection** (ordered, toggleable, typed blocks with Zod-validated JSON `data`, or a pointer to a **ReusableBlock**). Homepage is system page `home`.
- **Menu → MenuItem** tree; items link to URL, Page or Category.
- **Banner** (placement + schedule), **Announcement**, **Testimonial**, **FaqGroup/FaqItem**.
- **Post** with Author, BlogCategory, BlogTag (M–N) and linked Software.
- **Lead** with LeadSoftware (M–N), LeadNote, LeadActivity (timeline), NotificationLog; assigned User; Vendor for portal visibility.
- **Setting** (typed key/value), **Integration** (non-secret config), **AuditLog**, **Revision** (snapshots for pages/posts/software), **RateLimitBucket**, **SearchQueryLog**.

## 6. Search

Phase 1 (PostgreSQL):
- `Software.searchVector` = weighted `tsvector` (A: name, B: tagline + vendor/brand names, C: short description + tags, D: description), maintained by trigger; GIN index.
- `pg_trgm` GIN index on `name` for typo-tolerant suggestions and prefix matches.
- Relevance = `ts_rank_cd` + trigram similarity + small popularity boost; sponsored items pinned per settings.
- Filters (category subtree, pricing model, deployment, free trial, price range, industry, attribute options) compile to indexed joins; keyset/offset pagination with `LIMIT ≤ 48`.

Phase 2 (optional): `SearchProvider` interface (`search`, `suggest`, `index`, `remove`) has a Postgres implementation; a Meilisearch/Typesense/OpenSearch adapter can be added and fed by the existing publish/unpublish service hooks without touching UI code.

## 7. Caching & performance

- Public pages are RSC with `revalidate` + **tag-based revalidation** (`revalidateTag('software:slug')`, `'category:…'`, `'cms:menus'`, `'settings'`) triggered by admin mutations, so edits appear immediately while pages stay cached.
- Settings, menus and announcements cached via `unstable_cache` with tags.
- Scheduled publishing: `/api/cron/publish` (protected by `CRON_SECRET`) flips due items; run via Vercel Cron or system cron.
- `next/image` with remote patterns for the storage domain; screenshots lazy-loaded.
- Counters (views/enquiries) aggregated into `SoftwareDailyStat` with upserts.

## 8. What admins can change without code

Logo, favicon, theme colours, fonts (from a curated list), radius; header layout options, announcement bar; header/footer menus; homepage and landing-page sections (add, reorder, toggle, edit); banners by placement and schedule; listing and detail-page section visibility and labels; category layouts and featured products; filters per category; all product, vendor, blog and static-page content; SEO defaults, per-entity SEO, redirects; contact details, social links; lead notification recipients and webhooks; analytics IDs.

### Still requires development work
- New **block types** or new page templates (each needs a renderer + Zod schema).
- New **attribute types** beyond boolean/select/multiselect/number/text.
- Fundamentally new layouts or design systems beyond theme tokens.
- New integrations (a new email provider, CRM sync, payment gateway).
- Schema changes (new entity types or fields) and new permissions.
- Swapping the search engine to a dedicated service.

## 9. Phases & acceptance criteria

See `docs/CHECKLIST.md`.
