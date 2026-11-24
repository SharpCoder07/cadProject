/**
 * Demo CAD catalogue (fictional brands and prices) used to show the classification pages
 * (/use-case/2d-drafting, /profession/architect…), price comparison and geo pages with real content.
 * Added by `npm run db:seed` when missing; never in production.
 */

type Kind = "USE_CASE" | "PROFESSION" | "FEATURE" | "PLATFORM" | "DEPLOYMENT_MODEL" | "LICENSING_MODEL" | "BUDGET_RANGE" | "CUSTOMER_TYPE" | "OPERATING_SYSTEM";

export const CAD_CATEGORIES = {
  root: { name: "CAD & Design", slug: "cad-software", icon: "boxes", description: "2D drafting, 3D modelling, BIM and CNC software for architects, engineers and designers." },
  children: [
    { name: "2D CAD", slug: "2d-cad-software", description: "Drafting and documentation tools that read and write DWG." },
    { name: "3D CAD & Modelling", slug: "3d-cad-software", description: "Parametric and direct 3D modelling for product and mechanical design." },
    { name: "BIM Software", slug: "bim-software", description: "Building information modelling for architects and construction teams." },
    { name: "CAM & CNC", slug: "cam-cnc-software", description: "Toolpaths and CNC programming for manufacturing." },
  ],
};

export const CAD_VENDORS = [
  { name: "Vectrix Systems", slug: "vectrix-systems", city: "Pune", founded: 2009, size: "201–500", color: "#047857" },
  { name: "Planora Technologies", slug: "planora-technologies", city: "Bengaluru", founded: 2014, size: "51–200", color: "#0F766E" },
  { name: "Axiom CAD Labs", slug: "axiom-cad-labs", city: "Chennai", founded: 2004, size: "501–1000", color: "#BE123C" },
  { name: "OpenSketch Foundation", slug: "opensketch-foundation", city: "Hyderabad", founded: 2016, size: "11–50", color: "#B45309" },
  { name: "Formwise Software", slug: "formwise-software", city: "Ahmedabad", founded: 2012, size: "51–200", color: "#BE123C" },
];

export interface CadProduct {
  name: string;
  vendor: string;
  category: string;
  also?: string[];
  tagline: string;
  pricing: "FREE" | "FREEMIUM" | "SUBSCRIPTION" | "ONE_TIME" | "QUOTE_BASED";
  price: number | null;
  unit: string;
  trial?: boolean;
  deployment: ("CLOUD" | "DESKTOP" | "ON_PREMISE" | "HYBRID" | "MOBILE")[];
  flags?: ("featured" | "popular" | "trending" | "recommended")[];
  color: string;
  features: [string, string][];
  plans: { name: string; price: number | null; unit?: string; period?: "MONTHLY" | "YEARLY" | "ONE_TIME" | "CUSTOM"; features: string[]; popular?: boolean }[];
  terms: Partial<Record<Kind, string[]>>;
  /** 1–5 star reviews: [rating, title, body, pros, cons, author, role, company] */
  reviews: [number, string, string, string, string, string, string, string][];
}

export const CAD_PRODUCTS: CadProduct[] = [
  {
    name: "DraftLine 2D", vendor: "vectrix-systems", category: "2d-cad-software", tagline: "Fast DWG-native 2D drafting for Indian design offices",
    pricing: "SUBSCRIPTION", price: 2499, unit: "per user / month", trial: true, deployment: ["DESKTOP"], flags: ["featured", "popular"], color: "#047857",
    features: [["Native DWG and DXF", "Open, edit and save DWG files from 2000 to 2026 without conversion."], ["Smart dimensions", "Associative dimensions that update when geometry changes."], ["Block libraries", "Thousands of IS-standard blocks for architecture and MEP."], ["Layer standards", "Enforce office layer and text standards across every drawing."], ["Batch plotting", "Plot whole sheet sets to PDF or printers in one go."], ["Hindi and English UI", "Switch the interface language per user."]],
    plans: [{ name: "Standard", price: 2499, unit: "per user / month", features: ["2D drafting", "DWG/DXF", "Email support"] }, { name: "Professional", price: 3999, unit: "per user / month", features: ["Everything in Standard", "Sheet sets", "Batch plotting", "Phone support"], popular: true }, { name: "Perpetual", price: 64999, unit: "one-time, per user", period: "ONE_TIME", features: ["Lifetime licence", "1 year updates"] }],
    terms: { USE_CASE: ["2D Drafting", "Construction Documentation", "CAD Standards"], PROFESSION: ["Draftsperson", "Architect", "CAD Designer", "Civil Engineer"], FEATURE: ["DWG Support", "Offline Mode"], PLATFORM: ["Windows"], OPERATING_SYSTEM: ["Windows"], DEPLOYMENT_MODEL: ["Desktop"], LICENSING_MODEL: ["Named User", "Subscription", "Perpetual"], BUDGET_RANGE: ["₹10,000 – ₹50,000"], CUSTOMER_TYPE: ["Small Business", "Professional Teams"] },
    reviews: [[5, "Our drawings open exactly as they were", "We exchange DWGs with consultants every day and nothing breaks. Layer standards alone saved us hours per project.", "Perfect DWG compatibility", "No macOS version", "Kavya Rao", "Senior Architect", "Rao & Associates"], [4, "Great value for a small office", "Moved from an expensive subscription and the team was productive in a week.", "Price and speed", "Rendering is basic", "Imran Sheikh", "CAD Manager", "Sheikh Consultants"], [4, "Solid daily driver", "Plotting sheet sets to PDF is quick and reliable. Support answers on WhatsApp.", "Batch plotting", "Some 3D tools missing", "Pooja Nair", "Draftsperson", "Nair Builders"]],
  },
  {
    name: "DraftLine Pro 3D", vendor: "vectrix-systems", category: "3d-cad-software", also: ["2d-cad-software"], tagline: "2D drafting plus parametric 3D in one licence",
    pricing: "ONE_TIME", price: 89000, unit: "perpetual licence", trial: true, deployment: ["DESKTOP"], flags: ["recommended"], color: "#065F46",
    features: [["Parametric solids", "Feature-based modelling with a full history tree."], ["2D from 3D", "Generate views and sections that stay linked to the model."], ["Sheet metal", "Flanges, bends and flat patterns with K-factor control."], ["Assemblies", "Mates, interference checks and exploded views."], ["Photo renders", "GPU rendering for client presentations."]],
    plans: [{ name: "Pro 3D", price: 89000, unit: "per user, perpetual", period: "ONE_TIME", features: ["2D + 3D", "1 year updates"], popular: true }, { name: "Network", price: 125000, unit: "per floating seat", period: "ONE_TIME", features: ["Floating licence server", "Priority support"] }],
    terms: { USE_CASE: ["3D Modelling", "2D Drafting", "Design Optimization"], PROFESSION: ["Mechanical Engineer", "Design Engineer", "CAD Designer"], FEATURE: ["Parametric Modelling", "DWG Support", "Rendering"], PLATFORM: ["Windows"], OPERATING_SYSTEM: ["Windows"], DEPLOYMENT_MODEL: ["Desktop"], LICENSING_MODEL: ["Perpetual", "Concurrent / Floating"], BUDGET_RANGE: ["₹50,000 – ₹2,00,000"], CUSTOMER_TYPE: ["Professional Teams", "Enterprise"] },
    reviews: [[5, "Finally one tool for 2D and 3D", "Our designers model in 3D and the drafting team gets linked drawings. Revisions are painless now.", "Linked drawings", "Steep learning curve at first", "Rahul Deshmukh", "Design Lead", "Deshmukh Engineering"], [4, "Perpetual licence makes sense for us", "No yearly surprises in cost. Sheet metal tools are good enough for our fabrication work.", "One-time cost", "Renders are slow on older GPUs", "Sneha Patil", "Mechanical Engineer", "Patil Fabricators"]],
  },
  {
    name: "Planora BIM", vendor: "planora-technologies", category: "bim-software", also: ["2d-cad-software"], tagline: "BIM for Indian architects, from concept to construction drawings",
    pricing: "SUBSCRIPTION", price: 6999, unit: "per user / month", trial: true, deployment: ["DESKTOP", "CLOUD"], flags: ["featured", "trending"], color: "#0F766E",
    features: [["Intelligent walls and slabs", "Building elements that know their materials and quantities."], ["Auto drawing sets", "Plans, sections and elevations update from one model."], ["Quantity take-off", "Export BOQs as per IS 1200 to Excel."], ["Cloud collaboration", "Consultants work on the same model with live comments."], ["IFC exchange", "Round-trip IFC with structural and MEP tools."], ["Municipal submission sheets", "Templates for common Indian bylaws."]],
    plans: [{ name: "Studio", price: 6999, unit: "per user / month", features: ["BIM modelling", "Drawing sets", "IFC"] }, { name: "Team", price: 9999, unit: "per user / month", features: ["Everything in Studio", "Cloud collaboration", "BOQ export"], popular: true }, { name: "Enterprise", price: null, features: ["SSO", "Private cloud", "Dedicated manager"] }],
    terms: { USE_CASE: ["Architectural BIM", "Architectural Design", "Construction Documentation", "2D Drafting"], PROFESSION: ["Architect", "BIM Manager", "Civil Engineer"], FEATURE: ["Cloud Collaboration", "DWG Support", "Rendering"], PLATFORM: ["Windows", "macOS", "Web"], OPERATING_SYSTEM: ["Windows", "macOS"], DEPLOYMENT_MODEL: ["Desktop", "Cloud Collaboration"], LICENSING_MODEL: ["Named User", "Subscription"], BUDGET_RANGE: ["₹50,000 – ₹2,00,000"], CUSTOMER_TYPE: ["Professional Teams", "Enterprise"] },
    reviews: [[5, "BOQs straight from the model", "Quantity take-off used to take our team a week. Now it's an export.", "Quantity take-off", "Needs a strong PC", "Arjun Menon", "Principal Architect", "Menon Design Studio"], [4, "Collaboration actually works", "Our structural consultant comments directly on the model. Fewer emails, fewer mistakes.", "Live comments", "Subscription adds up for big teams", "Divya Bhat", "BIM Manager", "Bhat Infra"], [5, "Bylaw templates are a lifesaver", "Municipal submission drawings come out right the first time.", "Indian templates", "Rendering is average", "Sameer Joshi", "Architect", "Joshi Architects"]],
  },
  {
    name: "Planora Viz", vendor: "planora-technologies", category: "3d-cad-software", tagline: "Real-time walkthroughs and renders for architects and interior designers",
    pricing: "SUBSCRIPTION", price: 1999, unit: "per user / month", trial: true, deployment: ["DESKTOP"], color: "#14B8A6",
    features: [["One-click import", "Bring in models from BIM and 3D tools with materials intact."], ["Real-time walkthroughs", "Walk clients through the space on a laptop or VR headset."], ["Indian material library", "Kota stone, granite, laminates and more."], ["4K stills and panoramas", "Share 360° panoramas as a link."]],
    plans: [{ name: "Solo", price: 1999, unit: "per user / month", features: ["Renders", "Walkthroughs"], popular: true }, { name: "Studio", price: 2999, unit: "per user / month", features: ["Everything in Solo", "VR", "Team library"] }],
    terms: { USE_CASE: ["Architectural Visualization", "Concept Design"], PROFESSION: ["Architect", "Interior Designer"], FEATURE: ["Rendering"], PLATFORM: ["Windows", "macOS"], OPERATING_SYSTEM: ["Windows", "macOS"], DEPLOYMENT_MODEL: ["Desktop"], LICENSING_MODEL: ["Subscription"], BUDGET_RANGE: ["₹10,000 – ₹50,000"], CUSTOMER_TYPE: ["Freelancers", "Small Business"] },
    reviews: [[5, "Clients sign off faster", "A walkthrough on the laptop beats any number of drawings.", "Real-time quality", "Large scenes need a good GPU", "Ritika Agarwal", "Interior Designer", "Studio Ritika"], [4, "Great material library", "The Indian materials save a lot of texture hunting.", "Materials", "Learning curve for lighting", "Manish Gupta", "Architect", "Gupta & Partners"]],
  },
  {
    name: "AxiomCAD", vendor: "axiom-cad-labs", category: "2d-cad-software", also: ["3d-cad-software"], tagline: "Enterprise CAD with standards control and floating licences",
    pricing: "QUOTE_BASED", price: null, unit: "", trial: false, deployment: ["DESKTOP", "ON_PREMISE"], flags: ["recommended"], color: "#BE123C",
    features: [["CAD standards checker", "Audit every drawing against company standards before release."], ["Floating licences", "Share seats across shifts and offices."], ["PLM connectors", "Check drawings in and out of your PLM."], ["API and scripting", "Automate repetitive tasks with Python and .NET."], ["2D and 3D", "Full drafting plus solid and surface modelling."]],
    plans: [{ name: "Enterprise", price: null, features: ["Floating licences", "Standards checker", "API"], popular: true }, { name: "Education", price: null, features: ["Campus licence", "Lab management"] }],
    terms: { USE_CASE: ["2D Drafting", "3D Modelling", "CAD Standards"], PROFESSION: ["CAD Administrator", "CAD Designer", "Mechanical Engineer", "Detailer"], FEATURE: ["DWG Support", "Role-based Access", "API Access"], PLATFORM: ["Windows", "Linux"], OPERATING_SYSTEM: ["Windows", "Linux"], DEPLOYMENT_MODEL: ["Desktop", "On-premise"], LICENSING_MODEL: ["Concurrent / Floating", "Confirm with vendor"], CUSTOMER_TYPE: ["Enterprise"] },
    reviews: [[4, "Standards checker pays for itself", "Drawings that leave our office are consistent across five locations.", "Standards control", "Pricing isn't public", "Venkat Raman", "CAD Administrator", "Raman Heavy Industries"], [4, "Floating licences fit our shifts", "Two shifts share the same seats, which halved our licence count.", "Floating licences", "Initial setup needs IT help", "Lakshmi Iyer", "Engineering Manager", "Iyer Motors"]],
  },
  {
    name: "AxiomCAM CNC", vendor: "axiom-cad-labs", category: "cam-cnc-software", tagline: "Toolpaths and post-processors for Indian machine shops",
    pricing: "ONE_TIME", price: 145000, unit: "perpetual licence", trial: true, deployment: ["DESKTOP"], color: "#BE123C",
    features: [["2.5D to 5-axis toolpaths", "Pocketing, adaptive clearing and simultaneous 5-axis."], ["Post-processor library", "Ready posts for common Indian and imported controllers."], ["Machine simulation", "Catch collisions before they happen on the shop floor."], ["Tool library", "Store feeds and speeds per material."]],
    plans: [{ name: "Mill 3-axis", price: 145000, unit: "per seat, perpetual", period: "ONE_TIME", features: ["2.5D/3D milling", "Simulation"], popular: true }, { name: "Mill 5-axis", price: 295000, unit: "per seat, perpetual", period: "ONE_TIME", features: ["Everything in 3-axis", "5-axis", "Machine simulation"] }],
    terms: { USE_CASE: ["CNC Programming", "Design Optimization"], PROFESSION: ["CNC Programmer", "Mechanical Engineer"], FEATURE: ["Offline Mode"], PLATFORM: ["Windows"], OPERATING_SYSTEM: ["Windows"], DEPLOYMENT_MODEL: ["Desktop"], LICENSING_MODEL: ["Perpetual"], BUDGET_RANGE: ["₹50,000 – ₹2,00,000"], CUSTOMER_TYPE: ["Professional Teams", "Enterprise"] },
    reviews: [[5, "Posts worked on day one", "Our Indian controller post was in the library. Cycle times dropped 18%.", "Post-processors", "UI feels dated", "Harpreet Singh", "CNC Programmer", "Singh Precision"], [4, "Simulation saved a spindle", "Caught a collision we'd have missed.", "Simulation", "5-axis is expensive", "Karthik S", "Production Head", "KS Tools"]],
  },
  {
    name: "OpenSketch", vendor: "opensketch-foundation", category: "2d-cad-software", tagline: "Free, open-source 2D CAD for students and small offices",
    pricing: "FREE", price: 0, unit: "", deployment: ["DESKTOP"], flags: ["trending"], color: "#B45309",
    features: [["Completely free", "No licence fees, ever, for any use."], ["DXF native", "Reads and writes DXF; DWG via a free converter."], ["Runs everywhere", "Windows, macOS and Linux."], ["Plugin ecosystem", "Community plugins for dimensions, hatches and more."]],
    plans: [{ name: "Community", price: 0, features: ["All features", "Community forum"], popular: true }],
    terms: { USE_CASE: ["2D Drafting", "Concept Design"], PROFESSION: ["Student", "Draftsperson", "Architect"], FEATURE: ["DWG Support", "Offline Mode"], PLATFORM: ["Windows", "macOS", "Linux"], OPERATING_SYSTEM: ["Windows", "macOS", "Linux"], DEPLOYMENT_MODEL: ["Desktop"], LICENSING_MODEL: ["Free"], BUDGET_RANGE: ["Free"], CUSTOMER_TYPE: ["Freelancers", "Students & Education"] },
    reviews: [[4, "Perfect for learning", "Our students use it at home without licence worries.", "Free and light", "DWG needs a converter", "Prof. Anil Kumar", "Faculty", "Govt. Polytechnic"], [3, "Good enough for simple drawings", "Fine for small jobs, but we moved to a paid tool for big projects.", "Free", "Fewer advanced tools", "Meera Pillai", "Freelance Draftsperson", "Self-employed"]],
  },
  {
    name: "CloudDraft", vendor: "formwise-software", category: "2d-cad-software", tagline: "2D CAD in the browser — draft, mark up and share from anywhere",
    pricing: "FREEMIUM", price: 0, unit: "", trial: false, deployment: ["CLOUD", "MOBILE"], flags: ["trending"], color: "#E11D48",
    features: [["Works in the browser", "Nothing to install; open DWGs on any computer."], ["Site markups on mobile", "Engineers mark up drawings on site from a phone or iPad."], ["Share by link", "Send a view-only link to clients — no software needed."], ["Version history", "Every save is kept; compare and restore."]],
    plans: [{ name: "Free", price: 0, features: ["3 active drawings", "View and markup"] }, { name: "Pro", price: 799, unit: "per user / month", features: ["Unlimited drawings", "DWG export", "Version history"], popular: true }, { name: "Team", price: 1299, unit: "per user / month", features: ["Everything in Pro", "Shared projects", "Admin controls"] }],
    terms: { USE_CASE: ["2D Drafting", "Construction Documentation"], PROFESSION: ["Draftsperson", "Civil Engineer", "Student"], FEATURE: ["Cloud Collaboration", "Mobile App", "DWG Support"], PLATFORM: ["Web", "Web Browser", "iPadOS", "Android", "iOS"], OPERATING_SYSTEM: ["Web", "iPadOS"], DEPLOYMENT_MODEL: ["Cloud / SaaS", "Cloud Collaboration"], LICENSING_MODEL: ["Freemium", "Subscription"], BUDGET_RANGE: ["Free", "Under ₹10,000"], CUSTOMER_TYPE: ["Freelancers", "Small Business"] },
    reviews: [[5, "Site markups changed our workflow", "Engineers mark up on site and the office sees it instantly.", "Mobile markups", "Not for heavy drafting", "Sunil Verma", "Site Engineer", "Verma Constructions"], [4, "Great for sharing with clients", "Clients open a link instead of installing a viewer.", "Share links", "Needs good internet", "Ayesha Khan", "Project Architect", "Khan Associates"]],
  },
  {
    name: "Formwise Mechanical", vendor: "formwise-software", category: "3d-cad-software", tagline: "Parametric 3D design for machines, automotive parts and tooling",
    pricing: "SUBSCRIPTION", price: 4499, unit: "per user / month", trial: true, deployment: ["DESKTOP", "HYBRID"], flags: ["popular"], color: "#BE123C",
    features: [["Parametric part modelling", "Sketch-based features with design tables."], ["Large assemblies", "Lightweight mode for 10,000+ part assemblies."], ["Simulation", "Linear static stress and modal analysis."], ["Generative design", "Explore lighter shapes that meet your loads."], ["Drawing automation", "BOMs and balloons generated from the model."]],
    plans: [{ name: "Design", price: 4499, unit: "per user / month", features: ["Parts and assemblies", "Drawings"] }, { name: "Design + Simulate", price: 6499, unit: "per user / month", features: ["Everything in Design", "Simulation", "Generative design"], popular: true }],
    terms: { USE_CASE: ["3D Modelling", "Automotive Design", "Design Optimization", "Computational Design"], PROFESSION: ["Mechanical Engineer", "Design Engineer"], FEATURE: ["Parametric Modelling", "Rendering", "API Access"], PLATFORM: ["Windows"], OPERATING_SYSTEM: ["Windows"], DEPLOYMENT_MODEL: ["Desktop", "Hybrid"], LICENSING_MODEL: ["Named User", "Subscription"], BUDGET_RANGE: ["₹50,000 – ₹2,00,000"], CUSTOMER_TYPE: ["Professional Teams", "Enterprise"] },
    reviews: [[5, "Big assemblies stay smooth", "Our 8,000-part machine opens in seconds in lightweight mode.", "Performance", "Simulation costs extra", "Nikhil Jain", "Design Engineer", "Jain Automotive"], [4, "Generative design is fun", "We cut bracket weight by a third.", "Generative design", "Takes time to learn", "Prakash R", "R&D Engineer", "Prakash Auto Parts"]],
  },
  {
    name: "ShapeShift Studio", vendor: "planora-technologies", category: "3d-cad-software", tagline: "Computational and parametric design for architects",
    pricing: "SUBSCRIPTION", price: 3299, unit: "per user / month", trial: true, deployment: ["DESKTOP"], color: "#0D9488",
    features: [["Visual scripting", "Build forms with nodes instead of code."], ["Facade optimisation", "Tune panels for daylight and cost."], ["Live link to BIM", "Push optimised geometry into Planora BIM."], ["Script library", "Ready graphs for common forms."]],
    plans: [{ name: "Studio", price: 3299, unit: "per user / month", features: ["Visual scripting", "Library"], popular: true }],
    terms: { USE_CASE: ["Computational Design", "Concept Design", "Architectural Design"], PROFESSION: ["Architect", "Design Engineer"], FEATURE: ["Parametric Modelling", "Rendering"], PLATFORM: ["Windows", "macOS"], OPERATING_SYSTEM: ["Windows", "macOS"], DEPLOYMENT_MODEL: ["Desktop"], LICENSING_MODEL: ["Subscription"], BUDGET_RANGE: ["₹10,000 – ₹50,000"], CUSTOMER_TYPE: ["Professional Teams"] },
    reviews: [[4, "Facade studies in hours", "We test dozens of options before lunch.", "Speed of iteration", "Needs some scripting logic", "Tanvi Shah", "Computational Designer", "Shah Architects"]],
  },
];

/** Extra page content for the demo classification pages. */
export const CAD_TERM_PAGES: { kind: Kind; name: string; description: string; promoted?: string; badge?: string; content?: string; faqs?: [string, string][] }[] = [
  {
    kind: "USE_CASE", name: "2D Drafting", promoted: "DraftLine 2D", badge: "Editor's pick",
    description: "Compare 2D drafting software for plans, sections and construction drawings — DWG compatibility, licensing and prices side by side.",
    content: "<h2>How to choose 2D drafting software</h2><p>Start with <strong>DWG compatibility</strong>: if you exchange drawings with consultants, make sure files open without lost layers or fonts. Next, decide between a <strong>subscription</strong> and a <strong>perpetual licence</strong> — subscriptions cost less up front, perpetual licences cost less over five years.</p><h3>What to check in a demo</h3><ul><li>Open one of your own complex drawings.</li><li>Plot a full sheet set to PDF.</li><li>Ask how layer standards are enforced across the team.</li></ul>",
    faqs: [["What is the best free 2D drafting software?", "OpenSketch is free and open source and works well for students and small drawings. For daily professional work with DWG files, a paid tool such as DraftLine 2D is usually faster."], ["Do I need a perpetual or subscription licence?", "Subscriptions keep you on the latest version with lower up-front cost. Perpetual licences suit offices that upgrade rarely and want a one-time cost."], ["Can I draft in the browser?", "Yes. CloudDraft runs in any modern browser and adds mobile markups, which is handy for site teams."]],
  },
  {
    kind: "PROFESSION", name: "Architect",
    description: "Software architects in India use for drafting, BIM, visualisation and computational design.",
    faqs: [["Which BIM software do Indian architects use?", "Planora BIM is popular for its municipal submission templates and BOQ export; compare it with others on this page."], ["What do architects use for client walkthroughs?", "Real-time visualisation tools such as Planora Viz turn your model into walkthroughs and 360° panoramas."]],
  },
  { kind: "USE_CASE", name: "3D Modelling", description: "Parametric and direct 3D modelling software for product, mechanical and architectural design." },
  { kind: "USE_CASE", name: "Architectural BIM", description: "Building information modelling tools for architects, with drawing sets, quantities and collaboration." },
  { kind: "PROFESSION", name: "Mechanical Engineer", description: "3D CAD, simulation and CAM tools for mechanical engineers." },
];

/** Demo geo pages: [product or vendor slug, "software" | "vendor", location slugs]. */
export const CAD_GEO_PAGES: [string, "software" | "vendor", string[]][] = [
  ["draftline-2d", "software", ["gurugram", "bengaluru", "mumbai", "pune", "hyderabad", "chennai"]],
  ["planora-bim", "software", ["bengaluru", "gurugram"]],
  ["planora-technologies", "vendor", ["bengaluru", "gurugram", "mumbai"]],
  ["vectrix-systems", "vendor", ["pune"]],
];
