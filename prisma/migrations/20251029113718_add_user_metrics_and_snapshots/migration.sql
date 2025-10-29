-- CreateTable
CREATE TABLE "dp_user_metrics_v1" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookSlug" TEXT,
    "storySlug" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dp_user_metrics_v1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dp_weekly_metrics_v1" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "totalPlays" INTEGER NOT NULL,
    "totalCompletions" INTEGER NOT NULL,
    "avgCompletionRate" DOUBLE PRECISION NOT NULL,
    "avgDuration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dp_weekly_metrics_v1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dp_user_metrics_v1_userId_idx" ON "dp_user_metrics_v1"("userId");

-- CreateIndex
CREATE INDEX "dp_user_metrics_v1_storySlug_idx" ON "dp_user_metrics_v1"("storySlug");

-- CreateIndex
CREATE INDEX "dp_user_metrics_v1_createdAt_idx" ON "dp_user_metrics_v1"("createdAt");

-- CreateIndex
CREATE INDEX "dp_weekly_metrics_v1_weekStart_idx" ON "dp_weekly_metrics_v1"("weekStart");

-- CreateIndex
CREATE INDEX "dp_weekly_metrics_v1_weekEnd_idx" ON "dp_weekly_metrics_v1"("weekEnd");
