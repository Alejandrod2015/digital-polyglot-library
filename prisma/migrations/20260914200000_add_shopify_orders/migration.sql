-- Pedido de Shopify con su origen, escrito por el webhook de pedidos.
-- Aditiva: tabla nueva, no toca nada existente.
CREATE TABLE IF NOT EXISTS "dp_shopify_orders_v1" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "totalShop" DECIMAL(12,2) NOT NULL,
    "shopCurrency" TEXT NOT NULL,
    "totalPaid" DECIMAL(12,2) NOT NULL,
    "paidCurrency" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "landingSite" TEXT,
    "referringSite" TEXT,
    "sourceName" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "hasFbclid" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "items" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dp_shopify_orders_v1_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dp_shopify_orders_v1_orderedAt_idx" ON "dp_shopify_orders_v1"("orderedAt");
CREATE INDEX IF NOT EXISTS "dp_shopify_orders_v1_channel_idx" ON "dp_shopify_orders_v1"("channel");
