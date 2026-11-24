-- Compliance & Privacy, phase 3: versioned legal documents and acceptances.
CREATE TYPE "LegalVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "requiresAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalDocument_key_key" ON "LegalDocument"("key");
CREATE UNIQUE INDEX "LegalDocument_slug_key" ON "LegalDocument"("slug");

CREATE TABLE "LegalDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "LegalVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summaryOfChanges" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdById" TEXT,
    "requireReacceptance" BOOLEAN NOT NULL DEFAULT false,
    "legalReviewed" BOOLEAN NOT NULL DEFAULT false,
    "legalReviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalDocumentVersion_documentId_version_key" ON "LegalDocumentVersion"("documentId", "version");
CREATE INDEX "LegalDocumentVersion_documentId_status_effectiveAt_idx" ON "LegalDocumentVersion"("documentId", "status", "effectiveAt");
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LegalAcceptance_userId_documentId_idx" ON "LegalAcceptance"("userId", "documentId");
CREATE INDEX "LegalAcceptance_versionId_idx" ON "LegalAcceptance"("versionId");
CREATE INDEX "LegalAcceptance_documentId_acceptedAt_idx" ON "LegalAcceptance"("documentId", "acceptedAt");
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A published or archived version is a record of what people were shown: its text can't change and it can't be
-- deleted. The only change allowed is PUBLISHED → ARCHIVED (withdrawn).
CREATE OR REPLACE FUNCTION legal_version_protect() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Published legal document versions cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'DRAFT' THEN RETURN NEW; END IF;
  IF OLD."status" = 'PUBLISHED' AND NEW."status" = 'ARCHIVED'
     AND NEW."content" = OLD."content" AND NEW."title" = OLD."title" AND NEW."version" = OLD."version"
     AND NEW."effectiveAt" IS NOT DISTINCT FROM OLD."effectiveAt" AND NEW."documentId" = OLD."documentId" THEN
    RETURN NEW;
  END IF;
  -- Review notes may still be added after publishing.
  IF NEW."status" = OLD."status" AND NEW."content" = OLD."content" AND NEW."title" = OLD."title" AND NEW."version" = OLD."version"
     AND NEW."effectiveAt" IS NOT DISTINCT FROM OLD."effectiveAt" AND NEW."documentId" = OLD."documentId"
     AND NEW."summaryOfChanges" IS NOT DISTINCT FROM OLD."summaryOfChanges" AND NEW."requireReacceptance" = OLD."requireReacceptance" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Published legal document versions cannot be changed; create a new version instead';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LegalDocumentVersion_protect" BEFORE UPDATE OR DELETE ON "LegalDocumentVersion" FOR EACH ROW EXECUTE FUNCTION legal_version_protect();

-- Acceptances are evidence: append-only (the user link may still be cleared when an account is deleted).
CREATE OR REPLACE FUNCTION legal_acceptance_protect() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."userId" IS NULL AND OLD."userId" IS NOT NULL
     AND NEW."email" = OLD."email" AND NEW."versionId" = OLD."versionId" AND NEW."acceptedAt" = OLD."acceptedAt" THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.audit_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'Legal acceptance records cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LegalAcceptance_protect" BEFORE UPDATE OR DELETE ON "LegalAcceptance" FOR EACH ROW EXECUTE FUNCTION legal_acceptance_protect();

-- The documents (no text: write or paste it in Admin › Compliance & Privacy › Legal documents and have it reviewed).
INSERT INTO "LegalDocument" ("id", "key", "title", "slug", "audience", "requiresAcceptance", "sortOrder", "updatedAt") VALUES
  ('ld_privacy', 'privacy-policy', 'Privacy policy', 'privacy-policy', 'all', true, 0, CURRENT_TIMESTAMP),
  ('ld_terms', 'terms', 'Terms of use', 'terms', 'all', true, 1, CURRENT_TIMESTAMP),
  ('ld_cookies', 'cookie-policy', 'Cookie policy', 'cookie-policy', 'all', false, 2, CURRENT_TIMESTAMP),
  ('ld_disclaimer', 'disclaimer', 'Disclaimer', 'disclaimer', 'all', false, 3, CURRENT_TIMESTAMP),
  ('ld_grievance', 'grievance-policy', 'Grievance redressal policy', 'grievance-policy', 'all', false, 4, CURRENT_TIMESTAMP),
  ('ld_reviews', 'review-policy', 'Review and content policy', 'review-policy', 'all', false, 5, CURRENT_TIMESTAMP),
  ('ld_vendor', 'vendor-agreement', 'Vendor listing agreement', 'vendor-agreement', 'vendor', true, 6, CURRENT_TIMESTAMP),
  ('ld_reseller', 'reseller-agreement', 'Reseller partner agreement', 'reseller-agreement', 'reseller', true, 7, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
