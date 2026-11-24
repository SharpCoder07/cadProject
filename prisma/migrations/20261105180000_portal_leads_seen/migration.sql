-- Vendor/reseller portal: new-lead count on the bell and the Leads menu.
ALTER TABLE "User" ADD COLUMN "leadsSeenAt" TIMESTAMP(3);
