-- Buyer accounts: sign-up email confirmation tokens and reviews linked to the buyer who wrote them.

-- AlterEnum
ALTER TYPE "AuthTokenType" ADD VALUE 'EMAIL_VERIFY';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_softwareId_userId_key" ON "Review"("softwareId", "userId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
