-- Adds cache table for verb conjugations generated on-demand for the favorites screen.
-- Keyed by (language, infinitive); payload stores tense -> person -> form map.

CREATE TABLE "VerbConjugation" (
    "id"         TEXT      NOT NULL,
    "language"   TEXT      NOT NULL,
    "infinitive" TEXT      NOT NULL,
    "payload"    JSONB     NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerbConjugation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerbConjugation_language_infinitive_key"
    ON "VerbConjugation"("language", "infinitive");

CREATE INDEX "VerbConjugation_language_idx"
    ON "VerbConjugation"("language");
