-- Un pulgar por persona e historia, con comentario opcional.
-- El voto se escribe en el toque; el comentario, si llega, hace UPDATE sobre
-- la misma fila, de ahí el UNIQUE en (userId, storySlug).
CREATE TABLE "dp_story_ratings_v1" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "storyId" TEXT NOT NULL,
    "storySlug" TEXT NOT NULL,
    "bookSlug" TEXT,
    "liked" BOOLEAN NOT NULL,
    "comment" TEXT,
    "platform" TEXT,
    "appVersion" TEXT,
    "buildNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dp_story_ratings_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dp_story_ratings_v1_userId_storySlug_key"
  ON "dp_story_ratings_v1"("userId", "storySlug");

CREATE INDEX "dp_story_ratings_v1_storySlug_idx" ON "dp_story_ratings_v1"("storySlug");

CREATE INDEX "dp_story_ratings_v1_createdAt_idx" ON "dp_story_ratings_v1"("createdAt");
