#!/usr/bin/env python3
"""Dice que palabras de una lista siguen LIBRES contra los 2.324 lemas que ya
ensena algun Traveler de espanol. Normaliza igual que `vocab-taught-same-type`:
minusculas y sin tildes. Uso: python3 scripts/_b1Libres.py fichero.txt"""
import sys, unicodedata

def norm(s):
    s = unicodedata.normalize("NFD", s.lower().strip())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")

taught = set()
with open("/tmp/traveler-es-lemas-ensenados.tsv", encoding="utf-8") as f:
    next(f)
    for line in f:
        p = line.rstrip("\n").split("\t")
        if p and p[0].strip():
            taught.add(norm(p[0]))

cands = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
libres = [c for c in cands if norm(c) not in taught]
ocup = [c for c in cands if norm(c) in taught]
print("LIBRES (%d):\n  %s\n" % (len(libres), ", ".join(libres)))
print("YA ENSENADAS (%d):\n  %s" % (len(ocup), ", ".join(ocup)))
