#!/bin/bash
# Genera + pacea el audio de todas las historias de Friends que aún no tienen.
# GATED (ElevenLabs). Cada historia: _genFriendsStoryAudio (por párrafo) -> normalizeAudioPace --apply 2.8
set -e
SLUGS=(
 rodrigo-se-lo-busco itzel-no-sabe-nada cafe-y-pan-de-yema
 marina-llega-con-visaje la-lengua-de-julian el-domingo-se-arregla
 el-corte-nuevo-de-andres andres-en-la-pista llega-el-guachiman
 camila-no-da-mas el-psicologo-de-la-barra el-mismo-chabon
 pilar-no-entiende-nada almuerzo-en-el-jato la-chibola-nos-supero
 todo-es-weon el-carrete-del-sabado el-asado-a-la-orilla
)
for s in "${SLUGS[@]}"; do
  echo "=== $s ==="
  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_genFriendsStoryAudio.ts "$s" || { echo "GEN FALLO $s"; continue; }
  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/normalizeAudioPace.ts --apply 2.8 "$s" || echo "PACE FALLO $s"
done
echo "=== LISTO ==="
