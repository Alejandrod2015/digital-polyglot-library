#!/bin/bash
# Una tirada por portada, gate de rubor, y descarga local. NO sube ni pone
# nada: la portada se mira a tamaño completo antes de ponerla viva.
cd /Users/alejandrodelcarpio/digital-polyglot-library
SC="$1"; shift
for slug in "$@"; do
  ID=$(npx tsx --conditions react-server -e "
import { config } from 'dotenv'; config({ path: '.env.local', quiet: true });
import { PrismaClient } from './src/generated/prisma';
const p = new PrismaClient();
p.journeyStory.findFirst({ where: { slug: '$slug' }, select: { id: true } }).then((r) => { console.log(r?.id); p.\$disconnect(); });")
  URL=$(NODE_OPTIONS="--conditions=react-server -r dotenv/config" DOTENV_CONFIG_PATH=.env.local npx tsx scripts/generateCover.ts "$ID" "$SC/scenes/$slug.txt" 2>&1 | grep "^URL:" | cut -d' ' -f2)
  if [ -z "$URL" ]; then echo "$slug FALLO generacion"; continue; fi
  curl -s -o "$SC/out-$slug.png" "$URL"
  G=$(.venv-cv/bin/python scripts/_coverGate.py "$SC/out-$slug.png" 2>&1 | tail -1)
  echo "$slug|$URL|$G"
done
