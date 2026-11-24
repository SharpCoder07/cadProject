-- Accounts created by an admin with a password: the user chooses their own after the first sign-in.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
