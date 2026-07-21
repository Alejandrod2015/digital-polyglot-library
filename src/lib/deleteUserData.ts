import { prisma } from "@/lib/prisma";

/**
 * Erase every row of personal data tied to a Clerk `userId` and revoke the
 * user's still-valid mobile session tokens. This is the single source of truth
 * for "delete my data", called by BOTH the Clerk `user.deleted` webhook (for
 * deletions started in the Clerk dashboard or by Clerk itself) and the
 * user-facing delete-account endpoint. Keep it idempotent: `deleteMany` is a
 * no-op when nothing matches, so running it twice (endpoint then webhook) is
 * harmless.
 *
 * IMPORTANT: every model with a scalar `userId` MUST be listed here, or a
 * deletion leaves orphaned personal data — exactly the compliance gap this
 * function was written to close. As of 2026-07 the models are the ten below;
 * when a new per-user model is added, add its `deleteMany` here too.
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.favorite.deleteMany({ where: { userId } }),
    prisma.favoriteCollection.deleteMany({ where: { userId } }),
    prisma.libraryBook.deleteMany({ where: { userId } }),
    prisma.libraryStory.deleteMany({ where: { userId } }),
    prisma.userStory.deleteMany({ where: { userId } }),
    prisma.userMetric.deleteMany({ where: { userId } }),
    prisma.emailPreference.deleteMany({ where: { userId } }),
    prisma.continueListeningEntry.deleteMany({ where: { userId } }),
    prisma.billingEntitlement.deleteMany({ where: { userId } }),
    // Not personal data, but a claim token redeemed by this user should no
    // longer point at a deleted account. Null it out rather than deleting the
    // token (it may still be a valid, re-redeemable grant).
    prisma.claimToken.updateMany({
      where: { redeemedBy: userId },
      data: { redeemedBy: null },
    }),
  ]);

  // Revoke any still-valid mobile session JWTs. The token is stateless
  // (signature + exp only), so deleting the data above does NOT cut off access;
  // getActiveMobileSession reads RevokedUser to do that instantly. Best-effort
  // and outside the transaction so a missing table (pre-migration) can never
  // roll back the data cleanup. upsert keeps a re-delete idempotent.
  try {
    await prisma.revokedUser.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  } catch (revokeErr) {
    console.error(`⚠️ Could not record revocation for ${userId}:`, revokeErr);
  }
}
