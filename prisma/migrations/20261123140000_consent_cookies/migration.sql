-- Compliance & Privacy, phase 2: consent purposes, consent records, cookie categories and cookie choices.
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'WITHDRAWN');

CREATE TABLE "ConsentPurpose" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isNecessary" BOOLEAN NOT NULL DEFAULT false,
    "appliesTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConsentPurpose_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsentPurpose_key_key" ON "ConsentPurpose"("key");

CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "noticeVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawSource" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserConsent_userId_purposeId_status_idx" ON "UserConsent"("userId", "purposeId", "status");
CREATE INDEX "UserConsent_email_purposeId_status_idx" ON "UserConsent"("email", "purposeId", "status");
CREATE INDEX "UserConsent_purposeId_status_idx" ON "UserConsent"("purposeId", "status");
CREATE INDEX "UserConsent_createdAt_idx" ON "UserConsent"("createdAt");
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "ConsentPurpose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CookieCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isNecessary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cookies" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CookieCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CookieCategory_key_key" ON "CookieCategory"("key");

CREATE TABLE "CookiePreference" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "choices" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CookiePreference_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CookiePreference_visitorId_createdAt_idx" ON "CookiePreference"("visitorId", "createdAt");
CREATE INDEX "CookiePreference_createdAt_idx" ON "CookiePreference"("createdAt");
ALTER TABLE "CookiePreference" ADD CONSTRAINT "CookiePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starting configuration (edit in Admin › Compliance & Privacy). Optional purposes are never pre-ticked anywhere.
INSERT INTO "ConsentPurpose" ("id", "key", "name", "description", "isNecessary", "appliesTo", "sortOrder", "updatedAt") VALUES
  ('cp_account', 'account', 'Your account and the services you ask for', 'To create and run your account, save favourites, send the alerts you turn on, publish the reviews you write and keep the platform secure.', true, ARRAY['signup','account'], 0, CURRENT_TIMESTAMP),
  ('cp_enquiry', 'enquiry', 'Sharing your enquiry with matching vendors', 'When you ask for a quote, demo or advice, your details and requirement are shared with the vendors and resellers of the products you chose so they can respond.', true, ARRAY['enquiry'], 1, CURRENT_TIMESTAMP),
  ('cp_marketing', 'marketing', 'Marketing emails', 'Occasional emails with software buying tips, new categories and promotions from us.', false, ARRAY['signup','account'], 2, CURRENT_TIMESTAMP),
  ('cp_product_updates', 'product_updates', 'Product updates', 'Emails about new features and changes on the platform.', false, ARRAY['account'], 3, CURRENT_TIMESTAMP),
  ('cp_newsletter', 'newsletter', 'Newsletter', 'A periodic newsletter with software news and guides.', false, ARRAY['account'], 4, CURRENT_TIMESTAMP),
  ('cp_partner_offers', 'partner_offers', 'Offers from software vendors', 'Promotional offers from software vendors listed on the platform, sent by us (your details aren''t shared for this).', false, ARRAY['account'], 5, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "CookieCategory" ("id", "key", "name", "description", "isNecessary", "sortOrder", "cookies", "updatedAt") VALUES
  ('cc_necessary', 'necessary', 'Strictly necessary', 'Needed for the website to work: signing in, security, remembering your cookie choices. Always on.', true, 0, '[{"name":"cg_session / __Host-cg_session","provider":"This website","duration":"Until sign-out or session expiry","purpose":"Keeps you signed in"},{"name":"cg_cookie_consent","provider":"This website","duration":"As set in Compliance settings","purpose":"Remembers your cookie choices"}]', CURRENT_TIMESTAMP),
  ('cc_functional', 'functional', 'Functional', 'Remembers choices that make the site easier to use, like products added to compare.', false, 1, '[]', CURRENT_TIMESTAMP),
  ('cc_analytics', 'analytics', 'Analytics', 'Helps us understand how the website is used so we can improve it (Google Analytics, Microsoft Clarity, Google Tag Manager when set up).', false, 2, '[{"name":"_ga, _ga_*","provider":"Google Analytics","duration":"Up to 2 years","purpose":"Distinguishes visitors and sessions"},{"name":"_clck, _clsk","provider":"Microsoft Clarity","duration":"Up to 1 year","purpose":"Usage and session recordings"}]', CURRENT_TIMESTAMP),
  ('cc_marketing', 'marketing', 'Advertising and marketing', 'Used to measure and personalise advertising (Meta Pixel when set up).', false, 3, '[{"name":"_fbp","provider":"Meta","duration":"Up to 3 months","purpose":"Ad measurement"}]', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
