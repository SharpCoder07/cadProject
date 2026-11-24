/**
 * Editable email templates. Defaults live here; admins override subject, body and on/off
 * in Settings → Email settings (stored in the "email.templates" integration row).
 * Pure module: safe for unit tests.
 */

export const TEMPLATE_KEYS = ["lead_new", "lead_vendor", "lead_confirmation", "lead_assigned", "approval_request", "approval_decision", "subscription_active", "offer_launched", "user_invite", "password_reset", "verify_email", "review_new", "software_review", "question_new", "question_answered", "listing_received", "welcome_buyer", "welcome_vendor", "welcome_team", "lead_reseller", "reseller_received", "welcome_reseller", "privacy_verify", "privacy_received", "privacy_update"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface TemplateDef {
  name: string;
  /** Who receives it, shown in the admin. */
  recipients: string;
  subject: string;
  html: string;
  tokens: string[];
  /** Sign-in emails can't be switched off, or people would be locked out. */
  required?: boolean;
  /** Sample values for the preview and test send. */
  sample: Record<string, string>;
}

const p = (s: string) => `<p>${s}</p>`;

const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#0F766E;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:8px">${label}</a></p>`;
const steps = (items: string[]) => `<ol style="padding-left:20px;margin:12px 0">${items.map((i) => `<li style="margin:6px 0">${i}</li>`).join("")}</ol>`;

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  lead_new: {
    name: "New lead notification",
    recipients: "Sales notification addresses",
    subject: "New lead: {{lead_name}}{{product_suffix}}",
    html: [p("New enquiry <strong>{{reference}}</strong> on {{site_name}}."), "{{lead_details}}", p('<a href="{{admin_url}}">Open the lead in admin</a>')].join("\n"),
    tokens: ["site_name", "reference", "lead_name", "lead_email", "lead_phone", "lead_company", "products", "product_suffix", "requirement", "lead_details", "admin_url"],
    sample: { reference: "CG-2610-4821", lead_name: "Suresh Patel", lead_email: "suresh@example.com", lead_phone: "+919876543210", lead_company: "Patel Hardware", products: "Ledgerline Books", product_suffix: " — Ledgerline Books", requirement: "GST billing for 3 branches" },
  },
  lead_vendor: {
    name: "New enquiry for a vendor",
    recipients: "The vendor of the enquired product (company email)",
    subject: "New enquiry for {{products}}",
    html: [p("Hi {{vendor_name}},"), p("A buyer has enquired about <strong>{{products}}</strong> on {{site_name}} (reference <strong>{{reference}}</strong>)."), "{{lead_details}}", "{{unlock_block}}", p('<a href="{{portal_url}}">Open the enquiry in your vendor portal</a>')].join("\n"),
    tokens: ["site_name", "vendor_name", "reference", "lead_name", "lead_company", "products", "requirement", "lead_details", "unlock_block", "portal_url"],
    sample: { vendor_name: "Ledgerline", reference: "CG-2610-4821", lead_name: "Suresh Patel", lead_company: "Patel Hardware", products: "Ledgerline Books", requirement: "GST billing for 3 branches" },
  },
  lead_confirmation: {
    name: "Confirmation to the lead",
    recipients: "The person who sent the enquiry",
    subject: "Thanks for reaching out to {{site_name}}",
    html: [p("Hi {{lead_name}},"), p("Thanks for your enquiry about <strong>{{products}}</strong>. A software advisor will get in touch within one business day."), p("Your reference number is <strong>{{reference}}</strong>."), p("— Team {{site_name}}")].join("\n"),
    tokens: ["site_name", "lead_name", "products", "reference"],
    sample: { lead_name: "Suresh", products: "Ledgerline Books", reference: "CG-2610-4821" },
  },
  lead_assigned: {
    name: "Lead assigned to staff member",
    recipients: "The staff member the lead is assigned to",
    subject: "Lead assigned to you: {{lead_name}}",
    html: [p("Hi {{staff_name}},"), p("Lead <strong>{{reference}}</strong> ({{products}}) has been assigned to you."), "{{lead_details}}", p('<a href="{{admin_url}}">Open the lead</a>')].join("\n"),
    tokens: ["site_name", "staff_name", "reference", "lead_name", "products", "lead_details", "admin_url"],
    sample: { staff_name: "Sana", reference: "CG-2610-4821", lead_name: "Suresh Patel", products: "Ledgerline Books" },
  },
  approval_request: {
    name: "Vendor approval request",
    recipients: "Super Admins (everyone who can approve)",
    subject: "Approval needed: {{action}} {{item_type}} “{{item}}”",
    html: [p("{{requester_name}} from <strong>{{vendor_name}}</strong> asked to {{action}} {{item_type}} “{{item}}”."), "{{note_block}}", p('<a href="{{review_url}}">Review the request</a>')].join("\n"),
    tokens: ["site_name", "vendor_name", "requester_name", "action", "item_type", "item", "note_block", "review_url"],
    sample: { vendor_name: "Ledgerline Technologies", requester_name: "Ledgerline Editor", action: "edit", item_type: "product", item: "Ledgerline Books" },
  },
  approval_decision: {
    name: "Approval decision to vendor",
    recipients: "The vendor user who made the request",
    subject: "Your request was {{decision}}: {{item}}",
    html: [p("Hi {{user_name}},"), p("Your request to {{action}} {{item_type}} “{{item}}” was <strong>{{decision}}</strong>."), "{{reason_block}}", p('<a href="{{requests_url}}">See all your requests</a>')].join("\n"),
    tokens: ["site_name", "user_name", "decision", "action", "item_type", "item", "reason_block", "requests_url"],
    sample: { user_name: "Ledgerline Editor", decision: "approved", action: "edit", item_type: "product", item: "Ledgerline Books" },
  },
  subscription_active: {
    name: "Subscription confirmation",
    recipients: "The vendor user who bought the plan (or the vendor's company email)",
    subject: "Your {{plan_name}} plan is active",
    html: [p("Hi {{user_name}},"), p("Thank you. The <strong>{{plan_name}}</strong> plan for {{vendor_name}} is active from {{period_start}} to {{period_end}}."), p("Amount: <strong>{{amount}}</strong><br>Payment ID: {{payment_id}}"), p("You can now see the email address and phone number of every buyer who enquires about your products."), p('<a href="{{portal_url}}">View your plan</a>')].join("\n"),
    tokens: ["site_name", "user_name", "vendor_name", "plan_name", "amount", "period_start", "period_end", "payment_id", "portal_url"],
    sample: { user_name: "Ledgerline Partner", vendor_name: "Ledgerline", plan_name: "Growth", amount: "₹9,999", period_start: "30 Oct 2026", period_end: "30 Oct 2027", payment_id: "pay_PbX1h2Y3z4" },
  },
  offer_launched: {
    name: "Offer on a favourited product",
    recipients: "Buyers who added the product to their favourites",
    subject: "{{discount}} on {{product_name}}: {{offer_title}}",
    html: [p("Hi {{user_name}},"), p("A new offer just went live on <strong>{{product_name}}</strong>, one of your favourites on {{site_name}}."), "{{offer_details}}", p('<a href="{{offer_url}}">See the offer</a>'), p('<small>You get this because you favourited {{product_name}}. <a href="{{favourites_url}}">Manage favourites and offer emails</a>.</small>')].join("\n"),
    tokens: ["site_name", "user_name", "product_name", "offer_title", "discount", "coupon_code", "valid_until", "offer_details", "offer_url", "favourites_url"],
    sample: { user_name: "Ledgerline Partner", product_name: "Ledgerline Books", offer_title: "Diwali sale", discount: "20% off", coupon_code: "DIWALI20", valid_until: "15 Nov 2026" },
  },
  user_invite: {
    name: "Invitation",
    recipients: "New staff or vendor users",
    subject: "You're invited to {{site_name}}",
    html: [p("Hi {{user_name}},"), p("You've been invited to {{site_name}}. Set your password using the link below (valid for 7 days):"), p('<a href="{{invite_link}}">Set my password</a>'), p("If you weren't expecting this, you can ignore this email.")].join("\n"),
    tokens: ["site_name", "user_name", "invite_link"],
    required: true,
    sample: { user_name: "Riya" },
  },
  password_reset: {
    name: "Password reset",
    recipients: "Anyone who asks to reset their password",
    subject: "Reset your {{site_name}} password",
    html: [p("Hi {{user_name}},"), p("Reset your password using this link (valid for 1 hour):"), p('<a href="{{reset_link}}">Reset my password</a>'), p("If you didn't ask for this, you can ignore this email.")].join("\n"),
    tokens: ["site_name", "user_name", "reset_link"],
    required: true,
    sample: { user_name: "Riya" },
  },
  software_review: {
    name: "Listing submitted for review",
    recipients: "Staff who can publish listings (Super Admin, Admin, Product Manager)",
    subject: "Approval needed: “{{item}}” was submitted for review",
    html: [p("{{requester_name}} submitted <strong>{{item_list}}</strong> for review. It stays unpublished until someone with publishing rights publishes it."), p('<a href="{{review_url}}">Review and publish</a>')].join("\n"),
    tokens: ["site_name", "requester_name", "item", "item_list", "review_url"],
    sample: { requester_name: "Asha (Content Editor)", item: "DraftLine 2D", item_list: "DraftLine 2D" },
  },
  review_new: {
    name: "New review to moderate",
    recipients: "Staff who can approve reviews (Super Admin, Admin, Product Manager)",
    subject: "New {{rating}}★ review of {{product_name}}{{status_suffix}}",
    html: [p("<strong>{{reviewer_name}}</strong> reviewed <strong>{{product_name}}</strong> ({{rating}}★):"), p("<em>“{{review_title}}”</em>"), "{{review_excerpt}}", p("{{status_line}}"), p('<a href="{{moderate_url}}">Open reviews to approve or reject</a>')].join("\n"),
    tokens: ["site_name", "reviewer_name", "product_name", "rating", "review_title", "review_excerpt", "status_line", "status_suffix", "moderate_url"],
    sample: { reviewer_name: "Riya Sharma", product_name: "DraftLine 2D", rating: "4", review_title: "Fast and easy for daily drafting", status_line: "It's waiting for your approval.", status_suffix: " — approval needed" },
  },
  question_new: {
    name: "New product question",
    recipients: "Staff who can moderate reviews and questions (Super Admin, Admin, Product Manager)",
    subject: "New question about {{product_name}}",
    html: [p("<strong>{{asker_name}}</strong> asked a question about <strong>{{product_name}}</strong>:"), p("<em>“{{question}}”</em>"), p("Answer it and it will appear on the product page."), p('<a href="{{moderate_url}}">Open questions to answer</a>')].join("\n"),
    tokens: ["site_name", "asker_name", "product_name", "question", "moderate_url"],
    sample: { asker_name: "Riya Sharma", product_name: "DraftLine 2D", question: "Does it open DWG files from AutoCAD 2018?" },
  },
  question_answered: {
    name: "Your question was answered",
    recipients: "The buyer who asked the question",
    subject: "Your question about {{product_name}} has an answer",
    html: [p("Hi {{user_name}},"), p("You asked about <strong>{{product_name}}</strong>:"), p("<em>“{{question}}”</em>"), p("<strong>Answer:</strong>"), "{{answer_html}}", p('<a href="{{product_url}}">See it on the product page</a>')].join("\n"),
    tokens: ["site_name", "user_name", "product_name", "question", "answer_html", "product_url"],
    sample: { user_name: "Riya", product_name: "DraftLine 2D", question: "Does it open DWG files from AutoCAD 2018?", answer_html: "<p>Yes — DWG 2000 to 2018 files open and save without conversion.</p>" },
  },
  listing_received: {
    name: "Listing request received",
    recipients: "Software companies who send the “List your software” form",
    subject: "We've received your request to list on {{site_name}}",
    html: [
      p("Hi {{lead_name}},"),
      p("Thanks for your interest in listing {{lead_company}} on {{site_name}}. Our partnerships team will review your details and get back to you within two business days."),
      p("Your reference number is <strong>{{reference}}</strong>."),
      p("<strong>What happens next</strong>"),
      steps(["We review your product and website.", "We set up your company and send you an invitation to the vendor portal.", "You complete your profile and listings, and start receiving enquiries from buyers."]),
      p("— Team {{site_name}}"),
    ].join("\n"),
    tokens: ["site_name", "lead_name", "lead_company", "reference"],
    sample: { lead_name: "Ankit", lead_company: "Ledgerline Technologies", reference: "CG-2611-3307" },
  },
  lead_reseller: {
    name: "New enquiry for a reseller",
    recipients: "Every reseller of the enquired product (company email, or their users who can see leads)",
    subject: "New enquiry for {{products}}",
    html: [p("Hi {{vendor_name}},"), p("A buyer has enquired about <strong>{{products}}</strong> on {{site_name}}, a product you resell (reference <strong>{{reference}}</strong>)."), "{{lead_details}}", "{{unlock_block}}", button("{{portal_url}}", "View the lead")].join("\n"),
    tokens: ["site_name", "vendor_name", "reference", "lead_name", "lead_company", "products", "requirement", "lead_details", "unlock_block", "portal_url"],
    sample: { vendor_name: "Shree Tech Solutions", reference: "CG-2611-4821", lead_name: "Suresh Patel", lead_company: "Patel Hardware", products: "Ledgerline Books", requirement: "GST billing for 3 branches" },
  },
  reseller_received: {
    name: "Reseller application received",
    recipients: "Companies who send the “Become a reseller” form",
    subject: "We've received your reseller application",
    html: [
      p("Hi {{lead_name}},"),
      p("Thanks for applying to become a reseller partner on {{site_name}}. Our partnerships team will review your application and get back to you within two business days."),
      p("Your reference number is <strong>{{reference}}</strong>."),
      p("<strong>What happens next</strong>"),
      steps(["We review your company and the products you sell.", "We set up your reseller account and invite you to the reseller portal.", "You choose the products you're authorised to sell, and we start forwarding you enquiries from buyers in your area."]),
      p("— Team {{site_name}}"),
    ].join("\n"),
    tokens: ["site_name", "lead_name", "lead_company", "reference"],
    sample: { lead_name: "Rahul", lead_company: "Shree Tech Solutions", reference: "CG-2611-5120" },
  },
  welcome_buyer: {
    name: "Welcome (buyer)",
    recipients: "Buyers, right after they confirm their email",
    subject: "Welcome to {{site_name}}, {{user_name}}",
    html: [
      p("Hi {{user_name}},"),
      p("Your account is ready. {{site_name}} helps you find, compare and buy the right software for your business."),
      steps([
        "<strong>Compare products</strong> side by side on features, pricing and reviews.",
        "<strong>Save favourites</strong> and get an email when they have a new offer.",
        "<strong>Get free expert advice</strong> — tell us what you need and a software advisor will call you.",
        "<strong>Write reviews</strong> of software you use to help other businesses.",
      ]),
      button("{{browse_url}}", "Explore software"),
      p('Manage your favourites, reviews and email preferences any time in <a href="{{account_url}}">My account</a>.'),
      p("— Team {{site_name}}"),
    ].join("\n"),
    tokens: ["site_name", "user_name", "browse_url", "account_url"],
    sample: { user_name: "Riya" },
  },
  welcome_vendor: {
    name: "Welcome (vendor user)",
    recipients: "Vendor users, right after they accept their invitation",
    subject: "Welcome to the {{site_name}} vendor portal",
    html: [
      p("Hi {{user_name}},"),
      p("You're now set up to manage <strong>{{vendor_name}}</strong> on {{site_name}}. Here's how to get the most out of it:"),
      steps([
        '<strong>Complete your company profile</strong> — logo, description and contact details. <a href="{{profile_url}}">Edit profile</a>',
        '<strong>Add or update your products</strong> with screenshots, pricing and features. <a href="{{listings_url}}">My listings</a>',
        "<strong>Reply to reviews</strong> to show buyers you're listening.",
        '<strong>See your enquiries</strong> as buyers contact you. <a href="{{leads_url}}">Leads</a>',
      ]),
      p("Changes you make are checked by our team before they go live; you'll get an email when they're approved."),
      button("{{portal_url}}", "Open the vendor portal"),
      p("— Team {{site_name}}"),
    ].join("\n"),
    tokens: ["site_name", "user_name", "vendor_name", "portal_url", "profile_url", "listings_url", "leads_url"],
    sample: { user_name: "Ankit", vendor_name: "Ledgerline Technologies" },
  },
  welcome_reseller: {
    name: "Welcome (reseller user)",
    recipients: "Reseller users, right after they accept their invitation",
    subject: "Welcome to the {{site_name}} reseller portal",
    html: [
      p("Hi {{user_name}},"),
      p("You're now set up to manage <strong>{{vendor_name}}</strong> as a reseller partner on {{site_name}}. Here's how to get started:"),
      steps([
        '<strong>Complete your company profile</strong> — logo, contact details and the cities you serve. <a href="{{profile_url}}">Edit profile</a>',
        '<strong>Choose the products you resell</strong>. Once approved, you\'re listed as an authorised reseller on each product page. <a href="{{authorised_url}}">Authorised products</a>',
        '<strong>Follow up on leads</strong> our team forwards to you — you get an email for each one. <a href="{{leads_url}}">Leads</a>',
      ]),
      button("{{portal_url}}", "Open the reseller portal"),
      p("— Team {{site_name}}"),
    ].join("\n"),
    tokens: ["site_name", "user_name", "vendor_name", "portal_url", "profile_url", "authorised_url", "leads_url"],
    sample: { user_name: "Rahul", vendor_name: "Shree Tech Solutions" },
  },
  welcome_team: {
    name: "Welcome (team member)",
    recipients: "Staff, right after they accept their invitation",
    subject: "Welcome to the {{site_name}} team",
    html: [
      p("Hi {{user_name}},"),
      p("Your admin account is ready. You've joined as <strong>{{role_name}}</strong>, so you'll see the sections of the admin panel that this role allows."),
      button("{{admin_url}}", "Open the admin panel"),
      p('Tip: turn on two-step sign-in in <a href="{{account_url}}">My account</a> to keep your account secure.'),
      p("— Team {{site_name}}"),
    ].join("\n"),
    tokens: ["site_name", "user_name", "role_name", "admin_url", "account_url"],
    sample: { user_name: "Sana", role_name: "Sales Manager" },
  },
  verify_email: {
    name: "Confirm your email (buyer sign-up)",
    recipients: "People who create a buyer account on the website",
    subject: "Confirm your email for {{site_name}}",
    html: [p("Hi {{user_name}},"), p("Thanks for signing up. Confirm your email address to start saving favourite products, getting offer alerts and writing reviews:"), p('<a href="{{verify_link}}">Confirm my email</a>'), p("This link is valid for 24 hours. If you didn't sign up, you can ignore this email.")].join("\n"),
    tokens: ["site_name", "user_name", "verify_link"],
    required: true,
    sample: { user_name: "Riya" },
  },
  privacy_verify: {
    name: "Confirm a privacy request or complaint",
    recipients: "People who send a data request or complaint without signing in",
    subject: "Confirm your request to {{site_name}} ({{reference}})",
    html: [p("Hi {{requester_name}},"), p("We received your {{case_kind}} <strong>{{reference}}</strong>: {{case_type}}."), p("To make sure it really came from you, please confirm your email address:"), button("{{verify_link}}", "Confirm my request"), p("This link is valid for 72 hours. If you didn't send this, you can ignore this email and nothing will happen.")].join("\n"),
    tokens: ["site_name", "requester_name", "reference", "case_kind", "case_type", "verify_link"],
    required: true,
    sample: { requester_name: "Riya", reference: "PR-7QK2M9XA", case_kind: "data request", case_type: "Get a copy of my data" },
  },
  privacy_received: {
    name: "Privacy request or complaint received",
    recipients: "The person who sent the data request or complaint",
    subject: "We've received your {{case_kind}} ({{reference}})",
    html: [p("Hi {{requester_name}},"), p("Thank you. Your {{case_kind}} <strong>{{reference}}</strong> ({{case_type}}) is with our team."), "{{due_block}}", p("We'll email you when there's an update. Please quote the reference if you write to us about it."), "{{contact_block}}"].join("\n"),
    tokens: ["site_name", "requester_name", "reference", "case_kind", "case_type", "due_block", "contact_block"],
    sample: { requester_name: "Riya", reference: "PR-7QK2M9XA", case_kind: "data request", case_type: "Get a copy of my data" },
  },
  privacy_update: {
    name: "Update on a privacy request or complaint",
    recipients: "The person who sent the data request or complaint",
    subject: "Update on your {{case_kind}} ({{reference}}): {{status}}",
    html: [p("Hi {{requester_name}},"), p("There's an update on your {{case_kind}} <strong>{{reference}}</strong> ({{case_type}}). Status: <strong>{{status}}</strong>."), "{{message_block}}", "{{contact_block}}"].join("\n"),
    tokens: ["site_name", "requester_name", "reference", "case_kind", "case_type", "status", "message_block", "contact_block"],
    sample: { requester_name: "Riya", reference: "PR-7QK2M9XA", case_kind: "data request", case_type: "Get a copy of my data", status: "Resolved" },
  },
};

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Tokens whose values are HTML built by the server (never user input), inserted without escaping. */
const RAW_TOKENS = new Set(["due_block", "contact_block", "message_block", "lead_details", "note_block", "reason_block", "unlock_block", "offer_details", "review_excerpt", "answer_html"]);

/** Replaces {{token}}s. Values are escaped in HTML; unknown tokens are removed. */
export function fillTokens(template: string, vars: Record<string, string>, mode: "html" | "text") {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name] ?? "";
    return mode === "html" && !RAW_TOKENS.has(name) ? escapeHtml(v) : v;
  });
}

export const htmlToText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2: $1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Two-column table of label/value rows (values escaped). */
export function detailsTable(rows: [string, string | null | undefined][]) {
  const body = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(String(v))}</td></tr>`)
    .join("");
  return `<table style="border-collapse:collapse;font-size:14px;margin:8px 0">${body}</table>`;
}

/** Simple branded wrapper so every email looks consistent. */
export function wrapEmail(inner: string, siteName: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f7;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;font-size:14px;line-height:1.6">
<div style="font-weight:700;font-size:16px;margin-bottom:16px">${escapeHtml(siteName)}</div>
${inner}
</div>
<p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#9ca3af;text-align:center">Sent by ${escapeHtml(siteName)}</p>
</body></html>`;
}
