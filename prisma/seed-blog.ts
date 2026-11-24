/**
 * Demo blog content: full-length articles with designed covers, so the blog, homepage
 * "Latest software insights" and article pages look real. Used by seedBlogContent() in seed.ts.
 * Products are linked by slug; any that don't exist are skipped.
 */

export interface DemoPost {
  slug: string;
  title: string;
  type: "GUIDE" | "ARTICLE" | "NEWS" | "RESOURCE";
  /** Blog category slug (see BLOG_CATEGORIES). */
  category: string;
  excerpt: string;
  tags: string[];
  products: string[];
  /** Days before today it was published. */
  daysAgo: number;
  featured?: boolean;
  content: string;
}

export const BLOG_CATEGORIES = [
  { slug: "buying-guides", name: "Buying guides", description: "Step-by-step help to shortlist, compare and buy the right software for your business." },
  { slug: "accounting", name: "Accounting", description: "GST, invoicing, bookkeeping and finance software — explained for Indian businesses." },
  { slug: "hr", name: "HR", description: "Payroll, attendance, hiring and HR compliance for growing teams." },
  { slug: "marketing", name: "Marketing", description: "WhatsApp, email and CRM tools that help small businesses sell more." },
  { slug: "cad-design", name: "CAD & design", description: "Drafting, 3D modelling and BIM software for architects, engineers and manufacturers." },
  { slug: "news", name: "Cadgram news", description: "Product updates and announcements from the Cadgram team." },
] as const;

export const DEMO_POSTS: DemoPost[] = [
  {
    slug: "choose-accounting-software",
    title: "How to choose accounting software for a growing business",
    type: "GUIDE",
    category: "buying-guides",
    excerpt: "A practical, five-step way to shortlist accounting software — starting with GST compliance, then cloud vs desktop, integrations and the total cost over three years.",
    tags: ["Accounting", "GST", "SME"],
    products: ["ledgerline-books", "kanakku-prime"],
    daysAgo: 9,
    featured: true,
    content: `<p>Accounting software is the system your business will live in every day. The right choice depends less on long feature lists and more on how your team actually works — who enters data, who files returns and how often your CA needs access.</p>
<h2>1. Start with compliance</h2>
<p>For most Indian businesses, GST decides everything else. Before you look at dashboards, check that the software handles the returns you file and the way you file them.</p>
<ul><li><strong>GSTR-1 and GSTR-3B</strong> generated from your invoices, without exporting to Excel first.</li><li><strong>Reconciliation with GSTR-2B</strong>, so you claim only the input tax credit your suppliers have reported.</li><li><strong>E-invoicing and e-way bills</strong> straight from the invoice screen, if your turnover requires them.</li><li><strong>TDS and TCS</strong> on the payments where they apply.</li></ul>
<p>Ask the vendor to demonstrate a full month-end close on sample data — not just creating an invoice.</p>
<h2>2. Cloud or desktop?</h2>
<p>Cloud accounting lets your CA, branch staff and you work on the same books from anywhere, with automatic backups and updates. Desktop software still suits businesses with unreliable internet or very high transaction volumes on a single site. Many teams now use a hybrid: desktop for data entry, with a cloud connector for remote access and reports.</p>
<h2>3. Check what it connects to</h2>
<p>Re-typing data is where most errors creep in. List the systems that should feed your books and confirm each connection works today, not "on the roadmap":</p>
<ul><li>Your bank, for automatic statement import and reconciliation</li><li>Billing or POS software at the counter</li><li>Payroll, so salaries post as journal entries</li><li>E-commerce marketplaces, if you sell online</li></ul>
<h2>4. Work out the real cost</h2>
<p>The starting price on a website is rarely what you pay. Add up licences for every user, any add-on modules (inventory, payroll, multi-GSTIN), implementation and training, and annual renewals. Compare the <strong>three-year total</strong> rather than the first-year price.</p>
<h2>5. Shortlist, then test on your own data</h2>
<p>Pick two or three products, ask for a demo using a month of your real transactions, and speak to a current customer of a similar size. Check how easily you can export your data — you want the option to switch later without starting from scratch.</p>
<p>Not sure where to start? Use the comparison tool to see shortlisted products side by side, or ask our advisors for a free recommendation.</p>`,
  },
  {
    slug: "payroll-compliance-checklist",
    title: "Payroll compliance checklist for Indian employers",
    type: "GUIDE",
    category: "hr",
    excerpt: "The monthly, quarterly and yearly payroll filings every Indian employer needs to track — PF, ESI, professional tax and TDS — and how payroll software keeps you on schedule.",
    tags: ["Payroll", "HR", "Compliance"],
    products: ["peoplefirst-hrms", "paystack-india"],
    daysAgo: 14,
    content: `<p>Every payroll run touches several statutory obligations. Missing one can mean interest, penalties and unhappy employees. Use this checklist to see what falls due and when — and check the current rules on the official portals, since rates and limits change.</p>
<h2>Every month</h2>
<ul><li><strong>Provident Fund (EPF):</strong> employer and employee contributions, deposited and filed through the ECR on the EPFO portal, usually by the 15th of the following month.</li><li><strong>ESI:</strong> contributions for eligible employees, due by the 15th of the following month.</li><li><strong>Professional Tax:</strong> deducted and paid as per your state's rules — some states don't levy it at all.</li><li><strong>TDS on salaries:</strong> deducted every month and deposited by the 7th of the following month.</li></ul>
<h2>Every quarter</h2>
<ul><li><strong>Form 24Q:</strong> the quarterly TDS return for salaries.</li><li>Review new joiners and exits so PF and ESI registrations stay accurate.</li></ul>
<h2>Every year</h2>
<ul><li><strong>Form 16:</strong> TDS certificates for every employee.</li><li>Collect investment declarations and proofs to calculate tax correctly.</li><li>Labour Welfare Fund contributions, where your state requires them.</li><li>Bonus and gratuity provisions, where applicable.</li></ul>
<h2>Where payroll software helps</h2>
<p>Good payroll software calculates every deduction automatically, generates the challans and return files, and reminds you before each due date. Look for:</p>
<ul><li>State-wise professional tax rules built in</li><li>Direct integration with attendance and leave, so pay matches days worked</li><li>Employee self-service for payslips, Form 16 and tax declarations</li><li>An audit trail of every change to salary structures</li></ul>
<h2>Before you switch payroll systems</h2>
<p>Move at the start of a financial year or quarter if you can, run one month in parallel with your old process, and reconcile the totals before you go live.</p>`,
  },
  {
    slug: "whatsapp-business-api-guide",
    title: "WhatsApp Business API: what small businesses should know",
    type: "ARTICLE",
    category: "marketing",
    excerpt: "When the free WhatsApp Business app stops being enough, how the Business API works, what it costs and how to get message templates approved.",
    tags: ["WhatsApp", "Marketing", "Customer support"],
    products: ["sandesh-whatsapp-suite"],
    daysAgo: 19,
    content: `<p>The WhatsApp Business app works well when one person answers messages on one phone. Once several team members need to reply, or you want automated order updates and reminders, you need the <strong>WhatsApp Business Platform</strong> (often called the Business API), accessed through an approved provider.</p>
<h2>App vs API: the difference</h2>
<ul><li><strong>Business app:</strong> free, one number on one phone (plus linked devices), manual replies and simple quick replies.</li><li><strong>Business API:</strong> one number shared by your whole team in a shared inbox, chatbots, integrations with your CRM or store, and bulk messages to customers who opted in.</li></ul>
<h2>What it costs</h2>
<p>You usually pay two things: the provider's platform fee for the inbox and automation tools, and Meta's charges for messages. Meta prices business-initiated template messages by category — marketing, utility and authentication — and the rates differ by country. Replies to customers inside the customer-service window are generally free. Pricing has changed several times, so check Meta's current rate card before you budget.</p>
<h2>Getting templates approved</h2>
<p>Any message you send first, outside a customer's 24-hour window, must use a pre-approved template. To get approvals quickly:</p>
<ul><li>Choose the right category — order updates are <em>utility</em>, offers are <em>marketing</em>.</li><li>Keep variables clear, like <code>{{1}}</code> for the customer's name, with sample values.</li><li>Avoid vague or misleading wording and excessive capitals or emojis.</li></ul>
<h2>Protect your quality rating</h2>
<p>Message only customers who opted in, make it easy to unsubscribe, and don't send the same promotion too often. Too many blocks or reports lower your number's quality rating and can limit how many people you can message.</p>
<h2>Choosing a provider</h2>
<p>Compare the shared inbox, chatbot builder, integrations with your existing tools, support in your time zone and how transparently they pass on Meta's charges.</p>`,
  },
  {
    slug: "restaurant-pos-buyers-guide",
    title: "Restaurant POS buyer's guide",
    type: "GUIDE",
    category: "buying-guides",
    excerpt: "What to test before you buy a restaurant POS: billing speed at peak hour, KOTs, table moves, delivery-app orders, inventory and GST-ready bills.",
    tags: ["POS", "Restaurants", "Hospitality"],
    products: ["thalipos"],
    daysAgo: 24,
    content: `<p>A restaurant POS has to be fast at the counter and reliable in the kitchen, on the busiest night of the week. Feature lists all look similar — what matters is how the system behaves under pressure.</p>
<h2>Test it during a busy hour</h2>
<p>Ask for a trial during service, not on a quiet afternoon. Watch how quickly staff can:</p>
<ul><li>Open a table, add items with modifiers and send the order to the kitchen</li><li>Split a bill by items or by guests, and merge or move tables</li><li>Take multiple payment modes on one bill — UPI, card and cash</li></ul>
<h2>Kitchen order tickets (KOTs)</h2>
<p>Orders should route to the right station automatically — bar, tandoor, main kitchen — and changes or cancellations should print clearly so nothing is cooked twice. A kitchen display screen can replace paper tickets in busier kitchens.</p>
<h2>Delivery apps and online orders</h2>
<p>If you sell through food-delivery apps, their orders should land in the same POS screen, update your stock and appear in the same sales reports. Re-entering online orders by hand is slow and error-prone.</p>
<h2>Inventory and recipes</h2>
<p>Recipe-level inventory deducts ingredients as dishes are sold, so you can see wastage and know what to reorder. Check whether it handles units sensibly — buying in kilograms, using in grams.</p>
<h2>Billing and compliance</h2>
<ul><li>GST-compliant bills with your GSTIN and the correct tax rate</li><li>Day-end reports that match your cash drawer</li><li>Export to your accounting software</li></ul>
<h2>Hardware and offline mode</h2>
<p>Confirm which printers, tablets and cash drawers it supports, and what happens when the internet drops. A good POS keeps billing offline and syncs when the connection returns.</p>`,
  },
  {
    slug: "how-to-choose-2d-drafting-software",
    title: "How to choose 2D drafting software in 2026",
    type: "GUIDE",
    category: "cad-design",
    excerpt: "DWG compatibility, licensing and the five things to test in a demo before you buy 2D CAD for your office.",
    tags: ["CAD", "2D drafting", "DWG"],
    products: ["axiomcad", "clouddraft"],
    daysAgo: 6,
    content: `<p>Choosing 2D drafting software comes down to three questions: will it open and save your drawings perfectly, how do you want to pay for it, and how does your team work? Answer those and the shortlist usually writes itself.</p>
<h2>1. File compatibility comes first</h2>
<p>If you exchange DWG files with consultants, clients or contractors, compatibility matters more than any feature. Test with your own drawings, not the vendor's samples:</p>
<ul><li>Do layers, line types, fonts and dimension styles come through unchanged?</li><li>Do external references (xrefs) and blocks with attributes behave correctly?</li><li>Can you save back to the DWG version your partners use?</li></ul>
<h2>2. Subscription or perpetual licence?</h2>
<p>Subscriptions cost less up front and include upgrades and support. Perpetual licences cost more on day one but can work out cheaper over five years if you don't need every new version. Compare the five-year total for the number of seats you need.</p>
<h2>3. Desktop, browser or both?</h2>
<p>Desktop tools are still fastest for heavy drafting. Browser-based tools are excellent for viewing, markups and quick edits on site, without installing anything. Many offices combine the two.</p>
<h2>4. What to test in a demo</h2>
<ul><li>Open one of your most complex drawings and time it.</li><li>Plot a full sheet set to PDF with your title blocks.</li><li>Ask how layer and dimension standards are enforced across the team.</li><li>Try the commands your drafters use most, with their usual shortcuts.</li><li>Check hardware requirements against your existing PCs.</li></ul>
<h2>5. Training and support</h2>
<p>Ask who supports you locally, how quickly, and whether training is included. A slightly cheaper product with poor support can cost more in lost drafting hours.</p>`,
  },
  {
    slug: "gst-e-invoicing-explained",
    title: "GST e-invoicing explained for small and mid-sized businesses",
    type: "ARTICLE",
    category: "accounting",
    excerpt: "What e-invoicing is, who needs it, how the IRN and QR code work, and what to look for in billing software so it happens automatically.",
    tags: ["GST", "E-invoicing", "Accounting"],
    products: ["invoicekart", "ledgerline-books"],
    daysAgo: 3,
    featured: true,
    content: `<p>Under GST e-invoicing, business-to-business invoices are reported to a government Invoice Registration Portal (IRP) as you raise them. The portal validates each invoice and returns a unique <strong>Invoice Reference Number (IRN)</strong> and a signed <strong>QR code</strong>, which go on the invoice you send.</p>
<h2>Who needs to e-invoice?</h2>
<p>E-invoicing applies to businesses whose aggregate annual turnover has crossed the notified threshold in any financial year — the threshold has been lowered in stages over the years. Some sectors are exempt. Check the current threshold and exemptions on the official GST portals before deciding.</p>
<h2>How it works, step by step</h2>
<ol><li>You create the invoice in your billing or accounting software.</li><li>The software sends the invoice data to the IRP in the standard format.</li><li>The IRP validates it and returns the IRN and signed QR code.</li><li>Your software prints them on the invoice and saves the acknowledgement.</li><li>The details flow into your GST returns automatically.</li></ol>
<h2>Timing matters</h2>
<p>Larger businesses must report invoices to the IRP within a limited number of days of the invoice date, or the portal rejects them. Build e-invoicing into your normal billing, rather than batching invoices at month-end.</p>
<h2>What to look for in software</h2>
<ul><li>Direct IRP integration, so you never upload JSON files by hand</li><li>E-way bill generation from the same invoice</li><li>Clear handling of cancellations and credit notes</li><li>Auto-filled GSTR-1 from e-invoice data</li><li>Bulk generation for high-volume billing</li></ul>
<h2>Common mistakes</h2>
<p>Wrong GSTINs, mismatched HSN codes and duplicate invoice numbers cause most rejections. Validate customer GSTINs when you add them, and keep HSN codes on your item master.</p>`,
  },
  {
    slug: "cloud-vs-desktop-accounting",
    title: "Cloud vs desktop accounting: which suits your business?",
    type: "ARTICLE",
    category: "accounting",
    excerpt: "Access, cost, security, speed and working with your CA — a balanced look at cloud and desktop accounting, and when a hybrid makes sense.",
    tags: ["Accounting", "Cloud", "SME"],
    products: ["ledgerline-books", "kanakku-prime"],
    daysAgo: 12,
    content: `<p>Most growing businesses eventually face the same question: stay with desktop accounting software or move the books to the cloud? Neither is better for everyone — it depends on how you work.</p>
<h2>Access and collaboration</h2>
<p><strong>Cloud</strong> software runs in a browser, so owners, branch staff and your CA can work on the same books at the same time from anywhere. <strong>Desktop</strong> software lives on one PC or office server; remote access needs extra tools.</p>
<h2>Cost</h2>
<p>Cloud tools are usually billed per user per month or year, with hosting, backups and updates included. Desktop tools often have a one-time licence plus optional annual renewals for updates — but you pay separately for the server, backups and IT support.</p>
<h2>Speed and offline work</h2>
<p>Desktop software is fast for heavy data entry and works without internet. Cloud tools depend on a stable connection, though most handle normal volumes comfortably.</p>
<h2>Security and backups</h2>
<p>Reputable cloud providers encrypt data and back it up automatically. With desktop software, backups are your responsibility — and a single failed hard disk can cost you years of records.</p>
<h2>When a hybrid makes sense</h2>
<p>If your team is used to a desktop product but you need remote access, look for a cloud connector or hosted version of the same software. You keep familiar screens and gain access from anywhere.</p>
<h2>A quick way to decide</h2>
<ul><li>Several locations or remote staff → <strong>cloud</strong></li><li>Very high volumes on one site, unreliable internet → <strong>desktop</strong></li><li>Happy with desktop, need occasional remote access → <strong>hybrid</strong></li></ul>`,
  },
  {
    slug: "choose-crm-small-sales-team",
    title: "How to choose a CRM for a small sales team",
    type: "GUIDE",
    category: "buying-guides",
    excerpt: "Pipeline, follow-ups, WhatsApp and phone, reports and adoption — the questions that matter when a small team picks its first CRM.",
    tags: ["CRM", "Sales", "SME"],
    products: ["saarthi-crm"],
    daysAgo: 28,
    content: `<p>A CRM only works if your team actually uses it. For a small sales team, that means it must be quicker than the spreadsheet and WhatsApp groups it replaces.</p>
<h2>Start with your sales process</h2>
<p>Write down the stages a deal goes through — enquiry, qualified, demo, proposal, won or lost — and who does what at each step. Any CRM you shortlist should match this without heavy customisation.</p>
<h2>Must-haves for small teams</h2>
<ul><li><strong>Lead capture</strong> from your website, IndiaMART-style marketplaces, ads and walk-ins into one list</li><li><strong>Follow-up reminders</strong> so no lead goes cold</li><li><strong>WhatsApp, email and call logging</strong> against each contact</li><li><strong>A mobile app</strong> for field sales</li><li><strong>Simple reports</strong>: pipeline value, conversion by source, activity by salesperson</li></ul>
<h2>Watch the total cost</h2>
<p>Per-user pricing adds up as you grow, and useful features like automation or integrations are often in higher plans. Price the plan you will need in a year, not just today.</p>
<h2>Adoption beats features</h2>
<p>Run a two-week trial with your actual salespeople. Ask them which tool they would rather use every day. The CRM with fewer features but daily use beats a powerful one nobody updates.</p>
<h2>Plan the move</h2>
<p>Clean your contact list before importing, set up two or three key reports on day one, and make the CRM — not WhatsApp — the place where deal updates live.</p>`,
  },
  {
    slug: "hrms-implementation-checklist",
    title: "HRMS implementation checklist (free template)",
    type: "RESOURCE",
    category: "hr",
    excerpt: "A ready-to-use checklist for rolling out HR software: data to collect, policies to configure, who to involve and how to go live without payroll surprises.",
    tags: ["HRMS", "Checklist", "HR"],
    products: ["peoplefirst-hrms"],
    daysAgo: 33,
    content: `<p>Use this checklist to plan an HRMS rollout from contract to go-live. Copy it into your project tracker and assign an owner to each line.</p>
<h2>Before you start</h2>
<ul><li>Name a project owner in HR and a contact on the vendor side</li><li>Agree the go-live date — ideally the start of a month</li><li>List the modules in scope: core HR, attendance, leave, payroll, appraisal</li></ul>
<h2>Data to collect</h2>
<ul><li>Employee master: personal details, joining dates, departments, reporting managers</li><li>Salary structures and current CTC breakup</li><li>PF, ESI, PAN and bank details</li><li>Opening leave balances</li><li>Year-to-date payroll figures if you go live mid-year</li></ul>
<h2>Policies to configure</h2>
<ul><li>Shifts, weekly offs and holiday calendars per location</li><li>Leave types and accrual rules</li><li>Attendance rules: late marks, half days, overtime</li><li>Approval workflows for leave, expenses and attendance corrections</li></ul>
<h2>Testing</h2>
<ul><li>Run at least one payroll in parallel with your current process</li><li>Reconcile net pay, PF, ESI and TDS employee by employee</li><li>Test employee self-service on a few phones</li></ul>
<h2>Go-live</h2>
<ul><li>Train managers on approvals and employees on the app</li><li>Share a one-page "how to" guide</li><li>Keep a support channel open for the first month</li></ul>`,
  },
  {
    slug: "bim-vs-cad-difference",
    title: "BIM vs CAD: what's the difference and when do you need each?",
    type: "ARTICLE",
    category: "cad-design",
    excerpt: "CAD draws lines; BIM models buildings with information. A plain-language comparison for architects, contractors and firms deciding what to invest in.",
    tags: ["BIM", "CAD", "Architecture"],
    products: ["planora-bim", "axiomcad"],
    daysAgo: 16,
    content: `<p>CAD and BIM are often mentioned together, but they solve different problems. Understanding the difference helps you invest in the right tools — and avoid paying for capabilities you won't use.</p>
<h2>CAD: drawings</h2>
<p>Computer-aided design (CAD) replaces the drawing board. You draw lines, arcs and text to produce plans, sections and details. A wall on a plan is just two lines — change it, and you update every other drawing by hand.</p>
<h2>BIM: a model with information</h2>
<p>Building Information Modelling (BIM) builds a 3D model from intelligent objects — walls, doors, slabs, ducts — that carry data such as materials, sizes and costs. Plans, sections and schedules are generated from the model, so a change in one place updates everywhere.</p>
<h2>When CAD is enough</h2>
<ul><li>Small projects and interior layouts</li><li>Detailing, shop drawings and site markups</li><li>Teams whose clients and consultants exchange DWG files</li></ul>
<h2>When BIM pays off</h2>
<ul><li>Larger buildings with many consultants</li><li>Clash detection between structure and services</li><li>Accurate quantities and cost estimates from the model</li><li>Clients who require BIM deliverables</li></ul>
<h2>Making the move</h2>
<p>BIM takes training and new standards. Start with one pilot project, keep CAD for detailing, and build templates as you go. Most firms run both for years.</p>`,
  },
  {
    slug: "cadgram-compare-three-products",
    title: "New: compare up to three products side by side",
    type: "NEWS",
    category: "news",
    excerpt: "The redesigned compare page lets you pick three products, search the whole catalogue and see pricing, trials, deployment and features in one table.",
    tags: ["Product update", "Compare"],
    products: [],
    daysAgo: 1,
    content: `<p>We've redesigned the compare page to make side-by-side research faster.</p>
<h2>What's new</h2>
<ul><li><strong>Three comparison slots</strong> — add, change or remove a product in one click.</li><li><strong>Search the whole catalogue</strong> by product, brand or category, with the most popular products first.</li><li><strong>One clear table</strong> with ratings, starting prices, pricing models, free trials, deployment, plans and top features.</li><li><strong>Ready-made comparisons</strong> for popular categories, so you can start in a click.</li></ul>
<h2>Share your shortlist</h2>
<p>The page link updates as you choose products, so you can send the exact comparison to a colleague or bookmark it for later.</p>
<h2>Need a second opinion?</h2>
<p>Use “Get free quote” on any product in the comparison. Our advisors will help you shortlist and get the best price from authorised partners.</p>`,
  },
];

/** Cover colours per blog category: [from, to]. */
export const COVER_COLOURS: Record<string, [string, string]> = {
  "buying-guides": ["#115E59", "#2BB5A3"],
  accounting: ["#0F766E", "#22B39A"],
  hr: ["#B4235A", "#EC6A8E"],
  marketing: ["#C2410C", "#FB923C"],
  "cad-design": ["#065F46", "#10B981"],
  news: ["#062D2A", "#0F766E"],
};
