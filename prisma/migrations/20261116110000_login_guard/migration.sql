-- Sign-in protection: per-email attempt rounds and 24-hour network blocks.
CREATE TABLE "LoginGuard" (
    "email" TEXT NOT NULL,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "round" INTEGER NOT NULL DEFAULT 1,
    "lockedUntil" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoginGuard_pkey" PRIMARY KEY ("email")
);
CREATE INDEX "LoginGuard_updatedAt_idx" ON "LoginGuard"("updatedAt");

CREATE TABLE "IpBlock" (
    "ipHash" TEXT NOT NULL,
    "ipHint" TEXT,
    "until" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IpBlock_pkey" PRIMARY KEY ("ipHash")
);
CREATE INDEX "IpBlock_until_idx" ON "IpBlock"("until");
CREATE INDEX "IpBlock_email_idx" ON "IpBlock"("email");
