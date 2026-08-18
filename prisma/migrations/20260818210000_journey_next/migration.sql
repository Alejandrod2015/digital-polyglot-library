-- Puente entre journeys: al terminar uno, la app ofrece el siguiente.
-- Nullable y ON DELETE SET NULL: un journey sin continuación es lo normal.
ALTER TABLE "dp_journeys_v1" ADD COLUMN "nextJourneyId" TEXT;

ALTER TABLE "dp_journeys_v1"
  ADD CONSTRAINT "dp_journeys_v1_nextJourneyId_fkey"
  FOREIGN KEY ("nextJourneyId") REFERENCES "dp_journeys_v1"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "dp_journeys_v1_nextJourneyId_idx" ON "dp_journeys_v1"("nextJourneyId");
