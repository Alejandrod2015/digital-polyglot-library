-- Pregunta hablada cacheada del ejercicio de speaking (piloto 2026-09-14).
-- Aditiva: tabla nueva, no toca nada existente. Nada del usuario vive aqui.
CREATE TABLE IF NOT EXISTS "dp_speaking_prompts_v1" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "storySlug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "characterName" TEXT,
    "voiceId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dp_speaking_prompts_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dp_speaking_prompts_v1_language_word_storySlug_key"
    ON "dp_speaking_prompts_v1"("language", "word", "storySlug");
