/**
 * “Page by page” view of the Editing guide: each website page split into its sections, numbered from the
 * top of the screen to the bottom, with every item in a section and where it is edited.
 * The header and footer are the same on every page. Homepage sections come from the homepage's blocks
 * in their saved order (see app/admin/guide/page.tsx); other pages are listed here.
 */
import { S, row, type GuideRow } from "@/lib/editing-guide";
import type { BlockType } from "@/lib/blocks/schemas";

export interface MapSection { title: string; summary?: string; rows: GuideRow[]; shared?: "header" | "footer"; edit?: { path: string[]; href: string } }
export interface PageMap { id: string; group: string; name: string; url: string; intro?: string; sections: MapSection[] }

/** Sections 1 and 2 of every page. */
export const HEADER_SECTIONS: MapSection[] = [
  {
    title: "Top bar: logo, search and phone", shared: "header", edit: S.settings("site"),
    summary: "The white row at the very top of every page.",
    rows: [
      row("Thin announcement strip above this row (only while one is running)", S.announcements, undefined, "Show or hide it in Website design"),
      row("Logo and site name", S.settings("site"), "Company & contact"),
      row("Search box placeholder (shown when the box is clicked)", S.settings("labels"), "Labels & messages"),
      row("Suggestions that type themselves out in the empty search box", S.settings("labels"), "Labels & messages", "“Search bar typing examples”, one per line; empty = off"),
      row("“Talk to a software expert” and the phone number", S.settings("site"), "Company & contact", "Phone number field; hidden when empty"),
      row("“List your software” link", S.texts("header"), undefined, "Opens /list-your-software"),
      row("Sign in / account button", "auto"),
    ],
  },
  {
    title: "Menu bar: Categories, menu links and Get free quote", shared: "header", edit: S.menus,
    summary: "The row of links under the top bar (desktop).",
    rows: [
      row("“Categories” drop-down", S.categories, undefined, "Turn on “Show in navigation” for each category; order by display order"),
      row("Links: Brands, Compare, Industries, Browse, Resources…", S.menus, undefined, "Choose the Header menu; “Browse” lists the classification pages"),
      row("“Get free quote” button text", S.settings("labels"), "Labels & messages", "Enquire button label"),
      row("The form that opens from it", S.forms("enquiry"), undefined, "Fields; title and button text in Settings › Labels & messages"),
      row("Header height (standard / compact)", S.design),
    ],
  },
];

/** The last sections of every page. */
export const FOOTER_SECTIONS: MapSection[] = [
  {
    title: "“Need expert guidance?” band", shared: "footer",
    summary: "The coloured strip just above the dark footer.",
    rows: [
      row("Heading, text and the four promises", S.texts("footer")),
      row("Phone number in it", S.settings("site"), "Company & contact"),
    ],
  },
  {
    title: "Footer: company details and link columns", shared: "footer", edit: S.menus,
    summary: "The dark area at the bottom of every page.",
    rows: [
      row("Logo, short description, address", S.settings("site"), "Company & contact"),
      row("Phone, email, sales email, WhatsApp", S.settings("site"), "Company & contact"),
      row("Social icons (LinkedIn, X, Facebook…)", S.settings("site"), "Company & contact", "Social links; an icon shows only when its link is filled in"),
      row("Columns: Software, Resources, Company", S.menus, undefined, "Menus footer.software, footer.resources, footer.company"),
    ],
  },
  {
    title: "Bottom line: copyright and Cookie settings", shared: "footer", edit: S.settings("site"),
    rows: [
      row("© year and company name", S.settings("site"), "Company & contact", "Legal company name (the year updates itself)"),
      row("Footer note next to it", S.design, undefined, "Footer note field"),
      row("“Cookie settings” link", S.texts("cookies"), undefined, "Reopens the cookie choices"),
    ],
  },
  {
    title: "Cookie banner (first visit, bottom left)", shared: "footer", edit: S.cookies,
    summary: "Floats over the page until the visitor chooses. Not part of the page itself.",
    rows: [
      row("Heading, text, button labels", S.texts("cookies")),
      row("Categories and cookie list in “Customise”", S.cookies, undefined, "Categories table"),
      row("Show the banner, how long a choice is remembered", S.cookies, undefined, "Banner section"),
    ],
  },
  {
    title: "Help chat (round button, bottom right)", shared: "footer", edit: S.settings("chat"),
    summary: "Floats over every page. Answers from the FAQs and the catalogue; no AI.",
    rows: [
      row("On or off, heading, welcome message, quick buttons", S.settings("chat"), "Help chat"),
      row("Answers", S.faqs, undefined, "Active FAQs"),
      row("Small wording", S.texts("chat")),
    ],
  },
];

const HOME = S.home;
const inBlock = (part: string, field: string) => row(part, HOME, undefined, field);

/** What each homepage block shows and where each part of it is edited. `d` is the block's saved data. */
export function blockSections(type: BlockType, label: string, d: Record<string, unknown>): MapSection[] {
  const one = (summary: string, rows: GuideRow[]): MapSection[] => [{ title: label, summary, rows, edit: HOME }];
  switch (type) {
    case "HERO": {
      const out: MapSection[] = [{
        title: `${label}: heading and search`, edit: HOME,
        summary: "The big headline with the search box under it.",
        rows: [
          inBlock("Big heading (“Discover, compare and buy…”)", "Heading field"),
          inBlock("Line of text under the heading", "Supporting text field"),
          row("Path labels around the heading (Discover, Compare, Shortlist, Buy)", S.texts("home"), undefined, "Large screens only; the moving dot is automatic"),
          row("Typing suggestions in the search box", S.settings("labels"), "Labels & messages", "“Search bar typing examples”"),
          inBlock("Search box placeholder", "Search placeholder field (empty = Settings › Labels & messages)"),
          inBlock("“Popular:” quick links under the search box", "Popular searches list"),
          inBlock("Background image", "Background image field"),
          row("Figures row (software products, categories, brands, reviews)", "auto", undefined, "Counted from your catalogue; switch off with “Show live stats” in this block"),
        ],
      }];
      if (d.showLogos !== false) out.push({
        title: "Top software brands", edit: HOME,
        summary: "The strip of brand logos (part of the Top banner with search block).",
        rows: [
          inBlock("Which brands show and their order", "“Brands in the logo strip” in the Top banner with search block (empty = brands with a logo)"),
          row("The logos themselves", S.brands, undefined, "Upload a logo on each brand"),
          row("“View all brands” page", S.brands),
          inBlock("Hide this strip", "Turn off “Show “Top software brands” logos”"),
        ],
      });
      return out;
    }
    case "BANNER_CAROUSEL": return one("Sliding promotional banners.", [
      row("Banner images, text and links", S.banners, undefined, "Banners with the placement this block uses"),
      inBlock("Which placement to show", "Banner placement field"),
    ]);
    case "FEATURED_SOFTWARE": return one("A row of software cards.", [
      inBlock("Heading, supporting text and “View all” link", "Heading / Supporting text / “View all” link fields"),
      inBlock("Which software shows (featured, popular, trending, a category, hand-picked)", "Products field (plus Category / Hand-picked products)"),
      row("Mark a product featured / popular / trending", S.products, "Promotion & related", "Open the product"),
      row("Card details: logo, name, rating, price", S.products, "Basics / Pricing"),
    ]);
    case "SOFTWARE_TABS": return one("Tabs, one per category, each showing top software.", [
      inBlock("Heading and the tabs (categories)", "Tabs list: tab label and category"),
      row("Software inside each tab", S.products, "Categories", "Set on each product"),
    ]);
    case "CATEGORY_GRID": return one("Category tiles.", [
      inBlock("Heading and which categories show", "Heading and Categories fields"),
      row("Category names and icons", S.categories),
    ]);
    case "INDUSTRY_GRID": return one("Industry tiles.", [
      inBlock("Heading and which industries show", "Heading and Industries fields"),
      row("Industry names and icons", S.industries),
    ]);
    case "RICH_TEXT": return one("Formatted text.", [inBlock("The text", "Content field")]);
    case "CTA": return one("A call-to-action strip.", [
      inBlock("Heading, text and buttons", "Heading, Text, Button label / link, Second button"),
      inBlock("Colour (Brand / Accent / Plain)", "Colour field"),
    ]);
    case "TESTIMONIALS": return one("Customer quotes.", [
      inBlock("Heading and how many", "Heading / How many fields"),
      row("The quotes, names, companies and order", S.testimonials),
    ]);
    case "FAQ": return one("Questions and answers.", [
      inBlock("Heading and which FAQ group shows", "FAQ group key field"),
      row("The questions and answers", S.faqs, undefined, "Open the group"),
    ]);
    case "LOGO_CLOUD": return one("Vendor logos.", [
      inBlock("Heading and which vendors show", "Heading and Vendors fields"),
      row("The logos", S.vendors, undefined, "Logo on each vendor"),
    ]);
    case "OFFERS": return one("Promotional cards.", [inBlock("Cards: badge, title, text, link", "Offers list: Badge, Title, Description, Link")]);
    case "DEALS": return one("Product offers that are live right now.", [
      inBlock("Heading and supporting text", "Heading / Supporting text fields"),
      row("The deals, discounts and end dates", S.offers),
    ]);
    case "BLOG_POSTS": return one("Latest blog posts as cards.", [
      inBlock("Small label, heading, post type and how many", "Block fields"),
      row("The posts: cover, title, summary, date", S.blog, undefined, "Newest published posts show first"),
    ]);
    case "STATS": return one("A row of figures.", [inBlock("Each figure and its label", "Figures list: Value and Label")]);
    case "COMPARISONS": return one("Head-to-head comparison cards.", [
      inBlock("Heading and how many", "Heading / How many fields"),
      row("The comparisons", S.comparisons),
    ]);
    case "LEAD_FORM": return one("An enquiry form on the page.", [
      inBlock("Heading and text", "Heading / Supporting text fields (empty = Settings › Labels & messages)"),
      row("The form's fields", S.forms("enquiry")),
      row("Consent text", S.settings("leads"), "Leads"),
      row("Enquiries received", S.leads()),
    ]);
    case "FLOW_DIAGRAM": return one("Cards joined by dashed lines to a centre card and a result card.", [inBlock("Heading, every card's text, icon and link", "Left cards list, Centre card text, Right card fields")]);
    case "HOW_IT_WORKS": return one("Numbered steps.", [inBlock("Heading and each step's title and text", "Steps list: Title, Text, Icon")]);
    // Free layout and any newer block: edited on the page itself (website edit mode).
    default: return one("A free design made of rows, columns and widgets.", [inBlock("Every row, column and widget", "Edit on the website › Free layout")]);
  }
}

const P = S.products;
const p = (part: string, tab: string, note?: string) => row(part, P, tab, note);

/** Pages with a fixed layout (the homepage is added at request time from its blocks). */
export const FIXED_PAGE_MAPS: PageMap[] = [
  {
    id: "product", group: "Catalogue", name: "Product page", url: "/software/<product>",
    intro: "Open the product in Products › All products. A section only shows when it has content; hide or reorder sections for every product in Pages › Page layouts.",
    sections: [
      { title: "Product summary", edit: P, summary: "Logo, name, price and the main buttons.", rows: [
        row("Breadcrumb (Home › category › product)", P, "Categories", "Comes from the product's main category"),
        p("Logo, name, tagline, vendor", "Basics"),
        row("“Verified” badge", S.vendors, undefined, "Verification panel on the vendor"),
        row("Star rating and number of reviews", S.reviews, undefined, "Counted from approved reviews"),
        p("Free trial / free version badges", "Pricing"),
        row("“Current offers” box", S.offers),
        p("Starting price, price unit, GST note", "Pricing"),
        row("“Get free quote” / “Book a demo” / “Compare” button text", S.settings("labels"), "Labels & messages"),
      ] },
      { title: "Trust strip", rows: [row("The four short promises", S.texts("product"))] },
      { title: "Section tabs", summary: "Sticky links to the sections below.", rows: [row("Tabs", "auto", undefined, "One tab per section that has content")] },
      { title: "What is …? (overview)", edit: P, rows: [p("Description text", "Description")] },
      { title: "Pricing", edit: P, rows: [p("Plans, prices, what each plan includes", "Pricing")] },
      { title: "Gallery", edit: P, rows: [p("Screenshots and videos", "Screenshots & media")] },
      { title: "Features", edit: P, rows: [p("Feature list", "Features")] },
      { title: "Product specifications", edit: P, rows: [
        p("Specification values", "Specifications"),
        p("Use cases, platforms, deployment… rows", "Classifications"),
      ] },
      { title: "Review", edit: P, rows: [
        p("Editorial pros and cons, verdict", "Promotion & related"),
        row("Buyer reviews (approve / reject)", S.reviews),
        row("“Write a review” form wording", S.texts("review")),
      ] },
      { title: "Who should choose this product?", edit: P, rows: [p("Best for / Not ideal for", "Promotion & related")] },
      { title: "Company details", edit: S.vendors, rows: [row("Vendor name, logo, about, location", S.vendors, undefined, "Open the vendor")] },
      { title: "Authorised resellers", edit: S.resellers, rows: [row("Resellers listed", S.resellers, undefined, "Open a reseller › Authorised products")] },
      { title: "Compare with other software", rows: [row("Products suggested", P, "Promotion & related", "Alternatives field; otherwise same category")] },
      { title: "FAQs", edit: P, rows: [p("Questions and answers", "FAQs")] },
      { title: "Questions (community)", edit: S.questions, rows: [row("Buyer questions and answers", S.questions), row("“Ask a question” box wording", S.texts("question"))] },
      { title: "Alternatives", edit: P, rows: [p("Alternative products", "Promotion & related")] },
      { title: "Related articles", edit: S.blog, rows: [row("Blog cards", S.blog, undefined, "Picked automatically from published posts")] },
      { title: "Get expert guidance on …", rows: [
        row("Form title and subtitle", S.settings("labels"), "Labels & messages", "Lead form title / subtitle"),
        row("The form's fields", S.forms("enquiry")),
        row("Enquiries received", S.leads()),
      ] },
      { title: "A clearer way to evaluate software", rows: [row("Heading and points", S.texts("product"))] },
    ],
  },
  {
    id: "brands", group: "Catalogue", name: "All brands", url: "/brands",
    intro: "Brands are edited in Companies › Brands. Only active brands are listed.",
    sections: [
      { title: "Page heading and brand search", summary: "The coloured band at the top.", rows: [
        row("Breadcrumb (Home › Brands)", "auto"),
        row("“Publishers and vendors”, “Software brands” heading and the line under it", S.texts("brands"), undefined, "The number of brands in it is counted automatically"),
        row("Brand search box", "auto", undefined, "Searches brand names"),
      ] },
      { title: "Brand cards", edit: S.brands, summary: "16 cards per page, with page numbers underneath.", rows: [
        row("Order of the cards", S.brands, undefined, "“Display order” field; then brands with more products first"),
        row("Logo and name", S.brands, undefined, "Open the brand; no logo shows the first letter instead"),
        row("“N products” badge (“Coming soon” when none)", "auto", undefined, "Counts published products whose Brand field is this brand"),
        row("Short line “… brand profile and related software products”", S.texts("brands")),
        row("The three product names on each card", S.products, "Basics", "Its 3 most enquired-about published products (Brand field)"),
        row("Show or hide a brand", S.brands, undefined, "“Visible on the website” switch on the brand"),
      ] },
      { title: "Page title and description in Google", rows: [row("Title “Software brands” and its description", S.texts("brands"))] },
    ],
  },
  {
    id: "brand", group: "Catalogue", name: "Brand page", url: "/brands/<brand>",
    intro: "Opened by clicking a brand card. Edit it in Companies › Brands (click the brand). Hide parts of every brand page in Pages › Page layouts.",
    sections: [
      { title: "Brand header", edit: S.brands, summary: "Logo, name and description at the top.", rows: [
        row("Breadcrumb (Home › Brands › brand)", "auto"),
        row("Logo, name (shown as “<name> software”)", S.brands),
        row("Number of products", "auto"),
        row("“By <vendor>” link", S.brands, undefined, "“Owned by vendor” field"),
        row("Website link", S.brands, undefined, "“Website” field"),
        row("Description text", S.brands, undefined, "“About the brand” field"),
        row("“Get free quote” button text", S.settings("labels"), "Labels & messages"),
        row("Small label above the name, figure captions (products, reviews, rating)", S.texts("brand"), undefined, "The figures and the orbiting product logos are automatic"),
      ] },
      { title: "<brand> products", edit: S.products, summary: "The product list with filters and sorting.", rows: [
        row("Products listed", S.products, "Basics", "Every published product whose Brand field is this brand"),
        row("Card details: logo, name, rating, price", S.products, "Basics / Pricing"),
        row("Products per page, default sort, filters", S.settings("listing"), "Listing pages"),
      ] },
      { title: "Title and description in Google", edit: S.brands, rows: [row("Search title and description", S.brands, undefined, "SEO fields on the brand; empty = made from the name and “About the brand”")] },
    ],
  },
  // ─── Catalogue ─────────────────────────────────────────────────────────────
  {
    id: "categories", group: "Catalogue", name: "All categories", url: "/categories",
    intro: "Categories are edited in Organise › Categories.",
    sections: [
      { title: "Heading", rows: [row("Breadcrumb and “All software categories” heading", S.texts("categories"))] },
      { title: "Category list", edit: S.categories, summary: "Each main category with its sub-categories under it.", rows: [
        row("Main categories, their icons and order", S.categories, "General", "Parent category empty = main category"),
        row("Sub-categories under each one", S.categories, "General", "Parent category field"),
        row("Number in brackets", "auto", undefined, "Published products in that category"),
        row("Hide a category", S.categories, "General", "“Visible on the website” switch"),
      ] },
    ],
  },
  {
    id: "category", group: "Catalogue", name: "Category page", url: "/categories/<category>",
    intro: "Open the category in Organise › Categories. Its tabs: General, Page layout, Filters, SEO. Hide or reorder sections for every category in Pages › Page layouts.",
    sections: [
      { title: "Category hero", edit: S.categories, summary: "Heading, description and the highlighted product.", rows: [
        row("Breadcrumb", "auto", undefined, "Follows the parent categories"),
        row("“Best … software” heading", S.categories, "General", "Made from the Name (Short name in tight spaces)"),
        row("Text under the heading", S.categories, "General", "Description field"),
        row("Banner image", S.categories, "General", "Banner field (wide 5:1 image)"),
        row("Highlighted product card on the right", S.categories, "Page layout", "First product in “Editor’s picks”; empty = most enquired-about"),
      ] },
      { title: "Section tabs", rows: [row("Products · Guide · Price comparison · Articles · FAQs", "auto", undefined, "A tab shows only when its section has content")] },
      { title: "Popular products", edit: S.categories, rows: [
        row("The four product cards", "auto", undefined, "Most enquired-about products in this category"),
        row("Show or hide", S.categories, "Page layout", "“Show editor’s picks” switch"),
      ] },
      { title: "Product directory", edit: S.categories, summary: "All products in the category with search, filters and pages.", rows: [
        row("Products listed", S.products, "Categories", "Set on each product"),
        row("Filter drop-downs (Platform, Deployment, Licence, Pricing)", "auto", undefined, "Built from the products’ Classifications and Pricing"),
        row("Extra filters", S.categories, "Filters", "Create them in Organise › Attributes & filters"),
        row("Rows or grid, default sort", S.categories, "Page layout", "Product layout and Default sort fields"),
        row("Advertisement between products", S.banners, undefined, "Page layout › Banner placement (empty = category.<slug>)"),
        row("“Book a demo” button text", S.settings("labels"), "Labels & messages"),
        row("Products per page", S.settings("listing"), "Listing pages"),
      ] },
      { title: "Sidebar: “Find a better product fit” and Product Categories", rows: [
        row("“Get free quote” button text", S.settings("labels"), "Labels & messages"),
        row("Category links", S.categories, "General", "Sub-categories, or sibling categories when there are none; switch off with “Show subcategory links”"),
      ] },
      { title: "“Find software that fits your real requirements” banner", rows: [row("Heading and text", S.texts("category")), row("Button text", S.settings("labels"), "Labels & messages")] },
      { title: "Guide to select the best …", edit: S.categories, rows: [
        row("Guide text", S.categories, "Page layout", "Long-form content field"),
        row("Image beside it", S.categories, "General", "Image field"),
      ] },
      { title: "“Not sure which … to pick?” strip", rows: [row("Heading and text", S.texts("category")), row("Button text", S.settings("labels"), "Labels & messages")] },
      { title: "Price comparison", rows: [row("Price table", "auto", undefined, "From each product’s Pricing tab (plans and starting price)")] },
      { title: "Relevant articles", edit: S.blog, rows: [
        row("Blog cards", S.blog, undefined, "Posts whose “Software mentioned” includes this category’s top products"),
        row("Show or hide", S.categories, "Page layout", "“Show buying guides” switch"),
      ] },
      { title: "FAQs", rows: [row("Questions and answers", "auto", undefined, "Written automatically from live prices, trials and top products")] },
      { title: "Related software selections", rows: [row("Category links", "auto", undefined, "Sub-categories or sibling categories")] },
      { title: "Title and description in Google", edit: S.categories, rows: [row("Search title and description", S.categories, "SEO")] },
    ],
  },
  {
    id: "industries", group: "Catalogue", name: "All industries", url: "/industries",
    sections: [
      { title: "Heading and search", rows: [row("Breadcrumb and “Software by industry” heading", S.texts("industries")), row("“Search industries…” box", "auto")] },
      { title: "Industry tiles", edit: S.industries, rows: [
        row("Icon, name, short description", S.industries, undefined, "Icon, Name and Short description fields"),
        row("Show or hide an industry", S.industries, undefined, "“Visible on the website” switch"),
      ] },
    ],
  },
  {
    id: "industry", group: "Catalogue", name: "Industry page", url: "/industries/<industry>",
    sections: [
      { title: "Heading", edit: S.industries, rows: [
        row("“Software for …” heading", S.industries, undefined, "Name field"),
        row("Text under it", S.industries, undefined, "Short description field"),
      ] },
      { title: "Products with filters", rows: [
        row("Products listed", S.products, "Categories", "Industries field on each product"),
        row("Filters, sort, products per page", S.settings("listing"), "Listing pages"),
      ] },
      { title: "Page content", edit: S.industries, rows: [row("Text below the products", S.industries, undefined, "Page content field")] },
      { title: "Title and description in Google", edit: S.industries, rows: [row("Search title and description", S.industries, undefined, "SEO fields on the industry; empty = Name and Short description")] },
    ],
  },
  {
    id: "vendors", group: "Catalogue", name: "All vendors", url: "/vendors",
    sections: [
      { title: "Heading and search", rows: [row("Breadcrumb and “Software vendors” heading", S.texts("vendors")), row("“Search vendors…” box and A–Z letters", "auto")] },
      { title: "Partner network picture", rows: [
        row("Centre label, caption and legend (vendors / resellers)", S.texts("vendors")),
        row("Logos around it", S.vendors, undefined, "Vendor and reseller logos, picked automatically"),
      ] },
      { title: "Vendors A–Z", edit: S.vendors, rows: [
        row("Vendor names", S.vendors, undefined, "Only active vendors with at least one published product"),
        row("Number in brackets", "auto", undefined, "Their published products"),
      ] },
    ],
  },
  {
    id: "vendor", group: "Catalogue", name: "Vendor page", url: "/vendors/<vendor>",
    sections: [
      { title: "Vendor header", edit: S.vendors, rows: [
        row("Logo, name, city and country, founded, employees, website", S.vendors, undefined, "Open the vendor"),
        row("Verified tick", S.vendors, undefined, "Verification panel on the vendor"),
        row("Description text", S.vendors, undefined, "Description field"),
      ] },
      { title: "Products by …", rows: [
        row("Products listed", S.products, "Basics", "Vendor field on each product"),
        row("Sort, products per page", S.settings("listing"), "Listing pages"),
      ] },
      { title: "Title and description in Google", edit: S.vendors, rows: [row("Search title and description", S.vendors, undefined, "SEO fields on the vendor")] },
    ],
  },
  {
    id: "reseller", group: "Catalogue", name: "Reseller profile", url: "/resellers/<reseller>",
    sections: [
      { title: "Reseller header", edit: S.resellers, rows: [
        row("Logo, name, city and state, founded, website", S.resellers, undefined, "Open the reseller"),
        row("Verified tick", S.resellers, undefined, "Verification on the reseller"),
        row("“Get a quote” button", S.texts("resellerPage"), undefined, "Enquiries go to the reseller and the product’s vendor"),
      ] },
      { title: "“Serves:” cities", edit: S.resellers, rows: [row("City chips", S.resellers, undefined, "Cities served field")] },
      { title: "About", edit: S.resellers, rows: [row("Description text", S.resellers, undefined, "Description field")] },
      { title: "Software … is authorised to sell", edit: S.resellers, rows: [
        row("Product cards", S.resellers, undefined, "Authorised products panel"),
        row("Partner level badge (Gold, Silver…)", S.resellers, undefined, "Set per product in Authorised products"),
      ] },
      { title: "Title and description in Google", edit: S.resellers, rows: [row("Search title and description", S.resellers, undefined, "SEO fields on the reseller")] },
    ],
  },
  {
    id: "classification-list", group: "Catalogue", name: "Classification lists", url: "/use-case, /profession, /feature, /platform, /deployment, /licensing, /budget, /customer-type, /operating-system",
    intro: "Each list is edited in Classifications › <list name>, for example Classifications › Use cases. Rename a list, change its headings or switch it off in Website settings › Classification lists.",
    sections: [
      { title: "Heading", rows: [row("List heading and text", S.texts("termIndex"))] },
      { title: "Terms", edit: S.classifications, rows: [
        row("Term names and order", S.classifications, undefined, "Name and Order fields"),
        row("Number of products", "auto", undefined, "Products tagged with the term"),
        row("Hide a term", S.classifications, undefined, "“Visible on the website” switch"),
      ] },
    ],
  },
  {
    id: "classification", group: "Catalogue", name: "Classification page", url: "/use-case/<term> (and the other lists)",
    intro: "Click Edit on a term in Classifications › <list name>.",
    sections: [
      { title: "Top banner", edit: S.classifications, rows: [
        row("Breadcrumb", "auto"),
        row("Heading", S.classifications, undefined, "Page heading field (empty = made from the name)"),
        row("Text under it", S.classifications, undefined, "Description field"),
        row("Promoted product card and its badge", S.classifications, undefined, "Promoted product and Promoted badge fields; empty = an advice box"),
        row("“Get free quote” button text", S.settings("labels"), "Labels & messages"),
      ] },
      { title: "Popular choices", rows: [row("Product cards", "auto", undefined, "Most enquired-about products with this term")] },
      { title: "Products for …", rows: [row("Products listed", S.products, "Classifications", "Set on each product")] },
      { title: "“Find a better product fit” box", rows: [row("Text", S.texts("term")), row("Button text", S.settings("labels"), "Labels & messages")] },
      { title: "Price comparison", rows: [row("Price table", "auto", undefined, "From the products’ Pricing tab")] },
      { title: "Page content", edit: S.classifications, rows: [row("Text", S.classifications, undefined, "Page content field")] },
      { title: "Relevant articles", rows: [row("Blog cards", S.blog, undefined, "Picked automatically from published posts")] },
      { title: "Buyer FAQs", edit: S.classifications, rows: [row("Questions and answers", S.classifications, undefined, "FAQs on the term")] },
      { title: "Explore related (chip rows)", rows: [row("Heading", S.texts("term")), row("The chips", "auto", undefined, "Related terms from the same products")] },
      { title: "Budget pages: price ladder", rows: [row("Heading and budget line label", S.texts("term")), row("Bars", "auto", undefined, "From the products’ starting prices")] },
      { title: "Continue exploring", rows: [row("Links to related terms", "auto")] },
      { title: "Title and description in Google", edit: S.classifications, rows: [row("Search title and description, hide from Google", S.classifications, undefined, "SEO title, SEO description, Hide from search engines")] },
    ],
  },
  {
    id: "search", group: "Catalogue", name: "Search results", url: "/search",
    sections: [
      { title: "Heading and search box", rows: [row("“Results for …” heading", "auto"), row("Search box placeholder", S.settings("labels"), "Labels & messages")] },
      { title: "“Compare on:” chips", rows: [row("Category and classification links", "auto", undefined, "Pages whose name matches the search")] },
      { title: "Results with filters", rows: [
        row("Matching products", "auto", undefined, "Searches names, taglines and descriptions; sponsored products can be shown first"),
        row("Filters, sort, products per page", S.settings("listing"), "Listing pages"),
      ] },
    ],
  },
  // ─── Compare ───────────────────────────────────────────────────────────────
  {
    id: "compare", group: "Compare", name: "Compare tool", url: "/compare",
    sections: [
      { title: "Top banner", rows: [row("Breadcrumb, “Compare software side by side” heading and text", S.texts("compare"), undefined, "Becomes “A vs B” when products are chosen")] },
      { title: "Start your comparison", rows: [
        row("Comparison table", "auto", undefined, "Built from each product’s pricing, specifications and features"),
        row("Button and label texts", S.settings("labels"), "Labels & messages"),
      ] },
      { title: "Trending product comparisons", rows: [row("Comparison cards", "auto", undefined, "The most enquired-about products, paired within their category")] },
      { title: "Popular comparisons by category", rows: [row("Category groups", "auto", undefined, "Top products of the busiest categories")] },
      { title: "Popular comparisons", edit: S.comparisons, rows: [row("Hand-made comparisons", S.comparisons, undefined, "Published comparisons, newest first")] },
      { title: "How to compare software confidently", rows: [row("Heading, one-line text and the three steps (title and tags)", S.texts("compare"), undefined, "Tags: separate them with |")] },
      { title: "Software comparison FAQs", rows: [row("Questions and answers", S.texts("compare"))] },
    ],
  },
  {
    id: "comparison", group: "Compare", name: "Comparison page", url: "/compare/<a-vs-b>",
    intro: "Open the comparison in Products › Comparisons.",
    sections: [
      { title: "Heading and introduction", edit: S.comparisons, rows: [row("Heading", S.comparisons, undefined, "Title field"), row("Introduction text", S.comparisons, undefined, "Introduction field")] },
      { title: "Comparison table", rows: [
        row("Products compared and their order", S.comparisons, undefined, "Products (2–4, in order)"),
        row("Values in the table", S.products, undefined, "From each product’s pricing, specifications and features"),
      ] },
      { title: "Our verdict", edit: S.comparisons, rows: [row("Verdict text", S.comparisons, undefined, "Verdict field")] },
      { title: "Title and description in Google", edit: S.comparisons, rows: [row("Search title and description", S.comparisons, undefined, "SEO fields; empty = Title and Introduction")] },
    ],
  },
  // ─── Blog ──────────────────────────────────────────────────────────────────
  {
    id: "blog", group: "Blog", name: "Blog home", url: "/blog",
    sections: [
      { title: "Top banner", rows: [
        row("“Blog” heading, small line and text", S.texts("blog")),
        row("Search articles box", "auto"),
        row("Topic chips (Guides, News…, then your blog categories)", S.blogCategories, undefined, "Types come from each post’s Type"),
      ] },
      { title: "What matters now", edit: S.blog, rows: [
        row("Lead story and four more", S.blog, undefined, "Posts marked “Featured post” first, then the newest"),
        row("Cover, title, summary, date, reading time", S.blog, undefined, "Cover image, Title, Summary fields; reading time is automatic"),
      ] },
      { title: "Latest articles", edit: S.blog, rows: [row("Post cards, 8 per page", S.blog, undefined, "Newest published posts not already shown above")] },
      { title: "Specialist coverage", edit: S.blog, rows: [
        row("Topic name and text", S.blogCategories, undefined, "Name and Description"),
        row("Three posts per topic", S.blog, undefined, "Category field on each post"),
      ] },
    ],
  },
  {
    id: "post", group: "Blog", name: "Blog post", url: "/blog/<post>",
    intro: "Open the post in Blog › Posts. Hide or reorder the cover, tags, author box and sidebar cards for every article in Pages › Page layouts.",
    sections: [
      { title: "Post hero", edit: S.blog, rows: [
        row("Breadcrumb, category and type", S.blog, undefined, "Category and Type fields"),
        row("Title and summary", S.blog, undefined, "Title and Summary fields"),
        row("Author name, photo, job title", S.blog, undefined, "Author field on the post; edit the author in Blog › Authors"),
        row("Date and reading time", "auto", undefined, "Publish date; reading time is counted"),
      ] },
      { title: "Article", edit: S.blog, rows: [
        row("Cover image", S.blog, undefined, "Cover image field"),
        row("Article text", S.blog, undefined, "Content field; Heading 2s become the “On this page” list"),
        row("Tags", S.blog, undefined, "Tags field"),
        row("About the author box", S.blogAuthors, undefined, "Bio and Photo"),
      ] },
      { title: "Software mentioned", edit: S.blog, rows: [row("Product cards", S.blog, undefined, "Software mentioned field")] },
      { title: "Sidebar", rows: [
        row("On this page", "auto", undefined, "From the article’s Heading 2s"),
        row("More in <category>", "auto", undefined, "Other posts in the same category"),
      ] },
      { title: "You might also like", rows: [row("Post cards", "auto", undefined, "The newest other posts")] },
      { title: "Title and description in Google", edit: S.blog, rows: [row("Search title and description", S.blog, "SEO", "In the post editor")] },
    ],
  },
  {
    id: "author", group: "Blog", name: "Author page", url: "/blog/author/<author>",
    sections: [
      { title: "Author details", edit: S.blogAuthors, rows: [row("Name, job title, bio", S.blogAuthors, undefined, "Name, Job title, Bio")] },
      { title: "Articles", rows: [row("List of their posts", "auto", undefined, "Published posts with this Author")] },
    ],
  },
  // ─── Content pages ─────────────────────────────────────────────────────────
  {
    id: "about", group: "Content pages", name: "About us and other pages", url: "/about (and any page you create)",
    intro: "Open the page in Pages › Pages & homepage. Pages with the Default template look like this.",
    sections: [
      { title: "Page header", edit: S.pages, summary: "Coloured band with breadcrumb and title.", rows: [
        row("Title", S.pages, undefined, "Title field"),
        row("Line under the title", S.pages, undefined, "SEO description field"),
      ] },
      { title: "Page blocks (one section per block)", edit: S.pages, rows: [
        row("Text, call to action, stats, FAQ… blocks", S.pages, undefined, "Add, reorder or switch off blocks, same as the homepage"),
        row("Blocks shared by several pages", S.blocks),
      ] },
    ],
  },
  {
    id: "contact", group: "Content pages", name: "Contact us", url: "/contact",
    sections: [
      { title: "Title", edit: S.pages, rows: [row("Page title", S.pages, undefined, "Open the Contact page")] },
      { title: "Contact details", edit: S.settings("site"), rows: [
        row("Phone, WhatsApp, email, sales email, address, hours", S.settings("site"), "Company & contact"),
      ] },
      { title: "Message form", rows: [
        row("The form's fields", S.forms("enquiry")),
        row("Consent text", S.settings("leads"), "Leads"),
        row("Messages received", S.leads("?source=CONTACT_PAGE&status=ALL")),
      ] },
      { title: "Extra blocks below (optional)", edit: S.pages, rows: [row("Any blocks added to the Contact page", S.pages)] },
    ],
  },
  {
    id: "legal", group: "Legal and privacy", name: "Privacy policy, Terms and other legal pages", url: "/privacy-policy, /terms, /cookie-policy, /disclaimer…",
    intro: "Write them in Compliance & Privacy › Legal documents. Until a version is published there, the old Website page at the same address (Legal template) still shows.",
    sections: [
      { title: "Page header", edit: S.legalDocs, rows: [
        row("Title", S.legalDocs, undefined, "Title on the version"),
        row("“Version … · in force from …” line", "auto", undefined, "From the version and its publish date; wording in Website texts › Legal documents"),
        row("Notice of an upcoming update / older version", S.texts("legal"), undefined, "Shown automatically when it applies"),
      ] },
      { title: "Sidebar: On this page, versions and contact box", rows: [
        row("Numbered section links", "auto", undefined, "From the Heading 2s in the text"),
        row("List of earlier versions", "auto"),
        row("Contact email", S.complianceSettings, undefined, "Privacy contact email (else Company & contact)"),
      ] },
      { title: "Document text", edit: S.legalDocs, rows: [row("The text", S.legalDocs, undefined, "Open the document › New version; use Heading 2 for each part")] },
    ],
  },
  {
    id: "privacy-center", group: "Legal and privacy", name: "Privacy center", url: "/privacy-center",
    intro: "Where people ask for their data, raise a complaint or report content. Link it in your footer menu.",
    sections: [
      { title: "Heading", rows: [row("Heading and text", S.texts("privacyCenter"))] },
      { title: "Form: Data request / Complaint / Report content", rows: [
        row("Labels, hints and messages", S.texts("privacyCenter")),
        row("What's received", S.requests, undefined, "Also Grievances and Content complaints"),
        row("Emails sent to the person", S.email, undefined, "Privacy request templates"),
      ] },
      { title: "Sidebar: rights and grievance officer", rows: [
        row("Rights list", S.texts("privacyCenter")),
        row("Grievance officer name, email, phone, address, hours", S.complianceSettings),
      ] },
    ],
  },
  {
    id: "auth", group: "Partners and accounts", name: "Sign in and sign up", url: "/login, /signup",
    sections: [
      { title: "Left panel", rows: [
        row("Small label, heading, points", S.texts("auth")),
        row("Figures", "auto", undefined, "Counted from your catalogue"),
        row("Background drawings and animations", "auto"),
      ] },
      { title: "Form", rows: [
        row("Optional consent ticks (sign-up)", S.consent, undefined, "Purposes marked “signup”"),
        row("Terms and privacy policy links", S.legalDocs, undefined, "Accepting records the versions in force"),
        row("Password rules and “All rules” pop-up", "code", undefined, "Fixed for security"),
        row("Emails (confirm, reset, welcome)", S.email, undefined, "Templates"),
      ] },
    ],
  },
  // ─── Partners ──────────────────────────────────────────────────────────────
  {
    id: "list-software", group: "Partners and accounts", name: "List your software", url: "/list-your-software",
    sections: [
      { title: "Top banner and benefits", rows: [row("Heading, text and the benefit points", S.texts("listSoftware"), undefined, "The site name in the heading comes from Company & contact")] },
      { title: "How it works (roadmap)", rows: [row("Step labels, titles and texts", S.texts("listSoftware"), undefined, "The cards move as the visitor scrolls")] },
      { title: "Apply to list your software (form)", edit: S.forms("listSoftware"), rows: [
        row("Fields, button and thank-you message", S.forms("listSoftware")),
        row("Consent text", S.settings("leads"), "Leads"),
        row("Applications received", S.leads("?source=LIST_SOFTWARE&status=ALL")),
        row("Confirmation email", S.email, undefined, "Templates › Listing request received"),
      ] },
    ],
  },
  {
    id: "become-reseller", group: "Partners and accounts", name: "Become a reseller", url: "/become-a-reseller",
    sections: [
      { title: "Top banner and benefits", rows: [row("Heading, text and the benefit points", S.texts("becomeReseller"))] },
      { title: "How it works (roadmap)", rows: [row("Step labels, titles and texts", S.texts("becomeReseller"), undefined, "The cards move as the visitor scrolls")] },
      { title: "Apply to become a reseller (form)", edit: S.forms("becomeReseller"), rows: [
        row("Fields, button and thank-you message", S.forms("becomeReseller")),
        row("Consent text", S.settings("leads"), "Leads"),
        row("Applications received", S.leads("?source=BECOME_RESELLER&status=ALL")),
        row("Confirmation email", S.email, undefined, "Templates › Reseller application received"),
      ] },
    ],
  },
  // ─── Local ─────────────────────────────────────────────────────────────────
  {
    id: "geo-brand", group: "Local (geo) pages", name: "Brand in a city", url: "/<city>/<brand>",
    intro: "Open the page in City pages › Geo pages. Empty fields use the template in City pages › Geo settings.",
    sections: [
      { title: "Top banner", edit: S.geoPages, rows: [
        row("Logo and heading", S.brands, undefined, "Brand logo; the heading is made from brand and city"),
        row("Top banner text", S.geoPages, undefined, "Top banner field"),
        row("“Talk to a … expert” box", S.texts("geo")),
      ] },
      { title: "Introduction", edit: S.geoPages, rows: [row("Text", S.geoPages, undefined, "Introduction field")] },
      { title: "… products available in <city>", rows: [row("Product tiles", "auto", undefined, "The brand’s published products")] },
      { title: "Buying … in <city>", edit: S.geoPages, rows: [row("Text", S.geoPages, undefined, "Buying guide field")] },
      { title: "Serving <area> (with map pins)", edit: S.geoLocations, rows: [row("PIN codes and business zones", S.geoLocations, undefined, "PIN codes and Business zones fields"), row("Map pins", "auto", undefined, "From the zones (or other cities); map caption in Website texts › City pages")] },
      { title: "Frequently asked questions", edit: S.geoPages, rows: [row("Questions and answers", S.geoPages, undefined, "FAQs on the geo page; empty = the template in Geo settings")] },
      { title: "… in other cities", rows: [row("City links", "auto", undefined, "Other published geo pages for this brand")] },
      { title: "Sidebar: pricing form", rows: [row("Form texts", S.settings("labels"), "Labels & messages"), row("Fields", S.forms("enquiry")), row("Enquiries", S.leads())] },
      { title: "Title and description in Google", edit: S.geoPages, rows: [row("SEO title and description", S.geoPages, undefined, "SEO section")] },
    ],
  },
  {
    id: "geo-product", group: "Local (geo) pages", name: "Product in a city", url: "/<city>/software/<product>",
    intro: "Open the page in City pages › Geo pages. Empty fields use the template in City pages › Geo settings.",
    sections: [
      { title: "Top banner", edit: S.geoPages, rows: [
        row("Logo, heading, buttons", S.products, "Basics", "Heading is made from product and city"),
        row("Top banner text", S.geoPages, undefined, "Top banner field"),
      ] },
      { title: "Introduction", edit: S.geoPages, rows: [row("Text", S.geoPages, undefined, "Introduction field")] },
      { title: "Key features of …", rows: [row("Feature list", S.products, "Features")] },
      { title: "… price in <city>", rows: [row("Plans and prices", S.products, "Pricing")] },
      { title: "Buying … in <city>", edit: S.geoPages, rows: [row("Text", S.geoPages, undefined, "Buying guide field")] },
      { title: "Serving <area>", edit: S.geoLocations, rows: [row("PIN codes and business zones", S.geoLocations)] },
      { title: "Frequently asked questions", edit: S.geoPages, rows: [row("Questions and answers", S.geoPages, undefined, "FAQs on the geo page; empty = the template in Geo settings")] },
      { title: "More software in <area>", rows: [row("Links", "auto", undefined, "Other published geo pages in this area")] },
      { title: "Title and description in Google", edit: S.geoPages, rows: [row("SEO title and description", S.geoPages, undefined, "SEO section")] },
    ],
  },
];
