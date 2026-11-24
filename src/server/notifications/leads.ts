import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";
import type { SendResult } from "@/server/email";
import { sendTemplate } from "@/server/email/config";
import { detailsTable, escapeHtml, type TemplateKey } from "@/server/email/templates";
import { leadWebhook, signWebhook, slackLeads } from "@/server/integrations";
import { getSettings } from "@/server/settings";
import { hasLeadContactAccess } from "@/server/services/billing";
import { maskContactsInText, maskEmail, maskPhone } from "@/lib/mask";

type Channel = "email" | "webhook" | "slack";
const MAX_ATTEMPTS = 5;

async function loadLead(leadId: string) {
  return db.lead.findUnique({
    where: { id: leadId },
    include: {
      software: { include: { software: { select: { name: true, slug: true } } } },
      vendor: { select: { id: true, name: true, email: true, receivesLeads: true } },
      resellers: {
        select: {
          reseller: {
            select: {
              id: true, name: true, email: true, receivesLeads: true, isActive: true,
              users: { where: { status: "ACTIVE", role: { permissions: { some: { permission: { key: "vendor.leads" } } } } }, select: { email: true } },
            },
          },
        },
      },
    },
  });
}
type LoadedLead = NonNullable<Awaited<ReturnType<typeof loadLead>>>;
type LeadReseller = LoadedLead["resellers"][number]["reseller"];

const resellerRecipients = (r: LeadReseller) => (r.email ? [r.email.toLowerCase()] : r.users.map((u) => u.email.toLowerCase()));
/** Which of the lead's resellers an email address belongs to. */
const resellerFor = (lead: LoadedLead, email: string) => lead.resellers.map((x) => x.reseller).find((r) => resellerRecipients(r).includes(email.toLowerCase())) ?? null;

function summary(lead: LoadedLead) {
  const products = lead.software.map((s) => s.software.name).join(", ") || (lead.source === "LIST_SOFTWARE" ? "Software listing request" : lead.source === "BECOME_RESELLER" ? "Reseller application" : "General enquiry");
  return { products, adminUrl: `${env.APP_URL}/admin/leads/${lead.id}` };
}

function leadVars(lead: LoadedLead) {
  const { products, adminUrl } = summary(lead);
  return {
    reference: lead.referenceNo,
    lead_name: lead.name,
    lead_email: lead.email,
    lead_phone: lead.phone,
    lead_company: lead.company ?? "",
    products,
    product_suffix: lead.software.length ? ` — ${products}` : "",
    requirement: lead.requirement ?? "",
    admin_url: adminUrl,
    lead_details: detailsTable([
      ["Reference", lead.referenceNo],
      ["Products", products],
      ["Name", lead.name],
      ["Email", lead.email],
      ["Phone", lead.phone],
      ["Company", lead.company ? `${lead.company}${lead.companySize ? ` (${lead.companySize})` : ""}` : null],
      ["City", lead.city],
      ["Requirement", lead.requirement],
      ["Message", lead.message],
    ]),
  };
}

/** What a vendor's (or reseller's) email shows: contact details only with an active plan. */
async function vendorLeadVars(lead: LoadedLead, company: { id: string; name: string } | null = lead.vendor) {
  const unlocked = company ? await hasLeadContactAccess(company.id) : false;
  const { products } = summary(lead);
  const portalUrl = `${env.APP_URL}/vendor/leads/${lead.id}`;
  const text = (t: string | null) => (t && !unlocked ? maskContactsInText(t) : t);
  return {
    vendor_name: company?.name ?? "",
    reference: lead.referenceNo,
    lead_name: lead.name,
    lead_company: lead.company ?? "",
    products,
    requirement: lead.requirement ?? "",
    portal_url: portalUrl,
    lead_details: detailsTable([
      ["Products", products],
      ["Name", lead.name],
      ["Email", unlocked ? lead.email : maskEmail(lead.email)],
      ["Phone", unlocked ? lead.phone : maskPhone(lead.phone)],
      ["Company", lead.company ? `${lead.company}${lead.companySize ? ` (${lead.companySize})` : ""}` : null],
      ["City", lead.city],
      ["Requirement", text(lead.requirement)],
      ["Message", text(lead.message)],
    ]),
    unlock_block: unlocked
      ? ""
      : `<p style="padding:12px 14px;background:#FFF7E6;border-radius:8px">The buyer's email and phone number are hidden. <a href="${escapeHtml(`${env.APP_URL}/vendor/plans`)}">Buy a plan</a> to see contact details for all your enquiries.</p>`,
    unlocked,
  };
}

/** Email events and the template each one uses. */
const EMAIL_TEMPLATE: Record<string, TemplateKey> = { "lead.created": "lead_new", "lead.vendor": "lead_vendor", "lead.reseller": "lead_reseller", "lead.confirmation": "lead_confirmation", "lead.listing": "listing_received", "lead.reseller_application": "reseller_received" };

async function deliver(channel: Channel, target: string, lead: LoadedLead, event = "lead.created"): Promise<SendResult | void> {
  const { products, adminUrl } = summary(lead);
  if (channel === "email") {
    const key = EMAIL_TEMPLATE[event] ?? "lead_new";
    if (key === "lead_vendor") {
      const { unlocked, ...vars } = await vendorLeadVars(lead);
      return sendTemplate(key, target, vars, { replyTo: unlocked ? lead.email : undefined });
    }
    if (key === "lead_reseller") {
      const reseller = resellerFor(lead, target);
      if (!reseller) return { delivered: false, reason: "No longer a reseller of this product" };
      const { unlocked, ...vars } = await vendorLeadVars(lead, reseller);
      // Resellers use the portal at /reseller/….
      const resellerVars = { ...vars, portal_url: vars.portal_url.replace("/vendor/", "/reseller/"), unlock_block: vars.unlock_block.replace("/vendor/plans", "/reseller/plans") };
      return sendTemplate(key, target, resellerVars, { replyTo: unlocked ? lead.email : undefined });
    }
    return sendTemplate(key, target, leadVars(lead), { replyTo: key === "lead_new" ? lead.email : undefined });
  }
  if (channel === "webhook") {
    const webhook = await leadWebhook();
    const body = JSON.stringify({
      event: "lead.created",
      lead: {
        id: lead.id,
        referenceNo: lead.referenceNo,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        companySize: lead.companySize,
        city: lead.city,
        requirement: lead.requirement,
        message: webhook?.includeMessage === false ? undefined : lead.message,
        source: lead.source,
        sourceUrl: lead.sourceUrl,
        utm: { source: lead.utmSource, medium: lead.utmMedium, campaign: lead.utmCampaign },
        software: lead.software.map((s) => ({ name: s.software.name, slug: s.software.slug })),
        createdAt: lead.createdAt.toISOString(),
      },
    });
    const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "Cadgram-Webhooks/1" };
    if (webhook?.secret) headers["X-Cadgram-Signature"] = signWebhook(webhook.secret, body);
    const res = await fetch(target, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    return;
  }
  const slack = await slackLeads();
  const mention = lead.priority === "HIGH" && slack?.mention ? `${slack.mention} ` : "";
  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `${mention}New enquiry *${lead.referenceNo}* for ${products} from ${lead.name}${lead.company ? ` (${lead.company})` : ""}. <${adminUrl}|Open lead>` }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Slack responded ${res.status}`);
}

/** Works out recipients for a new lead and creates PENDING log rows. */
async function plan(lead: LoadedLead): Promise<{ channel: Channel; target: string; event: string }[]> {
  const settings = await getSettings();
  const out: { channel: Channel; target: string; event: string }[] = [];
  if (settings.leads.emailSalesOnNewLead) {
    for (const to of settings.leads.notifyEmails) out.push({ channel: "email", target: to, event: "lead.created" });
  }
  if (settings.leads.notifyVendor && lead.vendor?.receivesLeads && lead.vendor.email) out.push({ channel: "email", target: lead.vendor.email, event: "lead.vendor" });
  if (settings.leads.notifyResellers) {
    // Every reseller of the enquired products: their company email, or their users who can see leads.
    const sent = new Set<string>();
    for (const { reseller } of lead.resellers) {
      if (!reseller.isActive || !reseller.receivesLeads) continue;
      for (const to of resellerRecipients(reseller)) {
        if (sent.has(to)) continue;
        sent.add(to);
        out.push({ channel: "email", target: to, event: "lead.reseller" });
      }
    }
  }
  if (lead.source === "LIST_SOFTWARE") {
    // Software companies asking to be listed always get the “Listing request received” email (it can be switched off as a template).
    if (lead.email) out.push({ channel: "email", target: lead.email, event: "lead.listing" });
  } else if (lead.source === "BECOME_RESELLER") {
    if (lead.email) out.push({ channel: "email", target: lead.email, event: "lead.reseller_application" });
  } else if (settings.leads.emailConfirmation && lead.email) out.push({ channel: "email", target: lead.email, event: "lead.confirmation" });
  const webhook = await leadWebhook();
  if (webhook) out.push({ channel: "webhook", target: webhook.url, event: "lead.created" });
  const slack = await slackLeads();
  if (slack) out.push({ channel: "slack", target: slack.url, event: "lead.created" });
  return out;
}

async function attempt(logId: string, channel: Channel, target: string, lead: LoadedLead, event = "lead.created") {
  try {
    const result = await deliver(channel, target, lead, event);
    if (result && !result.delivered) {
      // Switched off, template off or no SMTP yet: recorded, not retried.
      await db.notificationLog.update({ where: { id: logId }, data: { status: "SKIPPED", attempts: { increment: 1 }, error: (result.reason ?? "Not sent").slice(0, 500) } });
      return;
    }
    await db.notificationLog.update({ where: { id: logId }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, error: null } });
    await db.leadActivity.create({ data: { leadId: lead.id, type: "NOTIFICATION_SENT", toValue: `${channel}:${channel === "email" ? target : "configured endpoint"}` } });
  } catch (e) {
    await db.notificationLog.update({
      where: { id: logId },
      data: { status: "FAILED", attempts: { increment: 1 }, error: e instanceof Error ? e.message.slice(0, 500) : "Unknown error" },
    });
  }
}

/** Called after a lead is committed. Never throws: delivery failures are logged for retry. */
export async function notifyLeadCreated(leadId: string): Promise<void> {
  try {
    const lead = await loadLead(leadId);
    if (!lead) return;
    for (const { channel, target, event } of await plan(lead)) {
      // Webhook/Slack targets are secrets; log a redacted target.
      const log = await db.notificationLog.create({
        data: { channel, target: channel === "email" ? target : `${channel} (configured endpoint)`, event, leadId },
      });
      await attempt(log.id, channel, target, lead, event);
    }
    if (lead.assignedToId) await notifyLeadAssigned(lead.id, lead.assignedToId);
  } catch (e) {
    console.error("[notifications] failed to dispatch lead notifications", e);
  }
}

/** Retries FAILED deliveries; run from the cron endpoint. */
export async function retryFailedNotifications(): Promise<number> {
  const failed = await db.notificationLog.findMany({
    where: { status: "FAILED", attempts: { lt: MAX_ATTEMPTS }, leadId: { not: null }, event: { not: "lead.assigned" }, createdAt: { gt: new Date(Date.now() - 2 * 86_400_000) } },
    take: 50,
  });
  for (const log of failed) {
    const lead = await loadLead(log.leadId as string);
    if (!lead) continue;
    const target =
      log.channel === "email" ? log.target : log.channel === "webhook" ? (await leadWebhook())?.url : (await slackLeads())?.url;
    if (!target) {
      await db.notificationLog.update({ where: { id: log.id }, data: { status: "SKIPPED", error: "Endpoint no longer configured" } });
      continue;
    }
    await attempt(log.id, log.channel as Channel, target, lead, log.event);
  }
  return failed.length;
}

/** Emails a staff member when a lead is assigned to them (if enabled). Never throws. */
export async function notifyLeadAssigned(leadId: string, assigneeId: string, actorId?: string): Promise<void> {
  try {
    if (assigneeId === actorId) return; // no email for assigning a lead to yourself
    const settings = await getSettings();
    if (!settings.leads.emailAssignee) return;
    const [lead, staff] = await Promise.all([loadLead(leadId), db.user.findUnique({ where: { id: assigneeId }, select: { name: true, email: true, status: true } })]);
    if (!lead || !staff || staff.status !== "ACTIVE") return;
    const log = await db.notificationLog.create({ data: { channel: "email", target: staff.email, event: "lead.assigned", leadId } });
    try {
      const r = await sendTemplate("lead_assigned", staff.email, { ...leadVars(lead), staff_name: staff.name });
      await db.notificationLog.update({ where: { id: log.id }, data: r.delivered ? { status: "SENT", sentAt: new Date(), attempts: 1 } : { status: "SKIPPED", attempts: 1, error: (r.reason ?? "Not sent").slice(0, 500) } });
    } catch (e) {
      await db.notificationLog.update({ where: { id: log.id }, data: { status: "FAILED", attempts: 1, error: e instanceof Error ? e.message.slice(0, 500) : "Unknown error" } });
    }
  } catch (e) {
    console.error("[notifications] lead assignment email failed", e);
  }
}
