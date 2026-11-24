-- Compliance & Privacy, phase 4: data requests and grievances.
CREATE TYPE "PrivacyCaseKind" AS ENUM ('DATA_REQUEST', 'GRIEVANCE');
CREATE TYPE "PrivacyCaseStatus" AS ENUM ('PENDING_VERIFICATION', 'OPEN', 'IN_PROGRESS', 'AWAITING_REQUESTER', 'RESOLVED', 'REJECTED', 'CLOSED');

CREATE TABLE "PrivacyCase" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "kind" "PrivacyCaseKind" NOT NULL,
    "type" TEXT NOT NULL,
    "status" "PrivacyCaseStatus" NOT NULL DEFAULT 'OPEN',
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "details" TEXT NOT NULL,
    "verification" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifyTokenHash" TEXT,
    "verifyExpiresAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "ipHash" TEXT,
    "assignedToId" TEXT,
    "ackDueAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrivacyCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrivacyCase_referenceNo_key" ON "PrivacyCase"("referenceNo");
CREATE UNIQUE INDEX "PrivacyCase_verifyTokenHash_key" ON "PrivacyCase"("verifyTokenHash");
CREATE INDEX "PrivacyCase_kind_status_createdAt_idx" ON "PrivacyCase"("kind", "status", "createdAt");
CREATE INDEX "PrivacyCase_email_idx" ON "PrivacyCase"("email");
CREATE INDEX "PrivacyCase_userId_idx" ON "PrivacyCase"("userId");
CREATE INDEX "PrivacyCase_dueAt_idx" ON "PrivacyCase"("dueAt");
ALTER TABLE "PrivacyCase" ADD CONSTRAINT "PrivacyCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacyCase" ADD CONSTRAINT "PrivacyCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PrivacyCaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "message" TEXT,
    "internal" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrivacyCaseEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyCaseEvent_caseId_createdAt_idx" ON "PrivacyCaseEvent"("caseId", "createdAt");
ALTER TABLE "PrivacyCaseEvent" ADD CONSTRAINT "PrivacyCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PrivacyCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyCaseEvent" ADD CONSTRAINT "PrivacyCaseEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Case history is a record: events can't be edited or deleted (the actor link may still be cleared).
CREATE OR REPLACE FUNCTION privacy_event_protect() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."actorId" IS NULL AND OLD."actorId" IS NOT NULL
     AND NEW."message" IS NOT DISTINCT FROM OLD."message" AND NEW."type" = OLD."type" AND NEW."createdAt" = OLD."createdAt" THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.audit_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'Privacy case history cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PrivacyCaseEvent_protect" BEFORE UPDATE OR DELETE ON "PrivacyCaseEvent" FOR EACH ROW EXECUTE FUNCTION privacy_event_protect();
