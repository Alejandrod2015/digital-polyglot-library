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

# 2. Determinar la BASE: el commit que esta VIVO en produccion ahora mismo.
#
# Historia: esto comparaba contra HEAD~1, o sea solo el ultimo commit. El
# 2026-07-30 un push de 15 commits que TERMINABA en un bump de version movil se
# salto el build entero (el script solo vio "apps/mobile/app.json"), dejando sin
# desplegar cambios de `src/`, entre ellos src/lib/karaokeWordWindows.ts. El
# sintoma es peor que un fallo, porque el deploy sale "skipped" y se lee como
# exito.
#
# Vercel no expone al Ignored Build Step el commit del ultimo deploy, pero la
# propia app SI lo publica: /api/version devuelve VERCEL_GIT_COMMIT_SHA con
# Cache-Control no-store. Preguntamos ahi, que es la fuente de verdad exacta de
# lo que sirve produccion, y no hace falta ningun token.
#
# Ante CUALQUIER duda se construye. Saltarse un build de mas cuesta dinero;
# saltarse uno necesario deja produccion vieja en silencio, que es peor.
VERSION_URL="${IGNORE_BUILD_VERSION_URL:-https://reader.digitalpolyglot.com/api/version}"
BASE=""

DEPLOYED_SHA=$(curl -fsS --max-time 15 "$VERSION_URL" 2>/dev/null \
  | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{7,40\}\)".*/\1/p')

if [ -z "$DEPLOYED_SHA" ]; then
  echo "::> No pude leer el commit desplegado en $VERSION_URL. Construyo por seguridad."
  exit 1
fi
echo "::> Commit vivo en produccion: $DEPLOYED_SHA"

if [ "$DEPLOYED_SHA" = "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "::> Produccion ya sirve este commit. Nada que desplegar."
  exit 0
fi

# El clone de Vercel es shallow, asi que el commit desplegado puede no estar en
# local. Lo traemos; si no se puede, construimos.
if ! git cat-file -e "${DEPLOYED_SHA}^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=100 origin main 2>/dev/null || true
  if ! git cat-file -e "${DEPLOYED_SHA}^{commit}" 2>/dev/null; then
    git fetch --quiet origin "$DEPLOYED_SHA" 2>/dev/null || true
  fi
fi
if ! git cat-file -e "${DEPLOYED_SHA}^{commit}" 2>/dev/null; then
  echo "::> El commit desplegado no esta en este clone. Construyo por seguridad."
  exit 1
fi

# Si lo desplegado NO es ancestro de HEAD (rollback, force-push, rama divergente)
# el diff no describe "lo que falta por desplegar". Construimos.
if ! git merge-base --is-ancestor "$DEPLOYED_SHA" HEAD 2>/dev/null; then
  echo "::> Lo desplegado no es ancestro de HEAD (rollback o divergencia). Construyo."
  exit 1
fi

BASE="$DEPLOYED_SHA"
echo "::> Comparando $BASE..HEAD"
CHANGED_FILES=$(git diff "$BASE" HEAD --name-only 2>/dev/null || echo "UNKNOWN")

if [ "$CHANGED_FILES" = "UNKNOWN" ] || [ -z "$CHANGED_FILES" ]; then
  echo "::> No pude determinar los archivos cambiados. Construyo por seguridad."
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
