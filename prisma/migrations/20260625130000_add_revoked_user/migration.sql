-- Tracks userIds whose access has been revoked (Clerk user.deleted).
-- Additive, non-destructive. Read by getActiveMobileSession to reject
-- stateless mobile JWTs issued for a since-deleted user.
CREATE TABLE "RevokedUser" (
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedUser_pkey" PRIMARY KEY ("userId")
);
