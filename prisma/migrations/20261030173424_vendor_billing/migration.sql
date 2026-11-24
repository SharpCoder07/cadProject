-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('RAZORPAY', 'MANUAL');

-- CreateTable
CREATE TABLE "VendorPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePaise" INTEGER NOT NULL,
    "interval" "BillingInterval" NOT NULL DEFAULT 'YEAR',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSubscription" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "SubscriptionSource" NOT NULL DEFAULT 'RAZORPAY',
    "planName" TEXT NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "purchasedById" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorPlan_isActive_sortOrder_idx" ON "VendorPlan"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VendorSubscription_razorpayOrderId_key" ON "VendorSubscription"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorSubscription_razorpayPaymentId_key" ON "VendorSubscription"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "VendorSubscription_vendorId_status_periodEnd_idx" ON "VendorSubscription"("vendorId", "status", "periodEnd");

-- CreateIndex
CREATE INDEX "VendorSubscription_status_createdAt_idx" ON "VendorSubscription"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "VendorSubscription" ADD CONSTRAINT "VendorSubscription_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSubscription" ADD CONSTRAINT "VendorSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VendorPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSubscription" ADD CONSTRAINT "VendorSubscription_purchasedById_fkey" FOREIGN KEY ("purchasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
