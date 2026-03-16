CREATE TYPE "BillingSource" AS ENUM ('stripe', 'google_play');

CREATE TYPE "BillingStatus" AS ENUM (
    'active',
    'trialing',
    'in_grace_period',
    'on_hold',
    'paused',
    'canceled',
    'expired',
    'pending',
    'revoked',
    'unknown'
);

CREATE TABLE "dp_billing_entitlements_v1" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "source" "BillingSource" NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'unknown',
    "productId" TEXT,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "purchaseToken" TEXT,
    "orderId" TEXT,
    "willRenew" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dp_billing_entitlements_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dp_billing_entitlements_v1_userId_key" ON "dp_billing_entitlements_v1"("userId");
CREATE UNIQUE INDEX "dp_billing_entitlements_v1_purchaseToken_key" ON "dp_billing_entitlements_v1"("purchaseToken");
CREATE INDEX "dp_billing_entitlements_v1_source_status_idx" ON "dp_billing_entitlements_v1"("source", "status");
CREATE INDEX "dp_billing_entitlements_v1_expiresAt_idx" ON "dp_billing_entitlements_v1"("expiresAt");
CREATE INDEX "dp_billing_entitlements_v1_productId_idx" ON "dp_billing_entitlements_v1"("productId");
