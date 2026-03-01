CREATE TABLE "dp_continue_listening_v1" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookSlug" TEXT NOT NULL,
  "storySlug" TEXT NOT NULL,
  "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dp_continue_listening_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dp_continue_listening_v1_userId_bookSlug_storySlug_key"
  ON "dp_continue_listening_v1"("userId", "bookSlug", "storySlug");

CREATE INDEX "dp_continue_listening_v1_userId_idx"
  ON "dp_continue_listening_v1"("userId");

CREATE INDEX "dp_continue_listening_v1_lastPlayedAt_idx"
  ON "dp_continue_listening_v1"("lastPlayedAt");
