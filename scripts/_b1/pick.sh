#!/usr/bin/env bash
# Dice de cada palabra si esta en el pool limpio (lista hasta B1, sin chocar
# con ningun journey de espanol). Sin base de datos: instantaneo.
P=scripts/_b1/pool-limpio.txt
for w in "$@"; do
  if grep -qxF "$w" "$P"; then echo "OK   $w"; else echo "NO   $w"; fi
done
