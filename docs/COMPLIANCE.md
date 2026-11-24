# Compliance & Privacy module — handover

Everything privacy- and compliance-related on Cadgram lives in **Admin › Compliance & Privacy**. It was built in six phases on the existing stack (Next.js App Router, Prisma/Postgres, RBAC, audit log, email templates, `/api/cron`).

> Software helps you run these processes; it doesn't make the platform compliant on its own. No legal text, deadline or retention period is built in. Everything marked **Legal review** must be confirmed with an Indian privacy/technology lawyer (see the checklist at the end).

## 1. First-time setup (in this order)

1. `npm run db:migrate` (applies all compliance migrations), then `npm run db:test:prepare` and `npm test`.
2. **Compliance settings**: legal entity, privacy contact, grievance officer, DPO (if designated), applicability notes. Fill in the timelines only once your lawyer confirms them.
3. **Legal documents**: write or paste the text of each document, mark it as reviewed, publish. The privacy policy and terms take over their existing Website pages once published.
4. **Consent** and **Cookies**: check the purposes, cookie categories and cookie list match what the site really does. Analytics IDs are in Settings › Analytics.
5. **Data retention**: set a period for each rule, mark it reviewed, switch it on.
6. **Vendor compliance**: record KYC, data processing terms and review dates for companies that receive leads.
7. Add **/privacy-center** (and the legal pages) to the footer menu (Pages › Navigation menus).
8. Check **Overview**: the "Needs attention" list should be empty or understood.

## 2. Access

| Permission | Lets someone |
|---|---|
| `compliance.view` | Open every Compliance & Privacy page (emails masked) |
| `compliance.manage` | Change settings, documents, rules; work on requests |
| `compliance.sensitive` | See emails/phones unmasked and download someone's data (every unmasked view is logged as `privacy.record_view`) |
| `compliance.incidents` | View and record security incidents |

Only the Super Admin has them by default. They can be granted in Roles & permissions; Admin, Demo Viewer and view-only accounts never get them automatically.

## 3. What's where

| Admin page | Purpose |
|---|---|
| Overview `/admin/compliance` | "Needs attention" list and a tile per area |
| Data requests `/admin/compliance/requests` | Access, correction, erasure, consent withdrawal, nomination; built-in export, consent withdrawal and buyer-account erasure |
| Grievances `/admin/compliance/grievances` | Complaints for the grievance officer; acknowledge/resolve targets |
| Content complaints `/admin/compliance/content` | Copyright, trademark, defamation, personal-information and unlawful-content notices; record the action taken |
| Legal documents `/admin/compliance/legal` | Versioned documents: draft, preview, publish now/later, archive, compare, acceptances |
| Consent `/admin/compliance/consent` | Purposes and every consent given/withdrawn; privacy notice version |
| Cookies `/admin/compliance/cookies` | Banner on/off, notice version, remember-for days, categories and cookie list, choice log |
| Data retention `/admin/compliance/retention` | Retention rules, Run now, last run |
| Security incidents `/admin/compliance/incidents` | Incidents/breaches with reporting decision and history |
| Vendor compliance `/admin/compliance/vendors` | Agreement accepted, KYC, GSTIN, data terms, data role, reviews |
| Security & audit logs `/admin/compliance/security` | Live security-control checks and security/privacy events |
| Compliance settings `/admin/compliance/settings` | Entity, contacts, grievance officer, DPO, timelines, legal-review flag |

**Website and accounts**

| Where | What |
|---|---|
| Cookie banner (every page) | Accept all / Reject optional (equal prominence) / Customise; footer "Cookie settings"; `/#cookie-settings` opens it |
| `/privacy-center` | Rights, grievance officer, forms: data request, complaint, report content |
| `/privacy-center/confirm/<token>` | Email confirmation for requests sent without signing in (button, 72 h, single use) |
| `/<slug>` (e.g. `/privacy-policy`, `/terms`, `/cookie-policy`) | Legal document in force; `?version=1.0` for earlier versions |
| Sign-up | Optional, unticked consent boxes; records acceptance of the terms and privacy policy in force |
| Account › Settings › Privacy & consent | Switch optional consents; cookie settings |
| Account › Privacy center `/account/privacy` | Download my data (JSON), my requests and complaints, send a new one |
| Account area and partner portals | Update notice when a document asks to be accepted again |

## 4. Behaviour worth knowing

- **Tracking scripts** (GTM, GA4, Clarity) load only with analytics consent; Meta Pixel only with marketing consent. With the banner switched off they still don't load until a visitor opts in. Raising the cookie notice version asks everyone again.
- **Consent history**: withdrawing closes a record; giving consent again opens a new one. Each record stores the privacy notice version and where it was given.
- **Legal documents**: once published, a version's text can't change or be deleted (database trigger). Publishing with a future date schedules it (live within ~5 minutes of that time). Archiving the version in force brings back the previous one, or the Website page if there is none.
- **Requests sent without signing in** do nothing until the email link is confirmed. Signed-in buyers are verified by their session.
- **Target dates** come only from Compliance settings; when a timeline is empty there is no target date (none is assumed).
- **Erasure** (buyer accounts only) signs them out, deletes favourites, notifications and devices, anonymises the account, reviews and questions, withdraws consents, and optionally blanks enquiry contact details. Consent/acceptance history, the case and the audit log are kept as evidence. Staff and partner accounts are handled from Users.
- **Incidents** affecting personal data can't be resolved until the reporting decision is recorded.
- **Append-only records** (database triggers): audit log, legal acceptances, privacy-case history, incident history. The only exceptions are clearing a user link when an account is removed, and deletion by retention rules (they set `app.audit_purge` for their own transaction).

## 5. Data model (Prisma)

`ConsentPurpose`, `UserConsent`, `CookieCategory`, `CookiePreference`, `LegalDocument`, `LegalDocumentVersion`, `LegalAcceptance`, `PrivacyCase` (+ `PrivacyCaseEvent`), `RetentionRule`, `SecurityIncident` (+ `IncidentEvent`), `VendorCompliance`; `AuditLog` gained `actorType`, `result`, `metadata`.

Migrations: `20261123120000_compliance_foundation`, `20261123140000_consent_cookies`, `20261123160000_legal_documents`, `20261123180000_privacy_cases`, `20261123200000_compliance_ops`. They also insert the starting configuration (permissions, purposes, cookie categories, the 8 documents without text, the 5 retention rules switched off) — no demo records.

Code: services in `src/server/services/compliance/*`, shared rules in `src/lib/compliance/*`, admin pages in `src/app/admin/compliance/*`.

## 6. Scheduled jobs, emails, notifications

- **`/api/cron`** (every 5 minutes, `Authorization: Bearer $CRON_SECRET`): `runDueRetention()` runs each switched-on retention rule once a day; each run is audited (`compliance.retention_run`). Scheduled legal versions need no job.
- **Email templates** (Settings › Email settings): `privacy_verify` (can't be switched off), `privacy_received`, `privacy_update`.
- **Bell/push types**: `privacy.case` (staff with Compliance access: new request/complaint; Super Admins: new incident), `privacy.update` (buyer: update on their request).
- **Rate limits**: cookie choices 30/10 min per network; consent changes 30/10 min per person; privacy forms 5/hour per network; data download 5/hour per person.
- **No new environment variables** (uses `APP_URL`, `APP_SECRET`, `CRON_SECRET`).

## 7. Wording

Pages › Website texts groups: "Cookie banner and settings", "Account: privacy & consent", "Legal documents", "Privacy center".

## 8. Tests

- Unit: `tests/unit/compliance.test.ts`, `consent.test.ts`, `legal.test.ts`, `cases.test.ts`.
- Integration (test database): `tests/integration/compliance.test.ts` — consent history, cookie log, legal publish/immutability/scheduling/re-acceptance/archive, request verification and confirmation, resolution rules, append-only history, permissions, export without secrets, erasure, staff erasure refused, retention minimums and purge, daily runs, incidents, vendor records, overview.

Run `npm test` (needs `.env.test` pointing to a database whose name contains "test"; `npm run db:test:prepare` first).

## 9. Legal-review checklist

- [ ] Which laws and phases apply (DPDP Act 2023 and Rules 2025 commencement, IT Act and IT Rules 2021, Consumer Protection (E-Commerce) Rules 2020, CERT-In directions…) — record in Compliance settings › Applicability notes.
- [ ] Grievance officer and DPO (whether one is required).
- [ ] Timelines: grievance acknowledge/resolve, data requests, content complaints, incident reporting decision.
- [ ] Text of every legal document (privacy policy, terms, cookie policy, disclaimer, grievance policy, review policy, vendor and reseller agreements).
- [ ] Consent purposes, their wording, and whether sharing enquiries with vendors is part of the service or needs consent.
- [ ] Cookie categories and the cookie list.
- [ ] Requiring email confirmation for requests and complaints sent without signing in.
- [ ] What erasure must keep (invoices, dispute records, consent and acceptance evidence) and whether enquiry details are blanked.
- [ ] Every retention period (and how long backups keep removed data).
- [ ] Incident reporting decisions (Data Protection Board, CERT-In, people affected).
- [ ] Vendors' data role (independent or processor) and the terms needed with them.
- [ ] Children's data / verifiable parental consent if minors could use the platform (not built: the platform is for business buyers).

## 10. Not included / possible next steps

- Nomination requests are recorded and handled by hand (no nominee workflow).
- Correction requests are fulfilled in Users / enquiries / reviews by hand.
- No automatic reports to authorities; dates are recorded in the incident.
- Vendor documents (KYC, agreements signed outside the platform) are kept outside; only their status is recorded.
