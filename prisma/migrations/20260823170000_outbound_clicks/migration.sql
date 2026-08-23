-- El clic que sale del blog hacia la tienda. Tabla nueva y aditiva: no toca
-- ninguna existente, asi que aplicarla no puede romper nada de lo que ya hay.
CREATE TABLE IF NOT EXISTS "dp_outbound_clicks_v1" (
  "id"             TEXT NOT NULL,
  "fromPath"       TEXT NOT NULL,
  "href"           TEXT NOT NULL,
  "destHost"       TEXT NOT NULL,
  "product"        TEXT,
  "utmCampaign"    TEXT,
  "linkIndex"      INTEGER,
  "label"          TEXT,
  "country"        TEXT,
  "deviceCategory" TEXT,
  "userAgent"      TEXT,
  "ipHashed"       TEXT,
  "sessionId"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dp_outbound_clicks_v1_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dp_outbound_clicks_v1_createdAt_idx" ON "dp_outbound_clicks_v1"("createdAt");
CREATE INDEX IF NOT EXISTS "dp_outbound_clicks_v1_fromPath_idx" ON "dp_outbound_clicks_v1"("fromPath");
CREATE INDEX IF NOT EXISTS "dp_outbound_clicks_v1_product_idx" ON "dp_outbound_clicks_v1"("product");
CREATE INDEX IF NOT EXISTS "dp_outbound_clicks_v1_sessionId_idx" ON "dp_outbound_clicks_v1"("sessionId");
