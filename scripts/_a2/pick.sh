#!/usr/bin/env bash
# OK/NO contra la pool libre del A2 (lista A1+A2 menos lo que ya ensena un
# Traveler de Espana). Sin base de datos: instantaneo.
P=scripts/_a2/pool-libre.txt
T=scripts/_a2/pool-tope2.txt
for w in "$@"; do
  if grep -qxiF "$w" "$P"; then
    if grep -qxiF "$w" "$T"; then echo "TOPE2 $w"; else echo "OK    $w"; fi
  else echo "NO    $w"; fi
done
