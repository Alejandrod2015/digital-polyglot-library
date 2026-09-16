set -u
cd "$(dirname "$0")/.."
SLUGS="une-vitrine-trop-chic le-compteur-ne-ment-pas la-tournee-jamais-offerte reponse-avant-vendredi un-carton-sous-le-bras rendez-vous-sous-la-bourse samedi-deux-promesses une-verite-trop-tard trente-mille-euros un-seul-nom-sur-le-contrat deux-cents-euros-par-mois une-photo-pour-le-journal son-nom-n-y-est-pas derriere-la-cloison ce-qu-on-raconte-a-fives une-blague-mal-repetee des-comptes-bien-tenus des-mains-qui-tremblent endormie-contre-l-etabli cinq-cents-prospectus"
for s in $SLUGS; do
  echo "############ $s ############"
  echo "--- frases ---"
  DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genPracticeClips.ts "$s" --featured || { echo "FALLO frases $s"; exit 1; }
  echo "--- sembrar ---"
  npx tsx scripts/_seedAllSets.ts --only="$s" --apply || { echo "FALLO seed $s"; exit 1; }
  echo "--- palabras ---"
  DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genWordClips.ts "$s" || { echo "FALLO palabras $s"; exit 1; }
  rm -f public/_practice-clips/*.mp3 public/_practice-clips-*.html
  echo "=== $s OK ==="
done
echo "TANDA COMPLETA"
