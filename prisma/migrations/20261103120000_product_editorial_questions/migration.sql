-- Product page: editorial pros/cons, "who should choose", and buyer questions.

-- AlterTable
ALTER TABLE "Software" ADD COLUMN "pros" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "cons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "bestFor" TEXT,
ADD COLUMN "notIdealFor" TEXT;

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" TEXT NOT NULL,
    "softwareId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductQuestion_softwareId_status_createdAt_idx" ON "ProductQuestion"("softwareId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductQuestion_status_idx" ON "ProductQuestion"("status");

-- CreateIndex
CREATE INDEX "ProductQuestion_userId_idx" ON "ProductQuestion"("userId");

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "Software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
