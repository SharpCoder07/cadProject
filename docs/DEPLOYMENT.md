# Deployment

How to put Cadgram live, set it up, keep it updated and back it up. The same guide, with live readiness checks for the running server, is in the admin panel under **System › Deployment guide** (Super Admin only).

Cadgram is a Next.js app with PostgreSQL. It runs on a Linux server with Docker, or on Vercel with managed services.

## 1. Before you start

- **Server or platform:** a VPS with Docker (2 vCPU / 4 GB RAM is a comfortable start) or a Vercel account. Node.js **20.11+**.
- **Database:** PostgreSQL **14+** (16 recommended). Docker includes one; on Vercel use Neon, Supabase or Azure Database for PostgreSQL, ideally in an Indian region.
- **Domain and HTTPS:** Vercel adds HTTPS itself; on a VPS use a reverse proxy such as Caddy.
- **Email:** an SMTP mailbox (Microsoft 365, Google Workspace, Zoho, Amazon SES…) or Resend, with SPF, DKIM and DMARC on your domain.
- **Media storage:** an Azure Storage account with a blob container (recommended) or any S3-compatible bucket. Local disk only on a server whose disk is permanent and backed up.
- **Payments:** a Razorpay account with **live** API keys.
- **Legal:** your privacy policy and terms, reviewed by a lawyer (they're published from the admin; see section 4, step 8).

## 2. Environment variables

```bash
cp .env.example .env
openssl rand -base64 48   # run twice: one value for APP_SECRET, one for CRON_SECRET
```

| Variable | What to set |
| --- | --- |
| `DATABASE_URL` | Database connection string (the pooled one on Neon/Supabase). |
| `DIRECT_DATABASE_URL` | Direct (non-pooled) connection string; used for migrations. |
| `APP_URL` | Live address with `https://`, no trailing slash. |
| `APP_SECRET` | Random value. **Never change it later**: saved email, storage and Razorpay secrets are encrypted with it. |
| `CRON_SECRET` | Random value; protects `/api/cron`. |
| `NODE_ENV` | `production` (Docker and Vercel set it). |
| `EMAIL_FROM` | Sender, e.g. `Cadgram <no-reply@cadgram.com>`. SMTP itself can be set in Settings › Email settings. |
| `STORAGE_DRIVER` | Leave as is and choose Azure in Settings › Integrations › Media storage (Docker compose sets `s3` for its bundled MinIO). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First Super Admin; temporary password, used once. |
| `SEED_SAMPLE_DATA` | `false` on the live site. |

Optional: `SESSION_TTL_DAYS` (14), `MAX_UPLOAD_MB` (10), `LEADS_WEBHOOK_URL` / `LEADS_WEBHOOK_SECRET`, `SLACK_LEADS_WEBHOOK_URL`, `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (browser push keys; generated and stored automatically when unset — push pop-ups need the site on HTTPS).

## 3a. Deploy with Docker (VPS)

Getting the code onto the server: either clone your Git repository, or copy the release zip (for example `cadgram-deploy-2026-11-23.zip`, which has no secrets, `node_modules` or build files) and unzip it:

```bash
# from your computer
scp cadgram-deploy-2026-11-23.zip you@your-server:~
# on the server
sudo apt-get install -y unzip && mkdir cadgram && unzip ~/cadgram-deploy-2026-11-23.zip -d cadgram
```

Then:

```bash
curl -fsSL https://get.docker.com | sh
cd cadgram   # or: git clone <your-repository-url> cadgram && cd cadgram
# create .env (section 2) and also set POSTGRES_PASSWORD, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
docker compose up -d --build
```

This starts PostgreSQL, MinIO (S3-compatible storage), the app and a job that calls `/api/cron` every 5 minutes. Migrations run automatically each time the app starts.

HTTPS with Caddy (`/etc/caddy/Caddyfile`, then `sudo systemctl reload caddy`):

```
www.cadgram.com {
  reverse_proxy localhost:3000
}

media.cadgram.com {
  reverse_proxy localhost:9000
}
```

Set `STORAGE_PUBLIC_URL=https://media.cadgram.com/cadgram-media` and run `docker compose up -d` again. Using Azure instead: remove the `minio` and `minio-setup` services and choose Azure in Integrations after the first sign-in.

Create the first Super Admin once, from a computer with the code that can reach the database:

```bash
DATABASE_URL='postgresql://…' NODE_ENV=production \
SEED_ADMIN_EMAIL='you@yourcompany.in' SEED_ADMIN_PASSWORD='a-strong-temporary-password' \
SEED_SAMPLE_DATA=false npm run db:seed
```

## 3b. Deploy on Vercel

1. Create the PostgreSQL database and the Azure Storage account/container.
   Vercel deploys from a Git repository: if you have the release zip, unzip it and push it to a new private repository first (`git init && git add . && git commit -m "Release" && git remote add origin <url> && git push -u origin main`). The zip has no `.env`, so no secrets end up in Git.
2. Vercel → **Add New → Project**, pick the repository, add the section 2 variables for **Production**.
3. Build Command: `npx prisma migrate deploy && npm run build`.
4. Scheduled jobs: `vercel.json` calls `/api/cron` every 5 minutes and Vercel sends `CRON_SECRET`. Running a job every 5 minutes needs a paid Vercel plan (the free plan limits how often scheduled jobs run; check Vercel's current plan limits). Otherwise use an outside scheduler (for example an uptime or cron service) that calls `https://<your-domain>/api/cron` every 5 minutes with the header `Authorization: Bearer <CRON_SECRET>`.
5. Add the domain under Settings → Domains, then create the first Super Admin with the seed command above against the live `DATABASE_URL`.

## 4. First sign-in and set-up (admin panel)

1. Sign in at `/login` (Team tab). Set up two-step verification (required) and save the backup codes; change the temporary password in My account.
2. **Settings › Website settings:** name, logo, logo for dark backgrounds, favicon, contact details. **Settings › Website design:** Classic or Fresh Lime Design (Lime or Teal), colours, fonts, animations. Review the homepage, menus and footer.
3. **Settings › Integrations › Media storage:** Azure account, key and container; test; make it active; move existing files if any.
4. **Settings › Email settings:** SMTP server, test connection, send a test email, set lead alert recipients; send a test enquiry from the website.
5. **Partners › Plans & billing › Payment settings:** Razorpay live Key ID and Key Secret. In Razorpay add a webhook to `https://<your-domain>/api/webhooks/razorpay` with `payment.captured` and `order.paid`, and paste its secret back. Create plans under **Partners › Plans & billing › Vendor plans**.
6. **Team & security › Users** and **Team & security › Roles & permissions:** invite staff and adjust roles. **SEO & redirects:** turn on indexing and submit `/sitemap.xml` to Google Search Console.
7. **Website edit mode** (editing on the live pages): on by default for Super Admin and Admin (**Settings › Website settings › Edit Mode**). Give other staff roles the **“Edit on the website”** permission only if they should use it.
8. **Compliance & Privacy** (Super Admin; full guide in `docs/COMPLIANCE.md`):
   - **Compliance settings:** legal entity, privacy contact, grievance officer, timelines (only once your lawyer confirms them).
   - **Legal documents:** write, review and publish the privacy policy, terms and the other documents. Published versions replace the old Website pages at the same addresses.
   - **Consent** and **Cookies:** check the purposes, cookie categories and cookie list. Google Analytics, Tag Manager, Clarity and Meta Pixel load only after a visitor accepts them in the cookie banner, so visitor numbers in those tools will be lower than before.
   - **Data retention:** set the periods with your lawyer and switch the rules on.
   - **Pages › Navigation menus:** add `/privacy-center` and the legal pages to the footer.
   - Check **Compliance & Privacy › Overview**: its “Needs attention” list should be empty or understood.

## 5. Updating to a new version

1. Admin → **System › Backup & restore** → **Back up now**; confirm the database provider's backup is recent.
2. Docker: `git pull && docker compose up -d --build` (migrations apply on start). Vercel: push or **Redeploy** (build runs `prisma migrate deploy`).
3. Check the website, the admin, the Leads list and the readiness checks on the Deployment guide page. Restore the backup if needed.

Manual migration against a database: `npm run db:deploy`. Check a new release builds before uploading it: `npm install && npm run build`. On a development machine: `npm run db:migrate`, then `npm run db:test:prepare` and `npm test`.

Some updates add new database tables (for example website edit mode, Compliance & Privacy). They apply with the steps above like any other migration; until they've run, the screens that use them show errors.

## 6. Backups and recovery

- Daily database backups with point-in-time recovery at the provider. Docker: back up the `pgdata` volume or schedule
  `docker compose exec db pg_dump -U cadgram cadgram | gzip > cadgram-$(date +%F).sql.gz`.
- **System › Backup & restore** saves the whole site including uploads; keep a copy off the server.
- Backups also hold personal data that retention rules or erasure requests removed, until the backup itself expires. Agree how long backups are kept as part of your retention policy.
- Lost two-step access for the only Super Admin: `npm run auth:reset-2fa -- you@yourcompany.in`.
- Unpublished edit-mode drafts and templates, consent records, legal acceptances and privacy requests live in the database, so database backups include them.

## 7. Go-live checklist

- [ ] **Security:** long random `APP_SECRET` / `CRON_SECRET`; `.env` not in Git; HTTPS; seeded password changed; two-step on for all staff.
- [ ] **Sample data:** `SEED_SAMPLE_DATA=false`; no demo products, vendors or test accounts (the Test accounts page is hidden in production).
- [ ] **Email:** SPF, DKIM, DMARC; test email and a test enquiry arrived.
- [ ] **Payments:** live keys and webhook secret saved; a small test purchase activated a plan.
- [ ] **Storage:** Azure (or S3) active; images load on product pages.
- [ ] **SEO:** indexing on (off on staging); `/sitemap.xml` and `/robots.txt` load; old URLs added as redirects.
- [ ] **Edit mode:** only the right roles have “Edit on the website”; no forgotten unpublished changes (edit bar shows “All changes published”).
- [ ] **Compliance & Privacy:** privacy policy and terms published from Legal documents; grievance officer set; cookie banner shows on a first visit; `/privacy-center` linked in the footer; legal-review checklist in `docs/COMPLIANCE.md` gone through with your lawyer.
- [ ] **Operations:** `/api/cron` every 5 minutes; **Team & security › Logs › Error logs** checked regularly; uptime check on the homepage; database backups on.

## 8. Troubleshooting

| Problem | What to check |
| --- | --- |
| App won't start ("APP_SECRET must be at least 32 characters") | A variable is missing or too short; fix it and restart. |
| Images don't show | Storage isn't public or `STORAGE_PUBLIC_URL` is wrong; check Settings › Integrations › Media storage. |
| Emails don't arrive | Test in Settings › Email settings (it shows the mail server's error); check spam and SPF/DKIM. |
| Payments stay pending | Razorpay webhook URL/secret; delivery log in the Razorpay dashboard. |
| Scheduled posts don't publish, retention rules don't run | `/api/cron` isn't called or `CRON_SECRET` doesn't match (Docker: the `cron` container; Vercel: Cron Jobs or your outside scheduler). |
| "Column does not exist" after an update | Migrations weren't applied: `npm run db:deploy`, then restart. |
| Analytics shows fewer visitors | Expected: tracking now waits for cookie consent. Check the accept rate in Compliance & Privacy › Cookies. |
| Privacy policy page still shows the old text | No version is published yet in Compliance & Privacy › Legal documents (the old Website page shows until then). |
| Someone can't sign in after many tries | Their network or account was blocked after repeated wrong passwords: Team & security › Blocked sign-ins. |
| Edit mode: saving fails, or templates don't save | Migrations haven't run: `npm run db:deploy` (or `npm run db:migrate` locally), then restart. |
| Edit mode: changes don't show for visitors | They're still drafts: click **Publish** in the edit bar. |
| “Edit this page” doesn't appear | Edit Mode is switched off, or the account's role doesn't have “Edit on the website”. |

## Scaling notes

- Pages render per request while data comes from `unstable_cache` with tag-based invalidation, so admin edits appear immediately. For high traffic, add a CDN with short `s-maxage` rules for public paths.
- Search uses PostgreSQL full-text and trigram indexes (tens of thousands of listings). Beyond that, implement `SearchProvider` in `src/server/services/search.ts` for Meilisearch/Typesense/OpenSearch.
- Rate limits are stored in PostgreSQL so they work across serverless instances; move them to Redis for very high traffic.
- Put media behind a CDN (`STORAGE_PUBLIC_URL`); `next/image` handles resizing.
