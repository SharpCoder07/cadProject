-- Compliance & Privacy, phase 1: audit log fields for compliance reporting, and append-only protection.
ALTER TABLE "AuditLog" ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE "AuditLog" ADD COLUMN "result" TEXT NOT NULL DEFAULT 'success';
ALTER TABLE "AuditLog" ADD COLUMN "metadata" JSONB;
CREATE INDEX "AuditLog_result_createdAt_idx" ON "AuditLog"("result", "createdAt");

-- Failed sign-ins recorded before this migration.
UPDATE "AuditLog" SET "result" = 'failure' WHERE "action" IN ('auth.login_failed', 'auth.ip_blocked', 'auth.login_wrong_portal');

-- Audit records can't be edited or deleted by anyone using the app (admins included).
-- Allowed: the actor link being cleared when a user account is deleted (foreign key SET NULL),
-- and deletion by a retention job that sets app.audit_purge = 'on' for its own transaction.
-- (TRUNCATE during a full backup restore is a statement-level operation and isn't affected.)
CREATE OR REPLACE FUNCTION audit_log_protect() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.audit_purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."actorId" IS NOT NULL AND NEW."actorId" IS NULL
       AND NEW."id" = OLD."id" AND NEW."action" = OLD."action" AND NEW."entityType" = OLD."entityType"
       AND NEW."entityId" IS NOT DISTINCT FROM OLD."entityId" AND NEW."summary" IS NOT DISTINCT FROM OLD."summary"
       AND NEW."diff"::text IS NOT DISTINCT FROM OLD."diff"::text AND NEW."ipAddress" IS NOT DISTINCT FROM OLD."ipAddress"
       AND NEW."userAgent" IS NOT DISTINCT FROM OLD."userAgent" AND NEW."createdAt" = OLD."createdAt"
       AND NEW."actorType" = OLD."actorType" AND NEW."result" = OLD."result"
       AND NEW."metadata"::text IS NOT DISTINCT FROM OLD."metadata"::text THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Audit log records cannot be changed';
  END IF;
  RAISE EXCEPTION 'Audit log records cannot be deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AuditLog_protect" ON "AuditLog";
CREATE TRIGGER "AuditLog_protect" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION audit_log_protect();

-- Compliance & privacy permissions. No built-in role gets them: the Super Admin has every permission automatically,
-- and they can be granted to other roles later in Admin › Roles & permissions.
INSERT INTO "Permission" ("id", "key", "group", "description") VALUES
  ('perm_compliance_view', 'compliance.view', 'compliance', 'Compliance & privacy: see the module (personal data shown masked)'),
  ('perm_compliance_manage', 'compliance.manage', 'compliance', 'Compliance & privacy: change settings and work on requests, documents and complaints'),
  ('perm_compliance_sensitive', 'compliance.sensitive', 'compliance', 'Compliance & privacy: see unmasked personal data in privacy records (every view is logged)'),
  ('perm_compliance_incidents', 'compliance.incidents', 'compliance', 'Compliance & privacy: see and handle security incidents and data breaches')
ON CONFLICT ("key") DO NOTHING;
