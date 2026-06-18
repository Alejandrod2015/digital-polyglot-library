-- Remote push campaigns (Fase 2). One row per message sent (or queued)
-- from Studio to opted-in users via APNs.

-- CreateTable
CREATE TABLE "dp_push_campaigns_v1" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "notificationTypeKey" TEXT,
    "target" TEXT NOT NULL DEFAULT 'type_subscribers',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dp_push_campaigns_v1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dp_push_campaigns_v1_status_idx" ON "dp_push_campaigns_v1"("status");

-- CreateIndex
CREATE INDEX "dp_push_campaigns_v1_scheduledAt_idx" ON "dp_push_campaigns_v1"("scheduledAt");
