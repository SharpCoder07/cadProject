# Cadgram

A software discovery and lead-generation marketplace for India: visitors search, filter, compare and enquire about business software; staff run everything — catalogue, homepage, pages, menus, theme, SEO, leads and users — from an admin panel; vendors manage their own listings and see their leads in a vendor portal.

- **Stack:** Next.js 15 (App Router, TypeScript strict) · Tailwind CSS · PostgreSQL + Prisma · Zod · React Hook Form · TipTap · dnd-kit
- **Design and decisions:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Progress and acceptance criteria:** [`docs/CHECKLIST.md`](docs/CHECKLIST.md)
- **Going live:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- **Compliance & Privacy (handover, legal-review checklist):** [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md)

## Requirements

- Node.js 20.11 or newer
- PostgreSQL 14 or newer with the `pg_trgm` and `unaccent` extensions available (standard on Neon, Supabase, RDS, Cloud SQL and the official Docker image)

## Local setup

```bash
cp .env.example .env            # then set APP_SECRET and CRON_SECRET (openssl rand -base64 48)
npm install
createdb cadgram_v2                # or use docker compose up -d db
npm run db:init                 # first time only: creates + applies the initial migration
npm run setup                   # applies migrations and seeds sample data
npm run dev
```

Open <http://localhost:3000> for the site and <http://localhost:3000/admin> for the admin panel.

### Seeded accounts (local only)

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@cadgram.local` (or `SEED_ADMIN_EMAIL`) | `ChangeMe-2026!` (or `SEED_ADMIN_PASSWORD`) |
| Content Editor | `editor@cadgram.local` | `Demo-Password-2026` |
| Product Manager | `catalogue@cadgram.local` | `Demo-Password-2026` |
| Sales Manager | `sales@cadgram.local` | `Demo-Password-2026` |
| Read-only Analyst | `analyst@cadgram.local` | `Demo-Password-2026` |
| Vendor portal | `vendor@ledgerline.example.com` | `Demo-Password-2026` |

Demo users and sample leads are never created when `NODE_ENV=production`. All companies and products in the sample data are fictional.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:unit` | Unit tests only (no database needed) |
| `npm run test:integration` | Service tests against `cadgram_v2_test` |
| `npm run test:e2e` | Playwright flows against a running, seeded app |
| `npm run verify` | Typecheck, lint and tests in one go |
| `npm run db:migrate` | Create/apply a migration after editing `schema.prisma` |
| `npm run db:deploy` | Apply committed migrations (CI/production) |
| `npm run db:seed` | Seed roles, admin, settings and (on an empty catalogue) sample data |
| `npm run db:reset` | Drop, re-migrate and re-seed the development database |
| `npm run db:studio` | Browse data in Prisma Studio |
| `npm run mail` | Local test inbox (Mailpit): catches every email the app sends — see “Testing email” |

### Running tests

```bash
createdb cadgram_v2_test
npm run db:test:prepare         # applies migrations to cadgram_v2_test (.env.test)
npm test
```

Integration tests truncate every table, so they refuse to run unless the database name contains `test`. Override the URL with `TEST_DATABASE_URL`.

End-to-end tests expect a seeded app: `npm run build && npm start` in one terminal, then `npm run test:e2e`.

## Testing email (SMTP)

Use **Mailpit**, a local fake mail server: every email the app sends lands in a web inbox on your computer and nothing reaches real people.

1. In a separate terminal: `npm run mail`. The first run downloads Mailpit into `.mailpit/` (Windows, macOS or Linux; no Docker needed). With Docker instead: `docker compose --profile dev up -d mailpit`.
2. Open the inbox: <http://localhost:8025>.
3. Admin → **Settings → Email**: host `localhost`, port `1025`, encryption **None**, username and password empty, any sender address (e.g. `no-reply@cadgram.local`), sending **on**. Save, then **Test connection** and **Send a test**.
   (Without saving admin settings you can use `.env` instead: `EMAIL_DRIVER="smtp"`, `SMTP_HOST="localhost"`, `SMTP_PORT=1025`.)
4. Trigger real emails — sign up as a buyer, post a review, submit a vendor request, send an enquiry — and watch them arrive. Every recipient (buyer, vendor, admins) shows in the same inbox.

Before going live, replace the Mailpit settings with your real SMTP provider (Gmail/Google Workspace, Zoho Mail, Amazon SES, Brevo…) and use **Send a test** again.

## Scheduled jobs (offer emails, scheduled publishing)

Some things don't happen at the moment someone clicks a button, so a scheduled job (`/api/cron`) runs every 5 minutes:

- **"New offer on your favourite" emails** for offers whose start date was in the future when they were published. (An offer that's already live when it's published or approved is emailed straight away; the job catches the ones that start later.)
- Publishing products, pages and blog posts scheduled for later.
- Retrying lead emails that failed, and removing old sessions.

Locally, run it in another terminal while `npm run dev` is running: `npm run cron` (every 5 minutes) or `npm run cron -- --once` (once, now). It needs `CRON_SECRET` set in `.env`. On the server the `cron` service in `docker-compose.yml` does this; on Vercel, add a Vercel Cron for `/api/cron`.

Each offer is emailed once only. **Admin → Offers** shows whether an offer has been announced.

## Project structure

```
prisma/              schema, migrations, seed and sample data, search SQL
src/app/(site)/      public website (homepage, listings, product, compare, blog, CMS pages)
src/app/(auth)/      sign-in, password reset, invitations
src/app/admin/       admin panel (one folder per area, with its server actions)
src/app/vendor/      vendor portal
src/app/api/         route handlers: leads, reviews, search suggestions, uploads, media, cron, CSV export
src/server/          server-only code: env, db, auth, RBAC, audit, rate limits, storage, email, services
src/components/      ui (design system), site, admin, blocks (CMS renderers)
src/lib/             shared validation (Zod), formatting, CMS block schemas, theme helpers
tests/               unit, integration and e2e tests
```

Request flow: **UI → server action / route handler (Zod) → service (permission check, business rules, transaction, audit) → Prisma.** Permission checks live in the services, so every entry point — admin, vendor portal or API — is protected the same way.

## What admins can change without a developer

Branding, colours, fonts and corner style · header and footer menus · announcement bar · homepage and every CMS page (add, reorder, hide and edit sections; reusable blocks; drafts, preview links, scheduled publishing, revision history) · banners by placement with start/end dates · software listings, categories (drag-and-drop tree), vendors, brands, industries, attributes and per-category filters · listing and product-page section visibility · button labels and messages · reviews moderation · curated comparisons · blog · media library · SEO defaults, per-page SEO and redirects · lead notification recipients, auto-assignment and webhooks · analytics IDs · users, roles and permissions.

See *What still requires development work* in `docs/ARCHITECTURE.md`.

## Configuration

All configuration is through environment variables; see `.env.example` for every option with comments. Secrets (database, storage, email, webhook keys) are only ever read from the environment; the admin Integrations page shows whether they are set, never their values.
