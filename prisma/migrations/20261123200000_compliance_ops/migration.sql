-- Compliance & Privacy, phase 5: content complaints, retention rules, security incidents, vendor compliance.
ALTER TYPE "PrivacyCaseKind" ADD VALUE IF NOT EXISTS 'CONTENT_COMPLAINT';
ALTER TABLE "PrivacyCase" ADD COLUMN "contentUrl" TEXT, ADD COLUMN "declaration" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "actionTaken" TEXT;

CREATE TABLE "RetentionRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "retentionDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "legalReviewed" BOOLEAN NOT NULL DEFAULT false,
    "legalNote" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastRunCount" INTEGER,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetentionRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RetentionRule_key_key" ON "RetentionRule"("key");

CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED');

CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "personalDataAffected" BOOLEAN NOT NULL DEFAULT false,
    "dataCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedCount" INTEGER,
    "decisionDueAt" TIMESTAMP(3),
    "reportable" TEXT NOT NULL DEFAULT 'undecided',
    "decisionNote" TEXT,
    "reportedToBoardAt" TIMESTAMP(3),
    "reportedToCertInAt" TIMESTAMP(3),
    "usersNotifiedAt" TIMESTAMP(3),
    "rootCause" TEXT,
    "remediation" TEXT,
    "reportedById" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SecurityIncident_referenceNo_key" ON "SecurityIncident"("referenceNo");
CREATE INDEX "SecurityIncident_status_detectedAt_idx" ON "SecurityIncident"("status", "detectedAt");
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "IncidentEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "message" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId", "createdAt");
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "SecurityIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Incident history is evidence: append-only (the actor link may be cleared when a user is removed).
CREATE OR REPLACE FUNCTION incident_event_protect() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."actorId" IS NULL AND OLD."actorId" IS NOT NULL
     AND NEW."message" IS NOT DISTINCT FROM OLD."message" AND NEW."type" = OLD."type" AND NEW."createdAt" = OLD."createdAt" THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.audit_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'Incident history cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "IncidentEvent_protect" BEFORE UPDATE OR DELETE ON "IncidentEvent" FOR EACH ROW EXECUTE FUNCTION incident_event_protect();

CREATE TABLE "VendorCompliance" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL DEFAULT 'not_started',
    "kycNote" TEXT,
    "gstinVerified" BOOLEAN NOT NULL DEFAULT false,
    "dpaSigned" BOOLEAN NOT NULL DEFAULT false,
    "dpaSignedAt" TIMESTAMP(3),
    "dataRole" TEXT NOT NULL DEFAULT 'undecided',
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VendorCompliance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VendorCompliance_vendorId_key" ON "VendorCompliance"("vendorId");
ALTER TABLE "VendorCompliance" ADD CONSTRAINT "VendorCompliance_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Retention jobs, all switched off with no period: set each period with your lawyer, then switch it on.
INSERT INTO "RetentionRule" ("id", "key", "name", "description", "action", "updatedAt") VALUES
  ('rr_unconfirmed', 'privacy_unconfirmed', 'Unconfirmed privacy requests', 'Data requests and complaints sent without signing in whose email link was never confirmed.', 'delete', CURRENT_TIMESTAMP),
  ('rr_closed_cases', 'privacy_closed', 'Finished privacy requests and complaints', 'Resolved, declined or closed cases: the requester''s name, email, phone and message are removed; the reference, type, dates and outcome stay.', 'anonymise', CURRENT_TIMESTAMP),
  ('rr_leads', 'lead_contact', 'Enquiry contact details', 'Name, email, phone, company and message on enquiries older than the period (counts and reports keep working).', 'anonymise', CURRENT_TIMESTAMP),
  ('rr_cookie_log', 'cookie_choices', 'Cookie choice log', 'The log of visitors'' cookie banner choices (the choice in their browser isn''t affected).', 'delete', CURRENT_TIMESTAMP),
  ('rr_audit', 'audit_log', 'Audit log', 'Admin and security audit records older than the period.', 'delete', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
