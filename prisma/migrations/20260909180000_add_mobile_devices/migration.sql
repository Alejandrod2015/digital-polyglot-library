-- Aparato por persona, escrito solo desde las cabeceras que ya manda la app
-- en cada llamada. Aditiva: tabla nueva, no toca nada existente.
CREATE TABLE IF NOT EXISTS "dp_mobile_devices_v1" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "osVersion" TEXT NOT NULL DEFAULT '',
    "appVersion" TEXT NOT NULL DEFAULT '',
    "buildNumber" TEXT NOT NULL DEFAULT '',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dp_mobile_devices_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dp_mobile_devices_v1_userId_platform_model_appVersion_build_key"
    ON "dp_mobile_devices_v1"("userId", "platform", "model", "appVersion", "buildNumber");

CREATE INDEX IF NOT EXISTS "dp_mobile_devices_v1_lastSeenAt_idx" ON "dp_mobile_devices_v1"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "dp_mobile_devices_v1_model_idx" ON "dp_mobile_devices_v1"("model");
