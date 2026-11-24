import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { getTemplates, resolveDelivery } from "@/server/email/config";
import type { TemplateKey } from "@/server/email/templates";
import { isBuyerRoleKey } from "@/server/rbac/permissions";
import type { Principal } from "@/server/rbac/policy";

/**
 * "Email notifications" page: for the signed-in person, which emails they get, when, where they go
 * and whether each one is on right now (template switched off, a setting off, or their own preference).
 */

export type NotificationState = "on" | "off";

export interface MyEmail {
  key: TemplateKey;
  title: string;
  /** What makes it go out. */
  when: string;
  /** Where it's delivered. */
  to: string;
  state: NotificationState;
  /** Why it's off, or a useful detail. */
  note?: string;
  /** Where to change it, when this person can. */
  manage?: { label: string; href: string };
}

export interface MyEmails {
  /** Whether emails actually leave the server right now. */
  delivery: { mode: "smtp" | "off" | "console"; message: string };
  items: MyEmail[];
}

export async function getMyEmailNotifications(user: Principal): Promise<MyEmails> {
  const [settings, templates, delivery, me] = await Promise.all([
    getSettings(),
    getTemplates(),
    resolveDelivery().catch(() => ({ mode: "env" as const })),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, offerEmails: true, vendor: { select: { name: true, email: true, receivesLeads: true, kind: true } } } }),
  ]);
  const active = (k: TemplateKey) => templates.find((t) => t.key === k)?.active ?? true;
  const has = (p: Parameters<Principal["permissions"]["has"]>[0]) => user.permissions.has(p);
  const canSettings = has("settings.manage");
  const emailSettings = canSettings ? { label: "Email settings", href: "/admin/settings/email" } : undefined;
  const leadSettings = canSettings ? { label: "Email settings → Lead alerts", href: "/admin/settings/email" } : undefined;
  const templateOff = "Switched off by an administrator in Email settings.";

  const items: MyEmail[] = [];
  const add = (item: Omit<MyEmail, "state"> & { on: boolean }) => {
    const { on, ...rest } = item;
    items.push({ ...rest, state: on ? "on" : "off" });
  };

  if (isBuyerRoleKey(user.roleKey)) {
    // ─── Buyer accounts ───
    add({
      key: "offer_launched",
      title: "New offer on a favourite product",
      when: "An offer goes live on a product you saved to your favourites (one email per offer).",
      to: me.email,
      on: me.offerEmails && active("offer_launched"),
      note: !me.offerEmails ? "You turned offer emails off." : !active("offer_launched") ? templateOff : undefined,
      manage: { label: me.offerEmails ? "Change in Favourites" : "Turn on in Favourites", href: "/account/favourites" },
    });
    add({
      key: "question_answered",
      title: "Your question was answered",
      when: "Our team answers a question you asked on a product page (once, with the answer).",
      to: me.email,
      on: active("question_answered"),
      note: active("question_answered") ? undefined : templateOff,
    });
    add({
      key: "lead_confirmation",
      title: "Enquiry received",
      when: "You send an enquiry, ask for a quote or book a demo — confirms we got it.",
      to: "The email address you enter on the enquiry form",
      on: settings.leads.emailConfirmation && active("lead_confirmation"),
      note: !settings.leads.emailConfirmation ? "Not sent at the moment (turned off for the website)." : undefined,
    });
    add({
      key: "welcome_buyer",
      title: "Welcome email",
      when: "Once, right after you confirm your email address — a quick guide to comparing products, favourites and offers.",
      to: me.email,
      on: active("welcome_buyer"),
      note: active("welcome_buyer") ? "Sent only once, so you won't get it again." : templateOff,
    });
  } else if (user.vendorId) {
    // ─── Vendor-portal accounts ───
    const company = me.vendor;
    if (company?.kind === "RESELLER" && has("vendor.leads")) {
      add({
        key: "lead_reseller",
        title: "New enquiry for a product you resell",
        when: "A buyer enquires about any product you're authorised to resell. Contact details stay masked until you have a plan.",
        to: company.email ? `${company.name}'s company email (${company.email})` : "Your team members who can see leads (no company email saved)",
        on: company.receivesLeads && settings.leads.notifyResellers && active("lead_reseller"),
        note: !company.receivesLeads ? "Your company isn't set up to receive leads yet." : !settings.leads.notifyResellers ? "Reseller enquiry emails are turned off for the platform. You can still see leads under Leads." : !active("lead_reseller") ? templateOff : undefined,
        manage: { label: "Company profile", href: "/vendor/profile" },
      });
    } else if (has("vendor.leads")) {
      const sendsToCompany = settings.leads.notifyVendor && Boolean(company?.receivesLeads) && Boolean(company?.email);
      add({
        key: "lead_vendor",
        title: "New enquiry for your products",
        when: "A buyer sends an enquiry about one of your company's products. Contact details stay masked until you have a plan.",
        to: company?.email ? `${company.name}'s company email (${company.email})` : `${company?.name ?? "Your company"}'s company email — none saved yet`,
        on: sendsToCompany && active("lead_vendor"),
        note: !company?.email
          ? "Add a company email in Company profile to receive these."
          : !company.receivesLeads
            ? "Your company isn't set up to receive enquiries."
            : !settings.leads.notifyVendor
              ? "Vendor enquiry emails are turned off for the platform. You can still see enquiries under Leads."
              : company.email.toLowerCase() !== me.email.toLowerCase()
                ? "This goes to the company address, not your personal one."
                : undefined,
        manage: { label: "Company profile", href: "/vendor/profile" },
      });
    }
    if (["vendor.listings.submit", "vendor.profile", "vendor.reviews", "vendor.offers", "vendor.team.manage", "vendor.authorised"].some((p) => has(p as never))) {
      add({
        key: "approval_decision",
        title: "Your request was approved or rejected",
        when: company?.kind === "RESELLER"
          ? "The Super Admin approves or rejects a change you asked for — authorised products, company profile or team members — with any note they left."
          : "The Super Admin approves or rejects a change you asked for — products, company profile, offers, review replies or team members — with any note they left.",
        to: me.email,
        on: active("approval_decision"),
        note: active("approval_decision") ? undefined : templateOff,
        manage: { label: "Approval requests", href: "/vendor/requests" },
      });
    }
    if (has("vendor.billing")) {
      add({
        key: "subscription_active",
        title: "Plan activated (receipt)",
        when: "You buy or renew a subscription plan.",
        to: `${me.email} (or the company email if someone else bought it)`,
        on: active("subscription_active"),
        note: active("subscription_active") ? undefined : templateOff,
        manage: { label: "Plans & billing", href: "/vendor/plans" },
      });
    }
    add({
      key: company?.kind === "RESELLER" ? "welcome_reseller" : "welcome_vendor",
      title: company?.kind === "RESELLER" ? "Welcome to the reseller portal" : "Welcome to the vendor portal",
      when: "Once, right after you accept your invitation — a quick-start guide to your profile, listings, reviews and leads.",
      to: me.email,
      on: active(company?.kind === "RESELLER" ? "welcome_reseller" : "welcome_vendor"),
      note: active(company?.kind === "RESELLER" ? "welcome_reseller" : "welcome_vendor") ? "Sent only once, so you won't get it again." : templateOff,
    });
  } else {
    // ─── Staff accounts ───
    if (has("leads.view")) {
      const listed = settings.leads.notifyEmails.some((e) => e.toLowerCase() === me.email.toLowerCase());
      add({
        key: "lead_new",
        title: "New lead",
        when: "Someone sends an enquiry, asks for a quote or books a demo on the website, or a software company applies on “List your software”.",
        to: listed ? me.email : `Only the sales notification addresses${settings.leads.notifyEmails.length ? ` (${settings.leads.notifyEmails.join(", ")})` : " — none set yet"}`,
        on: listed && settings.leads.emailSalesOnNewLead && active("lead_new"),
        note: !listed
          ? "Your email isn't on the sales notification list."
          : !settings.leads.emailSalesOnNewLead
            ? "New-lead emails are turned off in Email settings."
            : !active("lead_new")
              ? templateOff
              : undefined,
        manage: leadSettings,
      });
      add({
        key: "lead_assigned",
        title: "Lead assigned to you",
        when: "Someone assigns a lead to you (not when you assign one to yourself).",
        to: me.email,
        on: settings.leads.emailAssignee && active("lead_assigned"),
        note: !settings.leads.emailAssignee ? "Assignment emails are turned off in Email settings." : !active("lead_assigned") ? templateOff : undefined,
        manage: leadSettings,
      });
    }
    if (has("approvals.manage")) {
      add({
        key: "approval_request",
        title: "Vendor approval request",
        when: "A vendor asks to add, change, publish, unpublish or delete a product, edit their company profile, add an offer, reply to a review or change their team — and again if they update a request that's still waiting.",
        to: me.email,
        on: active("approval_request"),
        note: active("approval_request") ? undefined : templateOff,
        manage: { label: "Approvals", href: "/admin/approvals" },
      });
    }
    if (has("reviews.moderate")) {
      add({
        key: "review_new",
        title: "New review to moderate",
        when: "A buyer posts a review (it waits for approval unless reviews publish without moderation).",
        to: me.email,
        on: active("review_new"),
        note: active("review_new") ? undefined : templateOff,
        manage: { label: "Reviews", href: "/admin/reviews?status=PENDING" },
      });
    }
    if (has("reviews.moderate")) {
      add({
        key: "question_new",
        title: "New product question",
        when: "A buyer asks a question on a product page. It appears on the page once you answer it.",
        to: me.email,
        on: active("question_new"),
        note: active("question_new") ? undefined : templateOff,
        manage: { label: "Questions", href: "/admin/questions" },
      });
    }
    if (has("software.publish")) {
      add({
        key: "software_review",
        title: "Listing submitted for review",
        when: "A colleague without publishing rights submits a product for review (not for your own submissions).",
        to: me.email,
        on: active("software_review"),
        note: active("software_review") ? undefined : templateOff,
        manage: { label: "Products in review", href: "/admin/software?status=IN_REVIEW" },
      });
    }
    add({
      key: "welcome_team",
      title: "Welcome to the team",
      when: "Once, right after you accept your invitation — your role and a link to the admin panel.",
      to: me.email,
      on: active("welcome_team"),
      note: active("welcome_team") ? "Sent only once, so you won't get it again." : templateOff,
    });
  }

  // Everyone
  add({
    key: "password_reset",
    title: "Password reset link",
    when: "You click “Forgot your password?” on the sign-in page. Always sent; it can't be switched off.",
    to: me.email,
    on: true,
  });

  const mode = delivery.mode === "db" ? "smtp" : delivery.mode === "off" ? "off" : env.EMAIL_DRIVER === "console" ? "console" : "smtp";
  const message =
    mode === "off"
      ? "Sending email is switched off for the whole site right now, so none of these are delivered."
      : mode === "console"
        ? "No email server is set up yet, so these emails are only written to the server log, not delivered."
        : "Emails are being delivered.";
  return { delivery: { mode, message }, items: items.map((i) => (emailSettings && i.state === "off" && !i.manage ? { ...i, manage: emailSettings } : i)) };
}
