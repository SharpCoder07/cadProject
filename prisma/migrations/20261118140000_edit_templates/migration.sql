-- Website edit mode templates (saved sections, rows and pages to reuse).
CREATE TABLE "EditTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EditTemplate_kind_name_idx" ON "EditTemplate"("kind", "name");
