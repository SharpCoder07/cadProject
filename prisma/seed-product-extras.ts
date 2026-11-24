/**
 * Demo editorial content for product pages: pros, cons, "best for / not ideal for" and a few answered
 * buyer questions. Products are matched by slug; missing ones are skipped. Used by seedProductExtras().
 */

export interface ProductExtra {
  slug: string;
  pros: string[];
  cons: string[];
  bestFor: string;
  notIdealFor: string;
  questions: { q: string; a: string; by: string }[];
}

export const PRODUCT_EXTRAS: ProductExtra[] = [
  {
    slug: "ledgerline-books",
    pros: ["One-click GSTR-1 and GSTR-3B from your invoices", "E-invoicing and e-way bills from the invoice screen", "Free access for your CA", "Works well across multiple branches and GSTINs"],
    cons: ["Needs a stable internet connection", "Advanced inventory is a paid add-on", "Payroll is sold separately"],
    bestFor: "Growing retail, services and trading businesses that file GST monthly and want their CA and branch staff working on the same books.",
    notIdealFor: "Businesses with very high billing volumes at a single site and unreliable internet — a desktop product may suit better.",
    questions: [
      { q: "Can my chartered accountant log in without paying for an extra user?", a: "Yes. Ledgerline Books includes free accountant access with read or edit rights, so your CA can review entries and file returns without an extra licence.", by: "Riya S." },
      { q: "Does it reconcile purchases with GSTR-2B?", a: "Yes. It imports GSTR-2B and matches it against your purchase register, highlighting missing or mismatched invoices before you claim input tax credit.", by: "Amit K." },
    ],
  },
  {
    slug: "kanakku-prime",
    pros: ["Very fast data entry with keyboard shortcuts", "Works fully offline on a desktop or LAN", "Familiar to most accountants", "One-time licence option"],
    cons: ["Remote access needs an add-on", "Interface feels dated next to cloud tools", "Backups are your responsibility"],
    bestFor: "Single-site businesses with heavy daily transactions and accountants who prefer a desktop workflow.",
    notIdealFor: "Teams spread across locations who need to work on the same books from anywhere.",
    questions: [
      { q: "Can I access Kanakku Prime from home?", a: "Yes, with the remote-access add-on or by hosting it on a cloud server. The standard licence works on your office PC or local network.", by: "Neha P." },
    ],
  },
  {
    slug: "peoplefirst-hrms",
    pros: ["Payroll, attendance and leave in one system", "PF, ESI and PT calculations built in", "Mobile app for attendance and payslips", "Clear approval workflows"],
    cons: ["Setup takes a few weeks for larger teams", "Appraisal module costs extra"],
    bestFor: "Companies with 25–1,000 employees that want payroll, attendance and leave connected, with statutory compliance handled.",
    notIdealFor: "Very small teams that only need simple payslips — a basic payroll tool will be cheaper.",
    questions: [
      { q: "Does it generate Form 16 for employees?", a: "Yes. Form 16 is generated from the year's payroll and TDS data, and employees can download it from the self-service app.", by: "Karthik R." },
      { q: "Can it work with our biometric attendance machines?", a: "Yes. It integrates with common biometric devices, and attendance can also be marked on the mobile app with geo-fencing.", by: "Pooja M." },
    ],
  },
  {
    slug: "thalipos",
    pros: ["Fast billing with table moves and bill splits", "Kitchen order tickets by station", "Delivery-app orders in the same screen", "Keeps billing when the internet drops"],
    cons: ["Recipe-level inventory is in the higher plan", "Limited reports for multi-brand kitchens"],
    bestFor: "Restaurants, cafés and cloud kitchens that need quick counter billing, KOTs and delivery-app orders in one place.",
    notIdealFor: "Large restaurant chains needing central kitchen management and advanced multi-outlet analytics.",
    questions: [
      { q: "Does ThaliPOS work on an Android tablet?", a: "Yes. It runs on Android tablets and Windows PCs, and supports common thermal printers and cash drawers.", by: "Vikram S." },
    ],
  },
  {
    slug: "axiomcad",
    pros: ["Reliable DWG open and save", "Familiar commands and shortcuts", "Perpetual licence option", "Light on hardware"],
    cons: ["3D modelling is basic", "Fewer third-party plug-ins than the market leaders"],
    bestFor: "Architects, interior designers and engineering offices doing day-to-day 2D drafting with DWG files.",
    notIdealFor: "Teams that need full 3D modelling or BIM — consider a BIM tool alongside it.",
    questions: [
      { q: "Can AxiomCAD open drawings made in AutoCAD?", a: "Yes. It opens and saves DWG files directly, including layers, blocks, xrefs and dimension styles. Test a few of your own drawings in the free trial to be sure.", by: "Sameer J." },
      { q: "Is there a perpetual licence?", a: "Yes. You can choose a subscription or a perpetual licence with optional yearly maintenance for upgrades.", by: "Ananya D." },
    ],
  },
  {
    slug: "clouddraft",
    pros: ["Runs in the browser — nothing to install", "Easy markups and comments on site", "Real-time sharing with clients"],
    cons: ["Slower than desktop CAD for heavy drawings", "Needs internet to work"],
    bestFor: "Site teams, reviewers and small offices who view, mark up and make quick edits to drawings from anywhere.",
    notIdealFor: "Full-time drafters working on large, complex drawings all day.",
    questions: [],
  },
  {
    slug: "saarthi-crm",
    pros: ["Simple pipeline that small teams adopt quickly", "WhatsApp and call logging against each lead", "Good mobile app for field sales"],
    cons: ["Automation is limited in the starter plan", "Reports need some setup"],
    bestFor: "Small and mid-sized sales teams replacing spreadsheets and WhatsApp groups with one shared pipeline.",
    notIdealFor: "Large enterprises with complex territory, quote and approval workflows.",
    questions: [
      { q: "Can leads from our website form go straight into Saarthi CRM?", a: "Yes. Website forms, ad leads and marketplace enquiries can be captured automatically and assigned to salespeople by rules.", by: "Rahul T." },
    ],
  },
  {
    slug: "sandesh-whatsapp-suite",
    pros: ["Shared WhatsApp inbox for the whole team", "No-code chatbot builder", "Template approval help"],
    cons: ["Meta's message charges are billed on top of the plan"],
    bestFor: "Businesses that want several people answering WhatsApp from one number, with automated order updates and reminders.",
    notIdealFor: "A single person replying from one phone — the free WhatsApp Business app is enough.",
    questions: [],
  },
];
