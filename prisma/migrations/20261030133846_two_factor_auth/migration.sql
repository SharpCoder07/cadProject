-- AlterEnum
ALTER TYPE "AuthTokenType" ADD VALUE 'TWO_FACTOR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "backupCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpPendingEnc" TEXT,
ADD COLUMN     "totpSecretEnc" TEXT;
