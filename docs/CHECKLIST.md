# Cadgram — Project Checklist

Legend: ☐ not started · ✎ implemented, **not yet verified** · ☑ done and verified (migrations, typecheck, lint and tests pass)

> **Status (30 Oct 2026):** installed on Windows (Next 15.5, Prisma 6.19); the schema validates and
> `typecheck` and `lint` pass with zero errors. Migrations, seed, tests and the browser pass are next.
> Every ✎ item becomes ☑ once those pass and the flows are checked in a browser.

### Verification steps (first session with registry access)
- ☑ `npm install` (package-lock.json created; `postinstall` now runs `prisma generate`)
- ◐ Schema validates and the client generates ☑ · initial migration (`npm run db:init`) pending
- ☐ `npm run setup` against a fresh database; seed completes
- ☑ `npm run typecheck` and `npm run lint` clean (fixed 12 type errors and 4 lint errors)
- ☐ `npm test` (unit + integration) green
- ☐ `npm run build` succeeds; `npm run test:e2e` green on desktop and mobile profiles
- ☐ Manual pass: every admin page, the vendor portal, and the public site at 375 px, 768 px and 1280 px

## Phase 0 — Planning
- ☑ Architecture, decisions, folder layout (`docs/ARCHITECTURE.md`)
- ✎ Prisma schema (≈55 models, GIN/trigram search indexes) — validate + first migration pending

## Phase 1 — Foundation
- ✎ Next.js + TS strict + Tailwind + ESLint + Vitest + Playwright scaffold
- ✎ Env validation (`src/server/env.ts`), `.env.example`
- ✎ Search SQL (`prisma/sql/search.sql`) + bootstrap script that folds it into the initial migration
- ✎ Seed: roles/permissions, super admin, settings, menus, homepage + 6 pages, 28 products, 31 categories (12 top-level), 12 vendors, 8 industries, 10 attributes, reviews, 4 posts, 2 comparisons, 40 leads, demo users
- ✎ Auth: login, logout, sessions table, lockout, password reset, invite
- ✎ Two-step verification (TOTP) required for all accounts: setup at sign-in with QR, backup codes, move to new phone, admin reset, CLI reset
- ✎ RBAC: permission matrix, `assertCan`, vendor scoping; unit tests
- ✎ Audit log helper; rate limiter
- ✎ Admin shell (sidebar per permissions), public shell (CMS header/footer)

**Accept:** fresh clone → `npm run setup` creates DB, migrates, seeds; super admin can log in; non-permitted actions are rejected server-side (tests prove it).

## Phase 2 — CMS & settings
- ✎ Settings: branding, theme, contact, social, SEO defaults, listing/detail visibility, labels
- ✎ Media library: upload (local/S3), validation, alt/caption, folders, search, picker
- ✎ Pages + sections page builder (drag reorder, toggle, typed blocks, reusable blocks)
- ✎ Drafts, preview links, scheduled publish (cron), revision history + restore
- ✎ Menus (nested, drag reorder), banners, announcements, testimonials, FAQs
- ✎ Blog: posts, authors, categories, tags
- ✎ Redirects + middleware

**Accept:** an editor can rebuild the homepage order, add a banner, change header menu and theme colour, and see it live without a deploy.

## Phase 3 — Catalogue management
- ✎ Software editor (all tabs: basics, content, features, pricing plans, media, specs, FAQs, taxonomy, flags, related, SEO), status workflow
- ✎ Bulk actions (publish, unpublish, archive, flag, delete), CSV export
- ✎ Categories tree (drag reorder / re-parent with path rebuild in a transaction), layouts, featured, filters
- ✎ Vendors, brands, verification, publishing permission
- ✎ Attributes & options; category attribute assignment
- ✎ Reviews moderation; curated comparisons
- ✎ Vendor portal: own listings (review workflow), own leads

## Phase 3b — Vendor approval workflow (30 Oct 2026)
- ✎ `ApprovalRequest` model; vendor roles Vendor Admin / Editor / Viewer; `approvals.manage` (Super Admin)
- ✎ Vendor product create/edit/publish/unpublish/delete, profile edits and review replies all go through approval
- ✎ Super Admin: approvals queue + diff + approve/reject with reason, vendor-portal overview, header bell, email alerts
- ✎ Vendor portal: request status in editor and lists, Approval requests page (withdraw), Reviews (replies), Team
- ✎ Vendor team management (add, change access, reset password, remove) and own name/photo/password changes via approval; /vendor/account
- ☑ `typecheck` and `lint` clean · ☐ migrations `vendor_approvals` + `vendor_team_approvals` applied · ☐ unit tests run · ☐ manual pass with each vendor role

## Phase 4 — Public site
- ✎ Homepage from CMS blocks
- ✎ Listing (category / search / industry / vendor): filters, sort, pagination, URL state
- ✎ Product detail: overview, features, screenshots, pricing, specs, FAQs, reviews, related, enquiry
- ✎ Compare (dynamic + curated), compare tray
- ✎ Search suggestions
- ✎ Blog, static pages, contact
- ✎ Responsive + accessible (keyboard, labels, contrast)

## Phase 5 — Leads
- ✎ Enquiry forms (product, compare, contact, get advice) with rate limit + honeypot
- ✎ Admin leads: list/search/filter/paginate, detail timeline, status, assign, notes, follow-ups, CSV export, reports
- ✎ Notifications: email + webhook + Slack, logged, retried
- ✎ Vendor plans & subscriptions (Razorpay checkout + webhook, admin plans/subscriptions/payment settings); vendor lead email/phone masked without an active plan, View → Buy Now
- ✎ Product offers (staff + vendor proposals with approval) shown on product pages; vendor favourites with one-time email when an offer goes live
- ✎ Classifications: 9 taxonomies (admin CRUD, product editor, public index + term pages like /use-case/2d-drafting, sitemap)
- ✎ Geo: locations hierarchy + India starter, geo pages for product/brand per city with inheritable template sections, geo settings, public routes, sitemap
- ✎ Email settings: SMTP from the admin (encrypted password, test connection, send test), notification toggles, editable templates with tokens + preview

## Phase 6 — SEO
- ✎ Metadata + canonical everywhere, OG images
- ✎ `sitemap.xml` (index + chunked), `robots.txt`
- ✎ JSON-LD: SoftwareApplication + AggregateRating + Offer, BreadcrumbList, FAQPage, Article, Organization

## Phase 7 — Hardening & delivery
- ✎ Security headers, CSP
- ✎ Tests: permissions, lead workflow, search filters, slug/redirects, settings schemas, E2E flows
- ✎ Dockerfile + docker-compose; Vercel notes
- ✎ README, deployment checklist
