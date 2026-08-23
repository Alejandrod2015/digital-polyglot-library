set -e
out=scripts/_b1/todas.tsv
: > "$out"
for n in german-expat german-friends german-hamburg german-traveler-a0 \
         italian-friends-a0 italian-traveler-a0 \
         spanish-friends-argentina spanish-friends-colombia spanish-friends-mexico \
         spanish-friends-spain-a0 spanish-friends spanish-traveler-latam spanish-traveler-mexico-a0; do
  npx tsx scripts/reviewCopiedGlosses.ts "$n" --tsv 2>/dev/null | sed "s/^/$n\t/" >> "$out"
done
wc -l "$out"
