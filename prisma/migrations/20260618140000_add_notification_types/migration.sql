-- Studio-editable notification type definitions (Fase 1).
-- One row per "tipo" the mobile app can schedule locally (and later
-- push remotely). Copy falls back to code defaults when a row is absent.

-- CreateTable
CREATE TABLE "dp_notification_types_v1" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hourDefault" INTEGER,
    "localEnabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "channel" TEXT NOT NULL DEFAULT 'local',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dp_notification_types_v1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dp_notification_types_v1_key_key" ON "dp_notification_types_v1"("key");
