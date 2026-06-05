-- CreateTable
CREATE TABLE "dp_email_preferences_v1" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "progress" BOOLEAN NOT NULL DEFAULT true,
    "reminders" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribedAll" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dp_email_preferences_v1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dp_email_preferences_v1_email_key" ON "dp_email_preferences_v1"("email");

-- CreateIndex
CREATE INDEX "dp_email_preferences_v1_userId_idx" ON "dp_email_preferences_v1"("userId");
