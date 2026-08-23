# -*- coding: utf-8 -*-
"""Vuelca cada glosa HEREDADA (copiada de un paquete hermano, no escrita a mano
aqui) junto a la frase de ESTE journey donde cae, para leerlas una a una.

Existe porque rebuildTapGlosses copia por PALABRA y no mira la oracion: arrastra
el sentido que la palabra tenia en el journey de origen. El informe dice "al
dia" igual, porque comprueba que HAYA glosa, no que sea la correcta.
Uso: python3 scripts/_a1latamGlossRead.py [desde] [hasta]"""
import json, re, sys
b = json.load(open("src/data/tapGlosses/spanish-traveler-latam.json", encoding="utf-8"))["glosses"]
D = json.load(open("scripts/_a1latamStories.json", encoding="utf-8"))
mano = set(json.load(open("scripts/_newGlosses.json", encoding="utf-8"))["spanish-traveler-latam"])
frases = []
for s in D:
    for f in re.split(r"(?<=[.!?”])\s+", s["text"].replace("\n", " ")):
        if f.strip(): frases.append(f.strip())
donde = {}
for f in frases:
    for w in set(re.findall(r"[a-zá-úñü]+", f.lower())):
        donde.setdefault(w, f)
pal = sorted(w for w in donde if w in b and w not in mano)
a = int(sys.argv[1]) if len(sys.argv) > 1 else 0
z = int(sys.argv[2]) if len(sys.argv) > 2 else len(pal)
print(f"{len(pal)} heredadas · mostrando {a}-{min(z,len(pal))}")
for w in pal[a:z]:
    g = b[w]["g"] if isinstance(b[w], dict) else str(b[w])
    print(f"{w:14s} | {g[:44]:44s} | {donde[w][:78]}")
