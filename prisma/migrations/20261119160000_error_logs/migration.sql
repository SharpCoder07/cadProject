-- Error logs (Logs › Error logs).
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "details" TEXT,
    "source" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "digest" TEXT,
    "fingerprint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT,
    "userAgent" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedByName" TEXT,
    "note" TEXT,
    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ErrorLog_status_lastSeenAt_idx" ON "ErrorLog"("status", "lastSeenAt" DESC);
CREATE INDEX "ErrorLog_type_status_idx" ON "ErrorLog"("type", "status");
CREATE INDEX "ErrorLog_fingerprint_idx" ON "ErrorLog"("fingerprint");

-- Permissions; Admin and Read-only Analyst can see them, Admin can change the status.
INSERT INTO "Permission" ("id", "key", "group", "description") VALUES
  ('perm_errors_view', 'errors.view', 'errors', 'View error logs'),
  ('perm_errors_manage', 'errors.manage', 'errors', 'Mark errors resolved or pending, and add notes')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT r."id", p."id" FROM "Role" r, "Permission" p WHERE r."key" = 'ADMIN' AND p."key" IN ('errors.view', 'errors.manage')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
  SELECT r."id", p."id" FROM "Role" r, "Permission" p WHERE r."key" = 'ANALYST' AND p."key" = 'errors.view'
ON CONFLICT DO NOTHING;
