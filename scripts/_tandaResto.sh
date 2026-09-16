set -u
cd "$(dirname "$0")/.."
SLUGS="une-blague-mal-repetee des-comptes-bien-tenus des-mains-qui-tremblent endormie-contre-l-etabli cinq-cents-prospectus"
run3() { # reintenta 3 veces: los cortes de Neon son transitorios
  for i in 1 2 3; do "$@" && return 0; echo "  (reintento $i de: $*)"; sleep 10; done
  return 1
}
for s in $SLUGS; do
  echo "############ $s ############"
  echo "--- frases ---"
  run3 env DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genPracticeClips.ts "$s" --featured || { echo "FALLO frases $s"; exit 1; }
  echo "--- sembrar ---"
  run3 npx tsx scripts/_seedAllSets.ts --only="$s" --apply || { echo "FALLO seed $s"; exit 1; }
  echo "--- palabras ---"
  run3 env DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genWordClips.ts "$s" || { echo "FALLO palabras $s"; exit 1; }
  rm -f public/_practice-clips/*.mp3 public/_practice-clips-*.html
  # una historia NO es "OK" si el generador dejo huecos: se marca PARCIAL
  if npx tsx scripts/_coberturaFrB1.ts | grep -q "^  ok  $s "; then echo "=== $s OK ==="; else echo "=== $s PARCIAL ==="; fi
done
echo "TANDA RESTO COMPLETA"
