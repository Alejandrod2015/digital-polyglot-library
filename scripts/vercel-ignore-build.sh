#!/bin/bash
# Vercel Ignore Build Step
# Exit 0 = skip build, Exit 1 = proceed with build

echo "::> Checking if build is needed..."

# 1. Skip builds on non-production branches (development, dev, staging, etc.)
#    Only build on main branch
if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then
  echo "::> Branch '$VERCEL_GIT_COMMIT_REF' is not main. Skipping build."
  exit 0
fi

# 2. Check if changes are mobile-only (no web files changed)
#
# CUIDADO, LIMITACION CONOCIDA (2026-07-30): esto compara contra HEAD~1, o sea
# SOLO el ultimo commit, no contra lo ultimo desplegado. El 2026-07-30 un push
# de 15 commits que TERMINABA en un bump de version movil se salto el build
# entero: el script vio unicamente "apps/mobile/app.json" y canceló, dejando
# sin desplegar cambios de `src/` (entre ellos src/lib/karaokeWordWindows.ts).
# El sintoma es peor que un fallo, porque el deploy aparece como "skipped" y
# parece exito.
#
# La base correcta es el commit del ultimo deploy de produccion, y Vercel NO lo
# expone al Ignored Build Step. Arreglarlo de verdad exige consultar la API de
# Vercel con un token (como hace turbo-ignore). Mientras no exista ese token
# aqui, usamos VERCEL_GIT_PREVIOUS_SHA si el entorno lo trae y caemos a HEAD~1
# si no.
#
# REGLA DE USO hasta entonces: no cierres un batch con un commit mobile-only.
# Si el push mezcla web y movil, que el ultimo commit toque `src/`, o el build
# se saltara en silencio.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD~1}"
echo "::> Comparando contra: $BASE"
CHANGED_FILES=$(git diff "$BASE" --name-only 2>/dev/null || git diff HEAD~1 --name-only 2>/dev/null || echo "UNKNOWN")

if [ "$CHANGED_FILES" = "UNKNOWN" ]; then
  echo "::> Could not determine changed files. Proceeding with build."
  exit 1
fi

# Directories/patterns that are mobile-only (don't affect the web app).
# OJO: este es un monorepo; la app Expo vive en `apps/mobile/` (no en `mobile/`).
# Los patrones viejos (`^mobile/`, `^ios/`, `^app.json`, `^eas.json`, …) NUNCA
# matcheaban las rutas reales `apps/mobile/...`, así que TODO push mobile-only
# disparaba un build de Vercel innecesario. `^apps/mobile/` cubre ios/, app.json,
# app.config.js, eas.json, metro.config y el resto porque todos cuelgan de ahí.
MOBILE_ONLY_PATTERNS="^apps/mobile/|^android-twa/|^\.maestro/"

# Check if ANY changed file is outside mobile-only patterns
WEB_CHANGES=$(echo "$CHANGED_FILES" | grep -vE "$MOBILE_ONLY_PATTERNS" || true)

if [ -z "$WEB_CHANGES" ]; then
  echo "::> Only mobile files changed. Skipping build."
  echo "::> Changed files: $CHANGED_FILES"
  exit 0
fi

echo "::> Web files changed. Proceeding with build."
exit 1
