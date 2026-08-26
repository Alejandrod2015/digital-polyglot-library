-- Capa de tap-any-word fuera del build. Ver el comentario del modelo.
CREATE TABLE "dp_tap_glosses_v1" (
    "id" TEXT NOT NULL,
    "bundle" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "language" TEXT,
    "variant" TEXT,
    "glosses" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dp_tap_glosses_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dp_tap_glosses_v1_bundle_slug_key" ON "dp_tap_glosses_v1"("bundle", "slug");
CREATE INDEX "dp_tap_glosses_v1_slug_idx" ON "dp_tap_glosses_v1"("slug");
ALTER TABLE "dp_tap_glosses_v1" ADD COLUMN "slugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
