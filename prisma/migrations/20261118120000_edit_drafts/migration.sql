-- Website edit mode drafts (unpublished changes made on the live pages).
CREATE TABLE "EditDraft" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditDraft_pkey" PRIMARY KEY ("key")
);
