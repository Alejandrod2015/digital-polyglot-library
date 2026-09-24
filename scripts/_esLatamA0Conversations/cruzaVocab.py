# -*- coding: utf-8 -*-
"""Mide el solape de vocab de los SIETE temas a la vez, en local.

El gate lo ve tema a tema (solo cruza contra lo que ya esta en la base), asi
que un choque entre el tema 3 y el 6 no aparece hasta guardar el 5. Esto lo
saca antes. Normaliza mas duro que el gate a proposito: quita el articulo,
que en espanol el gate NO quita, para que "la nota" y "nota" cuenten como la
misma plaza.
"""
import json, glob, re, sys, unicodedata

def norm(w):
    w = unicodedata.normalize("NFD", w.lower().strip())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return re.sub(r"^(el|la|los|las|un|una|unos|unas)\s+", "", w)

PLACEHOLDER = re.compile(r"used (here|again)", re.I)

hist, problemas = [], []
for p in sorted(glob.glob("scripts/_esLatamA0Conversations/tema*.json")):
    for s in json.load(open(p, encoding="utf-8")):
        hist.append(s)

vistos = {}
for s in hist:
    clave = f"{s['topic']}#{s['slotIndex']}"
    dentro = {}
    for v in s["vocab"]:
        surf = v.get("surface") or v["word"]
        k = norm(v["word"])
        d = v.get("definition", "")
        if PLACEHOLDER.search(d):
            problemas.append(f"{clave}: plaza de relleno {surf!r}")
        n = len(d.split())
        if n < 4 or n > 14:
            problemas.append(f"{clave}: definicion de {n} palabras en {surf!r}")
        if surf.lower() not in s["text"].lower():
            problemas.append(f"{clave}: {surf!r} no esta en el cuerpo")
        if k in dentro:
            problemas.append(f"{clave}: {surf!r} repetida dentro de su historia")
        dentro[k] = surf
        if k in vistos and vistos[k] != clave:
            problemas.append(f"CHOQUE: {surf!r} en {clave} ya se ensena en {vistos[k]}")
        vistos.setdefault(k, clave)
    if len(s["vocab"]) != 20:
        problemas.append(f"{clave}: {len(s['vocab'])} plazas, no 20")

print(f"{len(hist)} historias · {sum(len(s['vocab']) for s in hist)} plazas · {len(vistos)} lemas distintos")
if problemas:
    print(f"{len(problemas)} problema(s):")
    for x in problemas: print("  " + x)
    sys.exit(1)
print("sin choques ni relleno")
