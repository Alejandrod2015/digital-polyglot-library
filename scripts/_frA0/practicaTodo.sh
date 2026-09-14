#!/bin/bash
# Genera el audio de PRACTICA del Friends FR A0 entero: los clips de palabra de
# los meaning_in_context y los de frase de los fill_blank, para las 21
# historias. El usuario lo pidio con el verbo el 2026-09-12.
#
# Los dos generadores se saltan solos lo que ya tiene URL (sin --force), asi
# que este guion se puede relanzar tras un corte sin repetir ni pagar nada dos
# veces. NO se para al primer fallo a proposito (sin `set -e` en el bucle): un
# clip que no pasa el gate F0 tras 6 tomas se reporta y la tanda sigue; pararla
# entera por una palabra dejaria 335 a medias.
#
# DPL_AUDIO_FULL_OK=1: el guard 6d mira el CONTENIDO del .ts y estos dos llevan
# el endpoint de sintesis. Aqui el entregable ES este audio y el usuario lo
# pidio explicitamente, que es la condicion que la regla exige para el opt-in.
#
#   bash scripts/_frA0/practicaTodo.sh
set -uo pipefail
cd "$(dirname "$0")/../.."

SLUGS=(
  une-boule-sous-le-platane deux-carreaux-pour-hugo si-je-gagne-tu-restes
  theo-ecoute-pour-lea la-ligne-coupe-apres-hugo le-torchon-a-la-main
  le-fauteuil-descend mille-euros-sans-compter une-goutte-chaque-nuit
  tu-prends-la-carte vingt-minutes-c-est-long les-mots-a-l-envers
  la-boule-porte-bonheur trente-trois-bougies a-toi-la-boule
  l-annonce-du-couloir une-plante-pour-lea des-pas-au-dessus
  a-samedi-hugo clara-tient-la-boule treize-comme-avant
)

fallos=0
for slug in "${SLUGS[@]}"; do
  echo "=== $slug"
  DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genWordClips.ts "$slug" || { echo "!!! palabra fallo en $slug"; fallos=$((fallos + 1)); }
  DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genFillBlankClips.ts "$slug" || { echo "!!! frase fallo en $slug"; fallos=$((fallos + 1)); }
done
echo "=== FIN: $fallos pasadas con fallo de $(( ${#SLUGS[@]} * 2 ))"
