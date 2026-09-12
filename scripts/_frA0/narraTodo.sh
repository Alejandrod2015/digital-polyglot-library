#!/bin/bash
# Narra el Friends FR A0 entero, tema por tema y en orden, con Aurore.
# El usuario aprobo la muestra del tema 1 y pidio el resto de una tirada
# (2026-09-12), asi que las escuchas intermedias de la regla de narracion las
# hizo una sola vez; los candados del codigo se respetan tal cual:
#   - cada tema necesita su muestra registrada (a2-muestras.json) antes de su
#     primera historia; si falta, este guion la genera;
#   - las historias 2 y 3 solo salen cuando la primera del tema tiene audio.
# Se para en seco al primer fallo. No rehace audio existente (sin --rehacer).
#   bash scripts/_frA0/narraTodo.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export NODE_OPTIONS="--conditions=react-server"

TEMAS=(
  "une-boule-sous-le-platane deux-carreaux-pour-hugo si-je-gagne-tu-restes"
  "theo-ecoute-pour-lea la-ligne-coupe-apres-hugo le-torchon-a-la-main"
  "le-fauteuil-descend mille-euros-sans-compter une-goutte-chaque-nuit"
  "tu-prends-la-carte vingt-minutes-c-est-long les-mots-a-l-envers"
  "la-boule-porte-bonheur trente-trois-bougies a-toi-la-boule"
  "l-annonce-du-couloir une-plante-pour-lea des-pas-au-dessus"
  "a-samedi-hugo clara-tient-la-boule treize-comme-avant"
)

for i in "${!TEMAS[@]}"; do
  read -r -a HIST <<< "${TEMAS[$i]}"
  primera="${HIST[0]}"
  echo "=== TEMA $((i + 1)) · $primera"
  if ! python3 -c "import json,sys; d=json.load(open('scripts/a2-muestras.json')); sys.exit(0 if '$primera' in d else 1)"; then
    echo "--- muestra de $primera"
    npx tsx scripts/_muestraA2Titulo.ts "$primera" --journey fr-a0
  else
    echo "--- muestra de $primera: ya registrada"
  fi
  for slug in "${HIST[@]}"; do
    echo "--- narrando $slug"
    DPL_AUDIO_FULL_OK=1 npx tsx scripts/_narraUnaA2.ts "$slug" --journey fr-a0
  done
done
echo "=== LISTO: 21 historias"
