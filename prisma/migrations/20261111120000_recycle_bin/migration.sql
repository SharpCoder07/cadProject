-- Recycle bin
CREATE TABLE "TrashItem" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "relatedCount" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "deletedById" TEXT,
    "deletedByName" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrashItem_purgeAt_idx" ON "TrashItem"("purgeAt");
CREATE INDEX "TrashItem_typeLabel_deletedAt_idx" ON "TrashItem"("typeLabel", "deletedAt");
