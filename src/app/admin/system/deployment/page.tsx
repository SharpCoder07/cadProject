import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Rocket } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { loadStorageConfig } from "@/server/storage/config";
import { resolveDelivery } from "@/server/email/config";
import { getRazorpaySettings } from "@/server/payments/razorpay";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { versionsInForce } from "@/server/services/compliance/legal";
import { CodeBlock } from "./code-block";

export const metadata = { title: "Deployment guide" };
export const dynamic = "force-dynamic";

type Check = { label: string; ok: boolean | null; detail: string; href?: string };

/** One numbered step of a section. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative flex gap-4">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-soft text-xs font-bold text-mint-ink" aria-hidden>{n}</span>
      <div className="min-w-0 flex-1 pb-1">
        <h3 className="font-sans text-[15px] font-semibold text-ink">{title}</h3>
        <div className="mt-1 space-y-2 text-sm leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-ink [&_code]:rounded [&_code]:bg-ink/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-ink">{children}</div>
      </div>
    </li>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel className="scroll-mt-24" >
      <div id={id} className="scroll-mt-24" />
      <PanelHeader title={title} description={description} />
      <ol className="space-y-5 p-5">{children}</ol>
    </Panel>
  );
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} className="font-medium text-primary hover:underline">{children}</Link>;

export default async function DeploymentGuide() {
  await requirePermission("system.manage", "/admin/system/deployment");
  const [settings, storage, delivery, razorpay, legalInForce] = await Promise.all([
    getSettings(),
    loadStorageConfig().catch(() => null),
    resolveDelivery().catch(() => null),
    getRazorpaySettings().catch(() => null),
    versionsInForce(["privacy-policy", "terms"]).catch(() => null),
  ]);
  const compliance = settings.compliance ?? ({} as Partial<typeof settings.compliance>);
  const appUrl = env.APP_URL.replace(/\/$/, "");
  const prod = env.NODE_ENV === "production";
  const checks: Check[] = [
    { label: "Running in production mode", ok: prod, detail: prod ? "NODE_ENV is production." : `NODE_ENV is ${env.NODE_ENV}. That's expected on your computer; the live server must run in production mode.` },
    { label: "Website address uses HTTPS", ok: appUrl.startsWith("https://"), detail: `APP_URL is ${appUrl}` },
    { label: "Scheduled jobs are protected", ok: Boolean(env.CRON_SECRET), detail: env.CRON_SECRET ? "CRON_SECRET is set." : "Set CRON_SECRET so scheduled publishing, retries and clean-up can run." },
    {
      label: "Media storage suits a live server",
      ok: storage ? storage.driver !== "local" : null,
      detail: storage ? (storage.driver === "local" ? "Files are saved on this server's disk. Use Azure Blob Storage (or S3) live, or make sure the disk is permanent and backed up." : `Using ${storage.driver === "azure" ? "Azure Blob Storage" : "S3-compatible storage"} (set in ${storage.source === "admin" ? "Integrations" : "environment variables"}).`) : "Couldn't read the storage settings.",
      href: "/admin/integrations",
    },
    {
      label: "Emails are delivered",
      ok: delivery ? delivery.mode === "db" || (delivery.mode === "env" && env.EMAIL_DRIVER !== "console") : null,
      detail: !delivery ? "Couldn't read the email settings." : delivery.mode === "db" ? "Sending through the SMTP server set in Settings › Email settings." : delivery.mode === "off" ? "Email sending is turned off." : env.EMAIL_DRIVER === "console" ? "Emails are only printed to the server log. Set up SMTP in Settings › Email settings." : `Sending with ${env.EMAIL_DRIVER} (environment variables).`,
      href: "/admin/settings/email",
    },
    {
      label: "Online payments use live keys",
      ok: razorpay ? razorpay.enabled && razorpay.mode === "live" && razorpay.hasWebhookSecret : null,
      detail: !razorpay ? "Couldn't read the payment settings." : !razorpay.enabled ? "Razorpay is off, so vendors can't buy plans online." : razorpay.mode !== "live" ? "Razorpay is using test keys." : razorpay.hasWebhookSecret ? "Live keys and webhook secret are saved." : "Add the webhook secret so payments are confirmed even if the buyer closes the page.",
      href: "/admin/settings/payments",
    },
    {
      label: "Privacy policy and terms are published",
      ok: legalInForce ? legalInForce.length === 2 : null,
      detail: !legalInForce ? "Couldn't read Legal documents (run the latest migrations)." : legalInForce.length === 2 ? "Both have a version in force in Compliance & Privacy › Legal documents." : `${2 - legalInForce.length === 2 ? "Neither has" : "One of them has no"} version in force yet; the old Website page shows until you publish one.`,
      href: "/admin/compliance/legal",
    },
    {
      label: "Grievance officer is set",
      ok: Boolean(compliance.grievanceOfficerName && (compliance.grievanceOfficerEmail || compliance.privacyEmail)),
      detail: compliance.grievanceOfficerName ? "Name and contact are shown on the Privacy center." : "Add the grievance officer's name and email in Compliance & Privacy › Compliance settings (shown on /privacy-center).",
      href: "/admin/compliance/settings",
    },
    { label: "Search engines may index the site", ok: settings.seo.allowIndexing, detail: settings.seo.allowIndexing ? "Indexing is on. Turn it off on a staging copy." : "Indexing is off. Turn it on for the live site (keep it off on staging).", href: "/admin/seo" },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const toc = [
    ["before", "1. Before you start"],
    ["env", "2. Environment variables"],
    ["docker", "3a. Deploy with Docker"],
    ["vercel", "3b. Deploy on Vercel"],
    ["first-run", "4. First sign-in and set-up"],
    ["update", "5. Updating to a new version"],
    ["backups", "6. Backups and recovery"],
    ["checklist", "7. Go-live checklist"],
    ["trouble", "8. Troubleshooting"],
  ];

  return (
    <>
      <PageHeader title="Deployment guide" description="How to put Cadgram live on a server, set it up, keep it updated and back it up. Only Super Admins see this page." />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-4">
          <Panel>
            <PanelHeader
              title={<span className="flex items-center gap-2"><Rocket className="h-4 w-4 text-muted" aria-hidden />Readiness on this server</span>}
              description={`${passed} of ${checks.length} checks pass. Live values from the server this admin is running on.`}
            />
            <ul className="divide-y divide-line">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-3 px-5 py-3">
                  {c.ok === true ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="OK" /> : c.ok === false ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309] dark:text-amber-300" aria-label="Needs attention" /> : <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-label="Unknown" />}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-ink">{c.label}</p>
                    <p className="text-muted [overflow-wrap:anywhere]">{c.detail}</p>
                  </div>
                  {c.href && c.ok !== true && <Link href={c.href} className="shrink-0 text-sm font-semibold text-ink hover:underline">Open</Link>}
                </li>
              ))}
            </ul>
          </Panel>

          <Section id="before" title="1. Before you start" description="What you need before deploying.">
            <Step n={1} title="A server or hosting platform">
              <p>Either a Linux server (VPS) with <strong>Docker</strong> (2 vCPU, 4 GB RAM is a comfortable start), or a <strong>Vercel</strong> account. The app needs <strong>Node.js 20.11 or newer</strong>.</p>
            </Step>
            <Step n={2} title="A PostgreSQL database">
              <p><strong>PostgreSQL 14 or newer</strong> (16 recommended). Docker includes one; on Vercel use a managed database such as Neon, Supabase or Azure Database for PostgreSQL, ideally in an Indian region (Mumbai/Pune) close to your users.</p>
            </Step>
            <Step n={3} title="Your domain and HTTPS">
              <p>Point your domain (for example <code>www.cadgram.com</code>) to the server. Vercel adds HTTPS automatically; on a VPS use a reverse proxy such as Caddy (see step 3a).</p>
            </Step>
            <Step n={4} title="Email, storage and payments accounts">
              <p><strong>Email:</strong> an SMTP mailbox (Microsoft 365, Google Workspace, Zoho, Amazon SES…) or a Resend account, with SPF, DKIM and DMARC set up for your domain.</p>
              <p><strong>Media storage:</strong> an <strong>Azure Storage account</strong> with a blob container (recommended), or any S3-compatible bucket. Local disk only works on a server whose disk is permanent and backed up.</p>
              <p><strong>Payments:</strong> a Razorpay account with <strong>live</strong> API keys, so vendors and resellers can buy plans.</p>
              <p><strong>Legal:</strong> your privacy policy and terms, reviewed by a lawyer. You publish them from the admin (section 4, step 8).</p>
            </Step>
          </Section>

          <Section id="env" title="2. Environment variables" description="Settings the server reads at start-up. Never commit them to Git.">
            <Step n={1} title="Copy the template">
              <CodeBlock code={"cp .env.example .env"} />
            </Step>
            <Step n={2} title="Create two secrets">
              <p>Run this twice and paste one result into <code>APP_SECRET</code> and the other into <code>CRON_SECRET</code>. <strong>Keep APP_SECRET safe and never change it later:</strong> saved passwords for email, storage and Razorpay are encrypted with it.</p>
              <CodeBlock code={"openssl rand -base64 48"} />
            </Step>
            <Step n={3} title="Fill in the required values">
              <div className="overflow-x-auto rounded-control border border-line">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-bg text-xs text-muted"><tr><th className="px-3 py-2 font-semibold">Variable</th><th className="px-3 py-2 font-semibold">What to set</th></tr></thead>
                  <tbody className="divide-y divide-line text-ink">
                    {[
                      ["DATABASE_URL", "Connection string of your database (the pooled one on Neon/Supabase)."],
                      ["DIRECT_DATABASE_URL", "Direct (non-pooled) connection string; used for migrations."],
                      ["APP_URL", "Your live address with https://, no trailing slash, e.g. https://www.cadgram.com"],
                      ["APP_SECRET", "The first random value from step 2."],
                      ["CRON_SECRET", "The second random value from step 2."],
                      ["NODE_ENV", "production (Docker and Vercel set this for you)."],
                      ["EMAIL_FROM", "Sender shown on emails, e.g. Cadgram <no-reply@cadgram.com>. SMTP itself can be set later in Settings › Email settings."],
                      ["STORAGE_DRIVER", "Leave as is; choose Azure later in Settings › Integrations › Media storage. For Docker with the bundled storage, compose sets s3 for you."],
                      ["SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD", "Email and a strong temporary password for the first Super Admin (used once, step 4)."],
                      ["SEED_SAMPLE_DATA", "false on the live site, so demo products and accounts aren't created."],
                    ].map(([k, v]) => (
                      <tr key={k}><td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]">{k}</td><td className="px-3 py-2 text-muted">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Optional: <code>SESSION_TTL_DAYS</code> (default 14), <code>MAX_UPLOAD_MB</code> (default 10), <code>LEADS_WEBHOOK_URL</code> / <code>SLACK_LEADS_WEBHOOK_URL</code> to send every new lead to another system. <code>VAPID_PUBLIC_KEY</code> / <code>VAPID_PRIVATE_KEY</code> / <code>VAPID_SUBJECT</code> for browser push pop-ups (generated and saved automatically when left empty; pop-ups need HTTPS).</p>
            </Step>
          </Section>

          <Section id="docker" title="3a. Deploy with Docker (VPS)" description="One server running the app, PostgreSQL, file storage and the scheduled jobs.">
            <Step n={1} title="Install Docker and get the code">
              <CodeBlock code={"curl -fsSL https://get.docker.com | sh\ngit clone <your-repository-url> cadgram && cd cadgram"} />
            </Step>
            <Step n={2} title="Add your .env file">
              <p>Create <code>.env</code> as in section 2 and also set <code>POSTGRES_PASSWORD</code>, <code>S3_ACCESS_KEY_ID</code> and <code>S3_SECRET_ACCESS_KEY</code> to strong values (used by the bundled database and MinIO storage).</p>
            </Step>
            <Step n={3} title="Start everything">
              <p>This builds the app and starts PostgreSQL, MinIO (file storage), the app and a job that calls <code>/api/cron</code> every 5 minutes. Database migrations run automatically each time the app starts.</p>
              <CodeBlock code={"docker compose up -d --build\ndocker compose ps"} />
            </Step>
            <Step n={4} title="Add HTTPS with Caddy">
              <p>Install Caddy on the server and use this <code>/etc/caddy/Caddyfile</code>, then run <code>sudo systemctl reload caddy</code>. Caddy gets and renews the certificate itself.</p>
              <CodeBlock label="Caddyfile" code={`${appUrl.startsWith("https://") ? appUrl.replace("https://", "") : "www.cadgram.com"} {\n  reverse_proxy localhost:3000\n}\n\nmedia.${(appUrl.startsWith("https://") ? appUrl.replace("https://", "") : "www.cadgram.com").replace(/^www\./, "")} {\n  reverse_proxy localhost:9000\n}`} />
              <p>Then set <code>STORAGE_PUBLIC_URL</code> to <code>https://media.…/cadgram-media</code> in <code>.env</code> and run <code>docker compose up -d</code> again. Using Azure instead? Remove the <code>minio</code> and <code>minio-setup</code> services and pick Azure in Integrations after the first sign-in.</p>
            </Step>
            <Step n={5} title="Create the first Super Admin">
              <p>Run once, from a computer with the code and Node.js that can reach the database (or open a shell in the app container):</p>
              <CodeBlock code={"DATABASE_URL='postgresql://…' NODE_ENV=production \\\nSEED_ADMIN_EMAIL='you@yourcompany.in' SEED_ADMIN_PASSWORD='a-strong-temporary-password' \\\nSEED_SAMPLE_DATA=false npm run db:seed"} />
            </Step>
          </Section>

          <Section id="vercel" title="3b. Deploy on Vercel" description="Managed hosting; database and storage come from other services.">
            <Step n={1} title="Create the database and storage">
              <p>Create a PostgreSQL database (Neon, Supabase or Azure) and an Azure Storage account with a container. Keep both connection details handy.</p>
            </Step>
            <Step n={2} title="Import the project">
              <p>In Vercel, <strong>Add New → Project</strong>, pick the repository, and add the environment variables from section 2 for the <strong>Production</strong> environment.</p>
            </Step>
            <Step n={3} title="Run migrations on every deploy">
              <p>Set the <strong>Build Command</strong> to:</p>
              <CodeBlock code={"npx prisma migrate deploy && npm run build"} />
            </Step>
            <Step n={4} title="Scheduled jobs">
              <p><code>vercel.json</code> already calls <code>/api/cron</code> every 5 minutes, and Vercel sends <code>CRON_SECRET</code> with it automatically. Running a job every 5 minutes needs a paid Vercel plan (the free plan limits how often scheduled jobs run; check Vercel&apos;s current limits). Otherwise use an outside scheduler that calls this address every 5 minutes with the header <code>Authorization: Bearer &lt;CRON_SECRET&gt;</code>:</p>
              <CodeBlock code={`${appUrl}/api/cron`} />
            </Step>
            <Step n={5} title="Domain and first Super Admin">
              <p>Add your domain under <strong>Settings → Domains</strong>, then create the first Super Admin from your computer with the command in step 3a.5, using the live <code>DATABASE_URL</code>.</p>
            </Step>
          </Section>

          <Section id="first-run" title="4. First sign-in and set-up" description="Do these in the admin panel right after deploying.">
            <Step n={1} title="Sign in and secure the account">
              <p>Sign in at <code>{appUrl}/login</code> on the <strong>Team</strong> tab. Two-step verification is required: scan the QR code with an authenticator app and save the backup codes somewhere safe. Then change the temporary password in <A href="/admin/account">My account</A>.</p>
            </Step>
            <Step n={2} title="Brand and website">
              <p><A href="/admin/settings">Settings › Website settings</A>: site name, logo, logo for dark backgrounds, favicon, contact details. <A href="/admin/settings?tab=theme">Settings › Website design</A>: Classic or Fresh Lime Design (Lime or Teal), colours, fonts and animations. Then review the homepage, menus and footer.</p>
            </Step>
            <Step n={3} title="Media storage">
              <p><A href="/admin/integrations">Settings › Integrations › Media storage</A>: enter the Azure account, key and container, test, and make it active. If files were uploaded before, use the move button there to copy them across.</p>
            </Step>
            <Step n={4} title="Email">
              <p><A href="/admin/settings/email">Settings › Email settings</A>: enter the SMTP server, test the connection and send yourself a test email. Lead alert recipients are set on the same page. Then send a test enquiry from the website.</p>
            </Step>
            <Step n={5} title="Payments">
              <p><A href="/admin/settings/payments">Partners › Plans &amp; billing › Payment settings</A>: paste the Razorpay <strong>live</strong> Key ID and Key Secret. In the Razorpay dashboard add a webhook with this URL, select <code>payment.captured</code> and <code>order.paid</code>, and paste its secret back here:</p>
              <CodeBlock label="Webhook URL" code={`${appUrl}/api/webhooks/razorpay`} />
              <p>Then create the plans under <A href="/admin/billing/plans">Partners › Plans &amp; billing › Vendor plans</A>.</p>
            </Step>
            <Step n={6} title="Team, SEO and content">
              <p>Invite staff in <A href="/admin/users">Team & security › Users</A> and adjust <A href="/admin/roles">Team & security › Roles &amp; permissions</A>. In <A href="/admin/seo">SEO &amp; redirects</A> turn on <strong>Allow search engines to index the site</strong>, then submit <code>{appUrl}/sitemap.xml</code> in Google Search Console.</p>
            </Step>
            <Step n={7} title="Website edit mode">
              <p>Editing on the live pages is on by default for Super Admin and Admin (<A href="/admin/settings?tab=editMode">Settings › Website settings › Edit Mode</A>). Give other staff roles the <strong>“Edit on the website”</strong> permission only if they should use it.</p>
            </Step>
            <Step n={8} title="Compliance & Privacy">
              <p>The full guide is <code>docs/COMPLIANCE.md</code>. In order:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li><A href="/admin/compliance/settings">Compliance settings</A>: legal entity, privacy contact, grievance officer; timelines only once your lawyer confirms them.</li>
                <li><A href="/admin/compliance/legal">Legal documents</A>: write, review and publish the privacy policy, terms and the other documents. Published versions replace the old Website pages at the same addresses.</li>
                <li><A href="/admin/compliance/consent">Consent</A> and <A href="/admin/compliance/cookies">Cookies</A>: check the purposes and cookie list. Analytics and marketing tags load only after a visitor accepts them, so visitor numbers in those tools will be lower than before.</li>
                <li><A href="/admin/compliance/retention">Data retention</A>: set the periods with your lawyer and switch the rules on.</li>
                <li><A href="/admin/cms/menus">Navigation menus</A>: add <code>/privacy-center</code> and the legal pages to the footer.</li>
                <li><A href="/admin/compliance">Compliance &amp; Privacy › Overview</A>: the “Needs attention” list should be empty or understood.</li>
              </ul>
            </Step>
          </Section>

          <Section id="update" title="5. Updating to a new version" description="Each update can include database changes; they're applied automatically.">
            <Step n={1} title="Take a backup first">
              <p>Open <A href="/admin/system/backups">Backup &amp; restore</A> and click <strong>Back up now</strong>, and make sure your database provider&apos;s own backup is recent.</p>
            </Step>
            <Step n={2} title="Docker">
              <CodeBlock code={"git pull\ndocker compose up -d --build"} />
              <p>Database changes (new tables for edit mode, Compliance &amp; Privacy and so on) are applied when the new app container starts. Until they have run, the screens that use them show errors.</p>
            </Step>
            <Step n={3} title="Vercel">
              <p>Push to the production branch, or click <strong>Redeploy</strong>. The build command runs <code>prisma migrate deploy</code> first.</p>
            </Step>
            <Step n={4} title="Check it worked">
              <p>Open the website and the admin, look at a product page, the Leads list and this page&apos;s readiness checks. If something went wrong, restore the backup from step 1.</p>
            </Step>
          </Section>

          <Section id="backups" title="6. Backups and recovery">
            <Step n={1} title="Automatic database backups">
              <p>Turn on daily backups with point-in-time recovery at your database provider (Neon, Supabase and Azure include this). On the Docker setup, back up the <code>pgdata</code> volume or schedule <code>pg_dump</code>.</p>
              <CodeBlock code={"docker compose exec db pg_dump -U cadgram cadgram | gzip > cadgram-$(date +%F).sql.gz"} />
            </Step>
            <Step n={2} title="Full site copies">
              <p><A href="/admin/system/backups">Backup &amp; restore</A> saves the whole website, including uploads, and restores it. Download a copy before big changes and keep one off the server.</p>
              <p>Backups still hold personal data that retention rules or erasure requests removed, until the backup itself expires: agree how long backups are kept as part of your retention policy.</p>
            </Step>
            <Step n={3} title="Locked out of two-step verification">
              <p>If the only Super Admin loses their phone and backup codes, clear their two-step set-up from the command line; they set up a new authenticator at the next sign-in.</p>
              <CodeBlock code={"npm run auth:reset-2fa -- you@yourcompany.in"} />
            </Step>
          </Section>

          <Section id="checklist" title="7. Go-live checklist">
            {[
              ["Security", "APP_SECRET and CRON_SECRET are long random values; .env is not in Git; HTTPS works; the seeded password was changed; every staff account has two-step sign-in."],
              ["Sample data", "SEED_SAMPLE_DATA=false; no demo products, demo vendors or test accounts on the live site (the Test accounts page is hidden in production)."],
              ["Email", "Sending domain has SPF, DKIM and DMARC; test email and a test enquiry arrived."],
              ["Payments", "Razorpay live keys and webhook secret saved; a small test purchase activated a plan."],
              ["Storage", "Azure (or S3) is the active media storage; images load on product pages."],
              ["SEO", "Allow indexing on (off on staging); sitemap.xml and robots.txt load; old-site URLs added under SEO & redirects."],
              ["Edit mode", "Only the right roles have “Edit on the website”; no forgotten unpublished changes (the edit bar shows “All changes published”)."],
              ["Compliance & Privacy", "Privacy policy and terms published from Legal documents; grievance officer set; the cookie banner shows on a first visit; /privacy-center linked in the footer; the legal-review checklist in docs/COMPLIANCE.md gone through with your lawyer."],
              ["Operations", "Scheduled jobs run every 5 minutes; Team & security › Logs › Error logs checked regularly; an uptime check on the homepage; database backups are on."],
            ].map(([t, d], i) => (
              <Step key={t} n={i + 1} title={t!}><p>{d}</p></Step>
            ))}
          </Section>

          <Section id="trouble" title="8. Troubleshooting">
            {[
              ["The app won't start: “APP_SECRET must be at least 32 characters”", "An environment variable is missing or too short. Check .env (Docker) or the project's environment variables (Vercel), then restart."],
              ["Images don't show after deploying", "Media storage isn't public or STORAGE_PUBLIC_URL is wrong. Check Settings › Integrations › Media storage and open an image URL directly."],
              ["Emails aren't arriving", "Use Settings › Email settings to test the connection; the error message explains what the mail server said. Check spam folders and the domain's SPF/DKIM."],
              ["Payments stay “pending”", "The Razorpay webhook isn't reaching the site. Check the webhook URL and secret, and the delivery log in the Razorpay dashboard."],
              ["Scheduled posts don't publish, retention rules don't run", "/api/cron isn't being called or CRON_SECRET doesn't match. Check the cron container (Docker), Vercel → Cron Jobs, or your outside scheduler."],
              ["“Column does not exist” errors after an update", "The database changes weren't applied. Run npm run db:deploy against the live database, then restart the app."],
              ["Analytics shows fewer visitors", "Expected: tracking waits for cookie consent. See the accept rate in Compliance & Privacy › Cookies."],
              ["The privacy policy still shows the old text", "No version is published yet in Compliance & Privacy › Legal documents; the old Website page shows until then."],
              ["Someone can't sign in after many tries", "Their network or account was blocked after repeated wrong passwords: Team & security › Blocked sign-ins."],
              ["Edit mode: saving fails or changes don't show", "Saving fails: the migrations haven't run (npm run db:deploy). Not showing to visitors: they're drafts, click Publish in the edit bar."],
              ["“Edit this page” doesn't appear", "Edit Mode is switched off in Website settings, or the account's role doesn't have “Edit on the website”."],
            ].map(([t, d], i) => (
              <Step key={t} n={i + 1} title={t!}><p>{d}</p></Step>
            ))}
          </Section>
        </div>

        <aside className="hidden xl:block">
          <Panel className="sticky top-20">
            <PanelHeader title="On this page" />
            <nav className="p-2 text-sm">
              {toc.map(([id, label]) => (
                <a key={id} href={`#${id}`} className={cn("block rounded-lg px-3 py-1.5 text-muted hover:bg-bg hover:text-ink")}>{label}</a>
              ))}
            </nav>
          </Panel>
        </aside>
      </div>
    </>
  );
}
