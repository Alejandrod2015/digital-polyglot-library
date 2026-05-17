-- First-party page visit log. Captures every page render (server side)
-- without depending on analytics cookie consent. The /api/log/visit
-- endpoint backfills geo from Vercel edge headers and reads UTM/referrer
-- from the client. See PageVisit model docs in schema.prisma.

CREATE TABLE IF NOT EXISTS "dp_page_visits_v1" (
  "id"              TEXT PRIMARY KEY,
  "path"            TEXT NOT NULL,
  "referrer"        TEXT,
  "landingUrl"      TEXT,
  "utmSource"       TEXT,
  "utmMedium"       TEXT,
  "utmCampaign"     TEXT,
  "utmContent"      TEXT,
  "utmTerm"         TEXT,
  "country"         TEXT,
  "region"          TEXT,
  "city"            TEXT,
  "timezone"        TEXT,
  "browserLanguage" TEXT,
  "deviceCategory"  TEXT,
  "userAgent"       TEXT,
  "ipHashed"        TEXT,
  "sessionId"       TEXT,
  "preConsent"      BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_createdAt_idx" ON "dp_page_visits_v1" ("createdAt");
CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_path_idx" ON "dp_page_visits_v1" ("path");
CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_sessionId_idx" ON "dp_page_visits_v1" ("sessionId");
CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_country_idx" ON "dp_page_visits_v1" ("country");
CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_utmSource_idx" ON "dp_page_visits_v1" ("utmSource");
