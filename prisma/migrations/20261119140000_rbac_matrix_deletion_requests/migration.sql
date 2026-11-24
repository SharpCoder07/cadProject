-- Role-based access control: View / Create / Edit / Delete for every module, deletion requests that
-- only the Super Admin approves, and no Delete for any role except the Super Admin unless granted.

-- 1. New permissions (descriptions are refreshed for every permission).
INSERT INTO "Permission" ("id", "key", "group", "description") VALUES
  ('perm_dashboard_view', 'dashboard.view', 'dashboard', 'View dashboard'),
  ('perm_analytics_view', 'analytics.view', 'analytics', 'View reports and analytics'),
  ('perm_software_view', 'software.view', 'software', 'View software listings in admin'),
  ('perm_software_create', 'software.create', 'software', 'Create software listings'),
  ('perm_software_edit', 'software.edit', 'software', 'Edit software listings'),
  ('perm_software_publish', 'software.publish', 'software', 'Publish, unpublish, schedule and archive listings'),
  ('perm_software_delete', 'software.delete', 'software', 'Delete software listings, and remove features, plans, FAQs and media from a listing'),
  ('perm_categories_view', 'categories.view', 'categories', 'View categories'),
  ('perm_categories_create', 'categories.create', 'categories', 'Create categories'),
  ('perm_categories_manage', 'categories.manage', 'categories', 'Edit categories and their hierarchy'),
  ('perm_categories_delete', 'categories.delete', 'categories', 'Delete categories'),
  ('perm_taxonomy_view', 'taxonomy.view', 'taxonomy', 'View industries, tags and attributes'),
  ('perm_taxonomy_create', 'taxonomy.create', 'taxonomy', 'Create industries, tags and attributes'),
  ('perm_taxonomy_manage', 'taxonomy.manage', 'taxonomy', 'Edit industries, tags and attributes'),
  ('perm_taxonomy_delete', 'taxonomy.delete', 'taxonomy', 'Delete industries, tags, attributes and attribute options'),
  ('perm_vendors_view', 'vendors.view', 'vendors', 'View vendors, brands and resellers'),
  ('perm_vendors_create', 'vendors.create', 'vendors', 'Create vendors and brands'),
  ('perm_vendors_manage', 'vendors.manage', 'vendors', 'Edit vendors, brands and resellers'' authorised products'),
  ('perm_vendors_delete', 'vendors.delete', 'vendors', 'Delete vendors and brands, and remove authorised products'),
  ('perm_vendors_verify', 'vendors.verify', 'vendors', 'Verify vendors and grant publishing rights'),
  ('perm_reviews_view', 'reviews.view', 'reviews', 'View reviews and questions'),
  ('perm_reviews_moderate', 'reviews.moderate', 'reviews', 'Approve, reject and answer reviews and questions'),
  ('perm_reviews_delete', 'reviews.delete', 'reviews', 'Delete reviews and questions'),
  ('perm_comparisons_view', 'comparisons.view', 'comparisons', 'View curated comparisons'),
  ('perm_comparisons_create', 'comparisons.create', 'comparisons', 'Create curated comparisons'),
  ('perm_comparisons_manage', 'comparisons.manage', 'comparisons', 'Edit curated comparisons and the comparison showcase'),
  ('perm_comparisons_delete', 'comparisons.delete', 'comparisons', 'Delete comparisons and remove items from them'),
  ('perm_offers_view', 'offers.view', 'offers', 'View offers'),
  ('perm_offers_manage', 'offers.manage', 'offers', 'Create, schedule, edit and end offers on products'),
  ('perm_offers_delete', 'offers.delete', 'offers', 'Delete offers'),
  ('perm_cms_pages_view', 'cms.pages.view', 'cms', 'View pages and homepage sections'),
  ('perm_cms_pages_create', 'cms.pages.create', 'cms', 'Create pages, and add sections and page templates'),
  ('perm_cms_pages', 'cms.pages', 'cms', 'Edit pages and homepage sections'),
  ('perm_cms_pages_delete', 'cms.pages.delete', 'cms', 'Delete pages, and remove sections, widgets, buttons and list items from a page'),
  ('perm_cms_navigation_view', 'cms.navigation.view', 'cms', 'View menus, banners and announcements'),
  ('perm_cms_navigation_create', 'cms.navigation.create', 'cms', 'Create banners and announcements'),
  ('perm_cms_navigation', 'cms.navigation', 'cms', 'Edit menus, banners and announcements'),
  ('perm_cms_navigation_delete', 'cms.navigation.delete', 'cms', 'Delete banners and announcements, and remove menu items'),
  ('perm_cms_blocks_view', 'cms.blocks.view', 'cms', 'View reusable blocks, testimonials and FAQs'),
  ('perm_cms_blocks_create', 'cms.blocks.create', 'cms', 'Create reusable blocks, testimonials and FAQ groups'),
  ('perm_cms_blocks', 'cms.blocks', 'cms', 'Edit reusable blocks, testimonials and FAQs'),
  ('perm_cms_blocks_delete', 'cms.blocks.delete', 'cms', 'Delete reusable blocks, testimonials, FAQs and website-editor templates'),
  ('perm_cms_publish', 'cms.publish', 'cms', 'Publish CMS pages and blog posts'),
  ('perm_blog_view', 'blog.view', 'blog', 'View blog posts, authors and categories'),
  ('perm_blog_create', 'blog.create', 'blog', 'Create blog posts, authors and categories'),
  ('perm_blog_manage', 'blog.manage', 'blog', 'Edit blog posts, authors, categories and tags'),
  ('perm_blog_delete', 'blog.delete', 'blog', 'Delete blog posts, authors and categories'),
  ('perm_media_view', 'media.view', 'media', 'View the media library'),
  ('perm_media_create', 'media.create', 'media', 'Upload media and create folders'),
  ('perm_media_manage', 'media.manage', 'media', 'Upload and edit media'),
  ('perm_media_delete', 'media.delete', 'media', 'Delete media'),
  ('perm_seo_view', 'seo.view', 'seo', 'View SEO defaults and redirects'),
  ('perm_seo_manage', 'seo.manage', 'seo', 'Edit SEO defaults and redirects'),
  ('perm_seo_delete', 'seo.delete', 'seo', 'Delete redirects'),
  ('perm_geo_view', 'geo.view', 'geo', 'View geo locations and local landing pages'),
  ('perm_geo_create', 'geo.create', 'geo', 'Create geo locations and local landing pages'),
  ('perm_geo_manage', 'geo.manage', 'geo', 'Edit geo locations, local landing pages and geo settings'),
  ('perm_geo_delete', 'geo.delete', 'geo', 'Delete geo locations and local landing pages'),
  ('perm_site_editMode', 'site.editMode', 'site', 'Edit on the website (edit mode): change content directly on the live pages — only what this role can already change in the admin panel'),
  ('perm_leads_view', 'leads.view', 'leads', 'View leads'),
  ('perm_leads_manage', 'leads.manage', 'leads', 'Update, assign and annotate leads'),
  ('perm_leads_export', 'leads.export', 'leads', 'Export leads to CSV'),
  ('perm_settings_manage', 'settings.manage', 'settings', 'Change website settings and theme'),
  ('perm_settings_delete', 'settings.delete', 'settings', 'Remove items from website settings (footer links, menus in settings, wording lists…)'),
  ('perm_integrations_manage', 'integrations.manage', 'integrations', 'Configure integrations and notifications'),
  ('perm_users_view', 'users.view', 'users', 'View users and their sessions'),
  ('perm_users_manage', 'users.manage', 'users', 'Edit users: account status, sessions, sign-in blocks and two-step resets'),
  ('perm_roles_manage', 'roles.manage', 'roles', 'Manage roles and permissions, and assign roles to users (Super Admin only)'),
  ('perm_audit_view', 'audit.view', 'audit', 'View audit log'),
  ('perm_approvals_manage', 'approvals.manage', 'approvals', 'Approve or reject vendor change requests, and see the whole vendor portal'),
  ('perm_billing_view', 'billing.view', 'billing', 'View vendor plans and subscriptions'),
  ('perm_billing_manage', 'billing.manage', 'billing', 'Create and edit vendor plans, subscriptions and payment settings'),
  ('perm_billing_delete', 'billing.delete', 'billing', 'Delete vendor plans'),
  ('perm_admin_viewOnly', 'admin.viewOnly', 'admin', 'View-only: see every admin page but change nothing (for demos)'),
  ('perm_vendor_portal', 'vendor.portal', 'vendor', 'Access the vendor portal'),
  ('perm_vendor_listings', 'vendor.listings', 'vendor', 'View own company''s products'),
  ('perm_vendor_listings_submit', 'vendor.listings.submit', 'vendor', 'Propose new products and product changes (needs approval)'),
  ('perm_vendor_listings_delete', 'vendor.listings.delete', 'vendor', 'Request unpublishing or deleting products (needs approval)'),
  ('perm_vendor_profile', 'vendor.profile', 'vendor', 'Propose company profile changes (needs approval)'),
  ('perm_vendor_reviews', 'vendor.reviews', 'vendor', 'See reviews of own products and propose public replies (needs approval)'),
  ('perm_vendor_leads', 'vendor.leads', 'vendor', 'View own company''s leads'),
  ('perm_vendor_offers', 'vendor.offers', 'vendor', 'Propose offers on own products (needs approval)'),
  ('perm_vendor_billing', 'vendor.billing', 'vendor', 'See plans and buy subscriptions for own company (no approval needed)'),
  ('perm_vendor_team', 'vendor.team', 'vendor', 'See the other users of own company'),
  ('perm_vendor_team_manage', 'vendor.team.manage', 'vendor', 'Propose adding, changing access of, resetting passwords for and removing company users (needs approval)'),
  ('perm_vendor_authorised', 'vendor.authorised', 'vendor', 'Propose products to resell as an authorised reseller (needs approval)'),
  ('perm_system_manage', 'system.manage', 'system', 'Recycle bin, backup and restore'),
  ('perm_deletions_approve', 'deletions.approve', 'deletions', 'Approve or reject deletion requests (Super Admin only)'),
  ('perm_buyer_account', 'buyer.account', 'buyer', 'Buyer account: save favourite products, get offer emails and write reviews')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

-- 2. Create is now its own permission: roles that could edit a module keep being able to create in it.
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'categories.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'categories.manage'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'taxonomy.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'taxonomy.manage'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'vendors.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'vendors.manage'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'comparisons.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'comparisons.manage'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'cms.pages.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'cms.pages'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'cms.navigation.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'cms.navigation'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'cms.blocks.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'cms.blocks'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'blog.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'blog.manage'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'media.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'media.manage'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT rp."roleId", (SELECT "id" FROM "Permission" WHERE "key" = 'geo.create') FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE p."key" = 'geo.manage'
ON CONFLICT DO NOTHING;

-- 3. Only the Super Admin deletes, manages roles and approves deletions. Other roles lose these grants
--    (the Super Admin can grant a Delete again, role by role, on the Roles page).
DELETE FROM "RolePermission" WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "key" IN ('software.delete', 'categories.delete', 'taxonomy.delete', 'vendors.delete', 'reviews.delete', 'comparisons.delete', 'offers.delete', 'cms.pages.delete', 'cms.navigation.delete', 'cms.blocks.delete', 'blog.delete', 'media.delete', 'seo.delete', 'geo.delete', 'settings.delete', 'billing.delete', 'cms.sections.delete', 'roles.manage', 'deletions.approve', 'system.manage'))
  AND "roleId" NOT IN (SELECT "id" FROM "Role" WHERE "key" = 'SUPER_ADMIN');
DELETE FROM "Permission" WHERE "key" = 'cms.sections.delete';

-- 4. Deletion requests.
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "baseline" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decisionNote" TEXT,
    "vendorId" TEXT,
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DeletionRequest_status_createdAt_idx" ON "DeletionRequest"("status", "createdAt");
CREATE INDEX "DeletionRequest_requestedById_status_idx" ON "DeletionRequest"("requestedById", "status");
CREATE INDEX "DeletionRequest_kind_status_idx" ON "DeletionRequest"("kind", "status");
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
