/**
 * Break-glass: clears two-step verification for one account from the command line, for when the
 * only Super Admin has lost both their phone and their backup codes.
 *
 *   npm run auth:reset-2fa -- someone@example.com
 *
 * The user sets up a new authenticator the next time they sign in with their password.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run auth:reset-2fa -- <email>");
    process.exit(1);
  }
  const db = new PrismaClient();
  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No account with the email ${email}.`);
      process.exit(1);
    }
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null, backupCodeHashes: [] } }),
      db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      db.authToken.deleteMany({ where: { userId: user.id, type: "TWO_FACTOR" } }),
      db.auditLog.create({ data: { actorId: null, action: "user.2fa_reset", entityType: "user", entityId: user.id, summary: `Two-step verification reset from the command line for ${email}` } }),
    ]);
    console.log(`✓ Two-step verification reset for ${email}. They'll set up a new authenticator at their next sign-in.`);
  } finally {
    await db.$disconnect();
  }
}

void main();
