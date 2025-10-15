-- CreateTable
CREATE TABLE "dp_claim_tokens_v1" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "books" TEXT[],
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "dp_claim_tokens_v1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dp_claim_tokens_v1_token_key" ON "dp_claim_tokens_v1"("token");

-- CreateIndex
CREATE INDEX "dp_claim_tokens_v1_buyerEmail_idx" ON "dp_claim_tokens_v1"("buyerEmail");

-- CreateIndex
CREATE INDEX "dp_claim_tokens_v1_recipientEmail_idx" ON "dp_claim_tokens_v1"("recipientEmail");

-- CreateIndex
CREATE INDEX "dp_claim_tokens_v1_redeemedBy_idx" ON "dp_claim_tokens_v1"("redeemedBy");

-- CreateIndex
CREATE INDEX "dp_claim_tokens_v1_createdAt_idx" ON "dp_claim_tokens_v1"("createdAt");
