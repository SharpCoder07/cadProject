/**
 * Sample catalogue for local development and demos. Every company and product
 * here is fictional; descriptions are original. Replace freely.
 */

export interface SeedCategory {
  name: string;
  slug: string;
  icon: string;
  description: string;
  children?: { name: string; slug: string; description: string }[];
}

export const CATEGORIES: SeedCategory[] = [
  { name: "Accounting & GST", slug: "accounting-software", icon: "calculator", description: "Bookkeeping, invoicing, GST returns and e-invoicing for Indian businesses.", children: [
    { name: "GST Billing", slug: "gst-billing-software", description: "Create GST-compliant invoices, e-way bills and e-invoices." },
    { name: "Invoicing", slug: "invoicing-software", description: "Quotes, invoices and payment reminders." },
    { name: "Expense Management", slug: "expense-management-software", description: "Employee expenses, approvals and reimbursements." },
  ] },
  { name: "HR & Payroll", slug: "hr-software", icon: "users", description: "Hire, onboard, pay and retain your people — with PF, ESI and TDS handled.", children: [
    { name: "Payroll", slug: "payroll-software", description: "Salary processing with statutory compliance." },
    { name: "Attendance & Leave", slug: "attendance-management-software", description: "Biometric, mobile and geo-fenced attendance." },
    { name: "Recruitment", slug: "recruitment-software", description: "Job posting, applicant tracking and interviews." },
  ] },
  { name: "CRM", slug: "crm-software", icon: "chat", description: "Track leads, deals and customer conversations in one place.", children: [
    { name: "Sales CRM", slug: "sales-crm", description: "Pipelines, follow-ups and sales forecasting." },
    { name: "Customer Support", slug: "help-desk-software", description: "Tickets, SLAs and omnichannel support." },
  ] },
  { name: "ERP", slug: "erp-software", icon: "factory", description: "Run finance, inventory, production and sales on one system.", children: [
    { name: "Manufacturing ERP", slug: "manufacturing-erp", description: "BOM, production planning and shop-floor control." },
    { name: "Distribution ERP", slug: "distribution-erp", description: "Multi-warehouse distribution and dealer management." },
  ] },
  { name: "Inventory & Warehouse", slug: "inventory-management-software", icon: "warehouse", description: "Stock levels, batches, barcodes and multi-location warehouses." },
  { name: "Retail & POS", slug: "pos-software", icon: "store", description: "Billing counters, loyalty and store operations for retail and restaurants.", children: [
    { name: "Restaurant POS", slug: "restaurant-pos", description: "KOT, table management and online order integration." },
    { name: "Retail POS", slug: "retail-pos", description: "Barcode billing, offers and multi-store retail." },
  ] },
  { name: "Project Management", slug: "project-management-software", icon: "clipboard", description: "Plan work, track tasks and keep teams aligned." },
  { name: "Marketing", slug: "marketing-software", icon: "megaphone", description: "Email, WhatsApp, SMS and social campaigns that convert.", children: [
    { name: "Email Marketing", slug: "email-marketing-software", description: "Newsletters, automation and deliverability." },
    { name: "WhatsApp Marketing", slug: "whatsapp-marketing-software", description: "Broadcasts and chatbots on the WhatsApp Business API." },
  ] },
  { name: "Healthcare", slug: "healthcare-software", icon: "health", description: "Clinic, hospital and pharmacy management software." },
  { name: "Education", slug: "school-management-software", icon: "education", description: "School ERP, fees, timetables and online classes." },
  { name: "Collaboration", slug: "collaboration-software", icon: "users", description: "Chat, video meetings and shared documents." },
  { name: "Security", slug: "cyber-security-software", icon: "security", description: "Endpoint protection, backups and identity management." },
];

export const INDUSTRIES = [
  { name: "Retail", slug: "retail", icon: "store", description: "Shops, chains and D2C brands." },
  { name: "Manufacturing", slug: "manufacturing", icon: "factory", description: "Discrete and process manufacturers." },
  { name: "Healthcare", slug: "healthcare", icon: "clinic", description: "Clinics, hospitals, labs and pharmacies." },
  { name: "Education", slug: "education", icon: "education", description: "Schools, colleges and coaching institutes." },
  { name: "Restaurants & Hospitality", slug: "hospitality", icon: "restaurant", description: "Restaurants, cloud kitchens and hotels." },
  { name: "Construction & Real Estate", slug: "construction", icon: "construction", description: "Builders, contractors and property managers." },
  { name: "Logistics", slug: "logistics", icon: "truck", description: "Transport, courier and 3PL companies." },
  { name: "Professional Services", slug: "professional-services", icon: "briefcase", description: "CA firms, agencies and consultancies." },
];

export const ATTRIBUTES = [
  { key: "platforms", label: "Supported platforms", type: "MULTISELECT", group: "Technical", isFilterable: true, options: ["Web", "Windows", "macOS", "Android", "iOS", "Linux"] },
  { key: "languages", label: "Languages", type: "MULTISELECT", group: "Technical", isFilterable: true, options: ["English", "Hindi", "Tamil", "Telugu", "Marathi", "Gujarati", "Bengali", "Kannada"] },
  { key: "integrations", label: "Integrations", type: "MULTISELECT", group: "Integrations", isFilterable: true, options: ["Razorpay", "WhatsApp", "Google Workspace", "Microsoft 365", "Shopify", "Tally export", "Zapier", "Slack"] },
  { key: "support", label: "Support", type: "MULTISELECT", group: "Support", isFilterable: true, options: ["Phone", "Email", "Chat", "On-site", "24×7"] },
  { key: "gst_compliant", label: "GST compliant", type: "BOOLEAN", group: "Compliance", isFilterable: false, options: [] },
  { key: "e_invoicing", label: "E-invoicing", type: "BOOLEAN", group: "Compliance", isFilterable: false, options: [] },
  { key: "data_center", label: "Data stored in India", type: "SELECT", group: "Compliance", isFilterable: true, options: ["Yes", "No", "On request"] },
  { key: "max_users", label: "Maximum users", type: "NUMBER", group: "Plans", unit: "users", isFilterable: false, options: [] },
  { key: "api_access", label: "API access", type: "BOOLEAN", group: "Technical", isFilterable: false, options: [] },
  { key: "business_size", label: "Best for", type: "MULTISELECT", group: "Fit", isFilterable: true, options: ["Freelancers", "Small business", "Mid-size", "Enterprise"] },
] as const;

export const VENDORS = [
  { name: "Ledgerline Technologies", slug: "ledgerline", city: "Pune", founded: 2011, size: "201–500", verified: true },
  { name: "Kanakku Software", slug: "kanakku", city: "Chennai", founded: 2014, size: "51–200", verified: true },
  { name: "PeopleFirst HR Labs", slug: "peoplefirst", city: "Bengaluru", founded: 2016, size: "201–500", verified: true },
  { name: "Saarthi Cloud", slug: "saarthi-cloud", city: "Gurugram", founded: 2012, size: "501–1000", verified: true },
  { name: "Udyog Systems", slug: "udyog-systems", city: "Ahmedabad", founded: 2008, size: "201–500", verified: true },
  { name: "Dukaan Byte", slug: "dukaan-byte", city: "Jaipur", founded: 2018, size: "11–50", verified: false },
  { name: "Tarang Digital", slug: "tarang-digital", city: "Mumbai", founded: 2015, size: "51–200", verified: true },
  { name: "Arogya Informatics", slug: "arogya-informatics", city: "Hyderabad", founded: 2010, size: "51–200", verified: true },
  { name: "Vidyaa Tech", slug: "vidyaa-tech", city: "Kochi", founded: 2013, size: "51–200", verified: false },
  { name: "Kavach Secure", slug: "kavach-secure", city: "Noida", founded: 2017, size: "11–50", verified: true },
  { name: "Sangam Workspace", slug: "sangam-workspace", city: "Bengaluru", founded: 2019, size: "51–200", verified: false },
  { name: "Godown Pro", slug: "godown-pro", city: "Surat", founded: 2016, size: "11–50", verified: true },
];

type Plan = { name: string; price: number | null; period?: "MONTHLY" | "YEARLY" | "ONE_TIME"; unit?: string; features: string[]; popular?: boolean };
export interface SeedProduct {
  name: string;
  vendor: string;
  category: string; // primary category slug
  also?: string[];
  tagline: string;
  pricing: "FREE" | "FREEMIUM" | "SUBSCRIPTION" | "ONE_TIME" | "QUOTE_BASED";
  price: number | null;
  unit?: string;
  trial?: boolean;
  deployment: ("CLOUD" | "ON_PREMISE" | "HYBRID" | "MOBILE" | "DESKTOP")[];
  industries: string[];
  flags?: ("featured" | "popular" | "trending" | "recommended" | "sponsored")[];
  features: [string, string][];
  plans?: Plan[];
  color: string;
}

export const PRODUCTS: SeedProduct[] = [
  { name: "Ledgerline Books", vendor: "ledgerline", category: "accounting-software", also: ["gst-billing-software", "invoicing-software"], tagline: "Cloud accounting with one-click GST returns", pricing: "SUBSCRIPTION", price: 749, unit: "per month", trial: true, deployment: ["CLOUD", "MOBILE"], industries: ["retail", "professional-services", "manufacturing"], flags: ["featured", "popular"], color: "#0F766E",
    features: [["GSTR-1 and GSTR-3B filing", "Prepare and file returns from reconciled data."], ["E-invoicing and e-way bills", "Generate IRN and e-way bills from the invoice screen."], ["Bank reconciliation", "Match bank statements automatically with smart rules."], ["Multi-branch books", "Consolidate branches while keeping separate GSTINs."], ["Inventory valuation", "FIFO and weighted average with batch tracking."], ["CA access", "Give your accountant read or edit access for free."]],
    plans: [{ name: "Starter", price: 749, unit: "per month", features: ["1 GSTIN", "2 users", "GST returns"] }, { name: "Growth", price: 1499, unit: "per month", features: ["3 GSTINs", "5 users", "E-invoicing", "Inventory"], popular: true }, { name: "Enterprise", price: null, features: ["Unlimited GSTINs", "Custom roles", "Dedicated manager"] }] },
  { name: "Kanakku Prime", vendor: "kanakku", category: "accounting-software", also: ["gst-billing-software"], tagline: "Desktop accounting that accountants already know", pricing: "ONE_TIME", price: 18000, unit: "single user licence", deployment: ["DESKTOP", "ON_PREMISE"], industries: ["retail", "manufacturing"], flags: ["popular", "recommended"], color: "#0F766E",
    features: [["Keyboard-first entry", "Voucher entry built for speed without a mouse."], ["Statutory reports", "TDS, TCS and GST reports out of the box."], ["Remote access", "Access company data from anywhere over a secure connection."], ["Payroll add-on", "Salary with PF and ESI on the same books."]],
    plans: [{ name: "Silver", price: 18000, period: "ONE_TIME", unit: "single user", features: ["1 PC", "All accounting features"] }, { name: "Gold", price: 54000, period: "ONE_TIME", unit: "multi-user", features: ["Unlimited LAN users", "Remote access"], popular: true }] },
  { name: "BillBhai", vendor: "dukaan-byte", category: "gst-billing-software", also: ["retail-pos"], tagline: "Mobile GST billing for small shops", pricing: "FREEMIUM", price: 0, unit: "", trial: false, deployment: ["MOBILE", "CLOUD"], industries: ["retail"], flags: ["trending"], color: "#C2410C",
    features: [["Bill on your phone", "Create GST invoices and share on WhatsApp in seconds."], ["Khata book", "Track credit given to customers and send reminders."], ["Barcode scanning", "Use the phone camera as a barcode scanner."], ["Stock alerts", "Get notified before items run out."]],
    plans: [{ name: "Free", price: 0, features: ["Unlimited invoices", "1 device"] }, { name: "Gold", price: 2999, period: "YEARLY", unit: "per year", features: ["3 devices", "Reports", "Custom invoice themes"], popular: true }] },
  { name: "InvoiceKart", vendor: "ledgerline", category: "invoicing-software", tagline: "Invoices, quotes and payment links for freelancers", pricing: "FREEMIUM", price: 0, deployment: ["CLOUD"], industries: ["professional-services"], color: "#A16207",
    features: [["Payment links", "Collect UPI and card payments on every invoice."], ["Recurring invoices", "Bill retainers automatically every month."], ["Multi-currency", "Invoice international clients with LUT export details."]],
    plans: [{ name: "Free", price: 0, features: ["5 clients"] }, { name: "Pro", price: 399, unit: "per month", features: ["Unlimited clients", "Reminders", "Branding"], popular: true }] },
  { name: "SpendWise", vendor: "saarthi-cloud", category: "expense-management-software", tagline: "Expense claims and corporate cards without spreadsheets", pricing: "SUBSCRIPTION", price: 199, unit: "per user / month", trial: true, deployment: ["CLOUD", "MOBILE"], industries: ["professional-services", "logistics"], color: "#BE123C",
    features: [["Receipt scanning", "Snap a bill and the amount, GST and vendor are read for you."], ["Approval workflows", "Multi-level approvals by amount, project or department."], ["Policy checks", "Flag claims that break per-diem or category limits."], ["Tally export", "Push approved claims as vouchers."]] },
  { name: "PeopleFirst HRMS", vendor: "peoplefirst", category: "hr-software", also: ["payroll-software", "attendance-management-software"], tagline: "Core HR, payroll and attendance in one app", pricing: "SUBSCRIPTION", price: 79, unit: "per employee / month", trial: true, deployment: ["CLOUD", "MOBILE"], industries: ["manufacturing", "retail", "professional-services"], flags: ["featured", "popular", "sponsored"], color: "#059669",
    features: [["Payroll with compliance", "PF, ESI, PT, LWF and TDS calculated every run."], ["Geo-fenced attendance", "Mobile check-in limited to office or site locations."], ["Leave policies", "Accruals, carry-forward and holiday calendars by location."], ["Employee self-service", "Payslips, tax declarations and requests on mobile."], ["Onboarding", "Offer letters, document collection and asset handover."]],
    plans: [{ name: "Payroll", price: 49, unit: "per employee / month", features: ["Payroll", "Statutory reports"] }, { name: "HR Suite", price: 79, unit: "per employee / month", features: ["Payroll", "Attendance", "Leave", "ESS app"], popular: true }, { name: "Enterprise", price: null, features: ["Performance", "Custom workflows", "SSO"] }] },
  { name: "PayStack India", vendor: "saarthi-cloud", category: "payroll-software", tagline: "Payroll for 10 to 10,000 employees", pricing: "SUBSCRIPTION", price: 2999, unit: "per month", deployment: ["CLOUD"], industries: ["manufacturing", "logistics"], flags: ["recommended"], color: "#0F766E",
    features: [["Bulk salary transfer", "Pay salaries directly through supported banks."], ["Form 16", "Generate and email Form 16 to every employee."], ["Arrears and bonuses", "Handle revisions without manual adjustments."]] },
  { name: "HaziriApp", vendor: "peoplefirst", category: "attendance-management-software", tagline: "Face-recognition attendance for field and factory teams", pricing: "SUBSCRIPTION", price: 39, unit: "per employee / month", trial: true, deployment: ["MOBILE", "CLOUD"], industries: ["construction", "manufacturing", "logistics"], flags: ["trending"], color: "#B45309",
    features: [["Face recognition", "Works offline and syncs when connected."], ["Shift rosters", "Rotating shifts and overtime rules."], ["Biometric device sync", "Import punches from existing devices."]] },
  { name: "HireLoop", vendor: "peoplefirst", category: "recruitment-software", tagline: "Applicant tracking that hiring managers actually use", pricing: "SUBSCRIPTION", price: 4999, unit: "per month", deployment: ["CLOUD"], industries: ["professional-services"], color: "#BE185D",
    features: [["Job board posting", "Post to multiple job portals in one click."], ["Interview scheduling", "Calendar-aware slots for panels."], ["Scorecards", "Structured feedback for fair decisions."]] },
  { name: "Saarthi CRM", vendor: "saarthi-cloud", category: "crm-software", also: ["sales-crm"], tagline: "Sales CRM with WhatsApp and calling built in", pricing: "SUBSCRIPTION", price: 599, unit: "per user / month", trial: true, deployment: ["CLOUD", "MOBILE"], industries: ["professional-services", "construction", "education"], flags: ["featured", "popular"], color: "#047857",
    features: [["WhatsApp inbox", "Chat with leads from the CRM using the official API."], ["Click-to-call", "Call recording and automatic call logs."], ["Lead routing", "Assign leads by territory, source or round-robin."], ["Pipeline forecasting", "Weighted forecasts by stage and owner."], ["Indiamart and Justdial capture", "Pull enquiries automatically from marketplaces."]],
    plans: [{ name: "Basic", price: 599, unit: "per user / month", features: ["Pipelines", "Mobile app"] }, { name: "Pro", price: 999, unit: "per user / month", features: ["WhatsApp", "Calling", "Automation"], popular: true }] },
  { name: "DealDesk", vendor: "tarang-digital", category: "sales-crm", tagline: "Simple pipelines for small sales teams", pricing: "FREEMIUM", price: 0, deployment: ["CLOUD"], industries: ["professional-services", "retail"], color: "#9D174D",
    features: [["Kanban pipeline", "Drag deals between stages."], ["Email tracking", "Know when prospects open your proposal."], ["Quotations", "Branded quotes with GST."]] },
  { name: "SupportSetu", vendor: "tarang-digital", category: "help-desk-software", tagline: "Omnichannel help desk for Indian support teams", pricing: "SUBSCRIPTION", price: 899, unit: "per agent / month", trial: true, deployment: ["CLOUD"], industries: ["retail", "education"], color: "#4D7C0F",
    features: [["Email, chat and WhatsApp", "Every conversation in one ticket queue."], ["SLA timers", "Escalate tickets before they breach."], ["Knowledge base", "Self-service articles in multiple languages."]] },
  { name: "Udyog ERP", vendor: "udyog-systems", category: "erp-software", also: ["manufacturing-erp"], tagline: "ERP for growing Indian manufacturers", pricing: "QUOTE_BASED", price: null, deployment: ["CLOUD", "ON_PREMISE", "HYBRID"], industries: ["manufacturing"], flags: ["featured", "recommended"], color: "#1E293B",
    features: [["Production planning", "MRP from sales orders to purchase suggestions."], ["Bill of materials", "Multi-level BOM with alternates."], ["Job work", "Track material sent to and received from job workers."], ["Quality control", "Inspection plans at receipt and dispatch."], ["Finance and GST", "Accounting with e-invoicing built in."]] },
  { name: "Vitaran DMS", vendor: "udyog-systems", category: "distribution-erp", tagline: "Distributor and dealer management for FMCG brands", pricing: "QUOTE_BASED", price: null, deployment: ["CLOUD", "MOBILE"], industries: ["retail", "logistics"], color: "#7F1D1D",
    features: [["Salesman app", "Beat plans, orders and collections on mobile."], ["Secondary sales", "See distributor stock and sales in real time."], ["Schemes", "Configure trade schemes and claims."]] },
  { name: "Godown Pro", vendor: "godown-pro", category: "inventory-management-software", tagline: "Warehouse inventory with barcode and batch tracking", pricing: "SUBSCRIPTION", price: 1199, unit: "per month", trial: true, deployment: ["CLOUD", "MOBILE"], industries: ["retail", "manufacturing", "logistics"], flags: ["popular"], color: "#166534",
    features: [["Barcode and QR labels", "Print labels and scan with any Android phone."], ["Batch and expiry", "FEFO picking for pharma and FMCG."], ["Multi-warehouse", "Transfer stock between locations with approvals."], ["Marketplace sync", "Keep stock in sync with online stores."]] },
  { name: "StockSathi", vendor: "dukaan-byte", category: "inventory-management-software", tagline: "Inventory and orders for small traders", pricing: "FREEMIUM", price: 0, deployment: ["MOBILE"], industries: ["retail"], color: "#EA580C",
    features: [["Low-stock alerts", "WhatsApp alerts when stock dips."], ["Purchase orders", "Send POs to suppliers in one tap."]] },
  { name: "ThaliPOS", vendor: "dukaan-byte", category: "restaurant-pos", also: ["pos-software"], tagline: "Restaurant billing with KOT and online orders", pricing: "SUBSCRIPTION", price: 9999, unit: "per year", trial: true, deployment: ["CLOUD", "DESKTOP", "MOBILE"], industries: ["hospitality"], flags: ["trending", "featured"], color: "#DC2626",
    features: [["KOT and table management", "Send orders to the kitchen by station."], ["Aggregator integration", "Accept delivery-app orders in the same screen."], ["Recipe costing", "Track food cost and wastage."], ["Loyalty", "Points and offers for repeat diners."]],
    plans: [{ name: "Single outlet", price: 9999, period: "YEARLY", unit: "per year", features: ["1 outlet", "Unlimited bills"], popular: true }, { name: "Chain", price: null, features: ["Central menu", "Multi-outlet reports"] }] },
  { name: "Counter Retail POS", vendor: "godown-pro", category: "retail-pos", also: ["pos-software"], tagline: "Fast barcode billing for supermarkets and fashion stores", pricing: "SUBSCRIPTION", price: 799, unit: "per counter / month", deployment: ["DESKTOP", "CLOUD"], industries: ["retail"], color: "#0F172A",
    features: [["Offline billing", "Keep billing when the internet drops."], ["Size and colour matrix", "Variants for apparel and footwear."], ["Promotions", "Buy-X-get-Y, combos and coupons."]] },
  { name: "Sangam Projects", vendor: "sangam-workspace", category: "project-management-software", tagline: "Tasks, timelines and timesheets for agencies", pricing: "FREEMIUM", price: 0, deployment: ["CLOUD", "MOBILE"], industries: ["professional-services", "construction"], flags: ["popular"], color: "#BE123C",
    features: [["Boards and Gantt", "Switch views without changing data."], ["Timesheets", "Log time against tasks and bill clients."], ["Client portal", "Share progress without giving full access."]],
    plans: [{ name: "Free", price: 0, features: ["Up to 5 users"] }, { name: "Team", price: 249, unit: "per user / month", features: ["Gantt", "Timesheets", "Guests"], popular: true }] },
  { name: "SiteDiary", vendor: "sangam-workspace", category: "project-management-software", tagline: "Construction project tracking from site to office", pricing: "SUBSCRIPTION", price: 3999, unit: "per project / month", deployment: ["MOBILE", "CLOUD"], industries: ["construction"], color: "#A16207",
    features: [["Daily progress reports", "Photos, labour and material logged from site."], ["Material requests", "Raise and approve site indents."], ["Subcontractor billing", "Measure work done and certify bills."]] },
  { name: "Tarang Mail", vendor: "tarang-digital", category: "email-marketing-software", also: ["marketing-software"], tagline: "Email campaigns with Indian-language templates", pricing: "FREEMIUM", price: 0, deployment: ["CLOUD"], industries: ["retail", "education"], color: "#DB2777",
    features: [["Drag-and-drop editor", "Responsive templates in eight languages."], ["Automation journeys", "Welcome, abandoned-cart and win-back flows."], ["Deliverability tools", "Domain authentication and list cleaning."]],
    plans: [{ name: "Free", price: 0, features: ["2,000 contacts"] }, { name: "Growth", price: 1499, unit: "per month", features: ["25,000 contacts", "Automation"], popular: true }] },
  { name: "Sandesh WhatsApp Suite", vendor: "tarang-digital", category: "whatsapp-marketing-software", also: ["marketing-software"], tagline: "Official WhatsApp Business API with chatbots", pricing: "SUBSCRIPTION", price: 2499, unit: "per month", trial: true, deployment: ["CLOUD"], industries: ["retail", "education", "healthcare"], flags: ["trending", "sponsored"], color: "#15803D",
    features: [["Green-tick onboarding", "Help with verification and template approvals."], ["Broadcasts", "Send approved templates to segmented lists."], ["No-code chatbots", "Answer FAQs and qualify leads automatically."], ["Shared team inbox", "Assign chats to agents with notes."]] },
  { name: "Arogya Clinic", vendor: "arogya-informatics", category: "healthcare-software", tagline: "Clinic management with e-prescriptions and ABDM support", pricing: "SUBSCRIPTION", price: 1499, unit: "per doctor / month", trial: true, deployment: ["CLOUD", "MOBILE"], industries: ["healthcare"], flags: ["featured"], color: "#0D9488",
    features: [["Appointments and queue", "Online booking with token display."], ["E-prescriptions", "Templates by specialty, shared on WhatsApp."], ["Billing and packages", "Consultations, procedures and memberships."], ["ABDM ready", "Link health records to ABHA IDs."]] },
  { name: "Arogya HIS", vendor: "arogya-informatics", category: "healthcare-software", tagline: "Hospital information system for 50–500 beds", pricing: "QUOTE_BASED", price: null, deployment: ["ON_PREMISE", "HYBRID", "CLOUD"], industries: ["healthcare"], color: "#115E59",
    features: [["IPD and OPD", "Admissions, bed management and discharge summaries."], ["Pharmacy and lab", "Integrated inventory and LIS."], ["TPA and insurance", "Pre-auth and claim tracking."]] },
  { name: "Vidyaa School ERP", vendor: "vidyaa-tech", category: "school-management-software", tagline: "Admissions, fees, attendance and parent app", pricing: "SUBSCRIPTION", price: 25, unit: "per student / year", deployment: ["CLOUD", "MOBILE"], industries: ["education"], flags: ["popular"], color: "#065F46",
    features: [["Online fee collection", "UPI and card payments with automatic receipts."], ["Parent app", "Homework, attendance and circulars."], ["Timetable builder", "Automatic timetables with teacher constraints."], ["Report cards", "CBSE and state-board formats."]] },
  { name: "Kavach Endpoint", vendor: "kavach-secure", category: "cyber-security-software", tagline: "Endpoint protection managed from one console", pricing: "SUBSCRIPTION", price: 899, unit: "per device / year", trial: true, deployment: ["CLOUD", "DESKTOP"], industries: ["professional-services", "manufacturing", "healthcare"], color: "#991B1B",
    features: [["Ransomware rollback", "Restore files encrypted by ransomware."], ["USB control", "Block or allow removable drives by policy."], ["Patch management", "Push OS and app updates centrally."]] },
  { name: "Kavach Backup", vendor: "kavach-secure", category: "cyber-security-software", tagline: "Encrypted backups stored in Indian data centres", pricing: "SUBSCRIPTION", price: 499, unit: "per 100 GB / month", deployment: ["CLOUD"], industries: ["professional-services", "healthcare"], color: "#7C2D12",
    features: [["Laptop and server backup", "Continuous backup with versioning."], ["Microsoft 365 backup", "Mail, OneDrive and SharePoint."], ["Data residency", "Choose Mumbai or Hyderabad regions."]] },
  { name: "Sangam Chat", vendor: "sangam-workspace", category: "collaboration-software", tagline: "Team chat and video meetings hosted in India", pricing: "FREEMIUM", price: 0, deployment: ["CLOUD", "DESKTOP", "MOBILE"], industries: ["professional-services", "education"], color: "#B45309",
    features: [["Channels and threads", "Organise conversations by team or project."], ["Video meetings", "Up to 100 participants with recording."], ["Guest access", "Invite clients to shared channels."]] },
];

export const POSTS = [
  { title: "How to choose accounting software for a growing business", slug: "choose-accounting-software", type: "GUIDE", category: "buying-guides", products: ["ledgerline-books", "kanakku-prime"],
    body: "<p>Accounting software is the system your business will live in every day, so the right choice depends less on feature lists and more on how you work.</p><h2>Start with compliance</h2><p>If you file GST returns monthly, prioritise tools that reconcile purchase data with GSTR-2B and generate e-invoices without re-keying. Ask vendors to demonstrate a full month-end close, not just invoice creation.</p><h2>Cloud or desktop?</h2><p>Cloud tools make it easy for your CA and remote staff to work together. Desktop tools still suit businesses with unreliable internet or very high transaction volumes on a single site.</p><h2>Plan for the next three years</h2><ul><li>How many GSTINs and branches will you have?</li><li>Will you need inventory, payroll or e-commerce integration?</li><li>Can you export your data if you switch later?</li></ul><p>Shortlist two or three products, ask for a demo on your own data, and talk to a current customer of similar size.</p>" },
  { title: "Payroll compliance checklist for Indian employers", slug: "payroll-compliance-checklist", type: "GUIDE", category: "hr", products: ["peoplefirst-hrms", "paystack-india"],
    body: "<p>Every payroll run touches several statutory obligations. Missing one can mean penalties and unhappy employees.</p><h2>Monthly</h2><ul><li>Provident Fund contributions and ECR filing</li><li>ESI contributions for eligible employees</li><li>Professional Tax, where applicable in your state</li><li>TDS deduction and deposit</li></ul><h2>Quarterly and annually</h2><ul><li>TDS returns (Form 24Q)</li><li>Form 16 for every employee</li><li>Labour Welfare Fund, depending on the state</li></ul><p>Good payroll software calculates these automatically and keeps an audit trail when rules change mid-year.</p>" },
  { title: "WhatsApp Business API: what small businesses should know", slug: "whatsapp-business-api-guide", type: "ARTICLE", category: "marketing", products: ["sandesh-whatsapp-suite"],
    body: "<p>The WhatsApp Business app works well for a single phone. Once several people need to reply or you want automated messages, you need the Business API through an approved provider.</p><h2>Costs to expect</h2><p>You pay the provider a platform fee plus per-conversation charges set by Meta, which differ for marketing, utility and service messages.</p><h2>Getting templates approved</h2><p>Outbound messages must use pre-approved templates. Keep them specific, avoid misleading claims and always give customers a way to opt out.</p>" },
  { title: "Restaurant POS buyer's guide", slug: "restaurant-pos-buyers-guide", type: "GUIDE", category: "buying-guides", products: ["thalipos"],
    body: "<p>A restaurant POS has to be fast at the counter and reliable in the kitchen. Here is what to test before you buy.</p><h2>During a busy hour</h2><p>Ask for a trial during service. Check how quickly staff can split bills, move tables and send KOTs to different stations.</p><h2>Integrations</h2><p>Delivery-app orders should land in the same screen and update stock automatically.</p>" },
];
