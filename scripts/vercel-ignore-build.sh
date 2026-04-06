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
#    Compare against the previous deployment commit
CHANGED_FILES=$(git diff HEAD~1 --name-only 2>/dev/null || echo "UNKNOWN")

if [ "$CHANGED_FILES" = "UNKNOWN" ]; then
  echo "::> Could not determine changed files. Proceeding with build."
  exit 1
fi

# Directories/patterns that are mobile-only (don't affect the web app)
MOBILE_ONLY_PATTERNS="^mobile/|^android-twa/|^\.maestro/|^ios/|^\.easignore|^eas\.json|^app\.json|^app\.config\.|^expo-|^metro\.config"

# Check if ANY changed file is outside mobile-only patterns
WEB_CHANGES=$(echo "$CHANGED_FILES" | grep -vE "$MOBILE_ONLY_PATTERNS" || true)

if [ -z "$WEB_CHANGES" ]; then
  echo "::> Only mobile files changed. Skipping build."
  echo "::> Changed files: $CHANGED_FILES"
  exit 0
fi

echo "::> Web files changed. Proceeding with build."
exit 1
