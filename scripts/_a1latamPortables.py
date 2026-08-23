# -*- coding: utf-8 -*-
"""Cuantas plazas portables reaparecen en OTRA historia, con el mismo criterio
de token que usa la escalera del gate.

DONDE VIVE `reuse`, Y DONDE NO. El campo se escribe dentro de cada entrada de
`JourneyStory.vocab`, que es una columna JSON de Postgres, y ahi se queda. NO
llega al cliente: `toPublicStory` (src/lib/journeyStories.ts:31-41) no reenvia
el vocab tal cual, reconstruye cada entrada con una lista blanca de cinco
campos (word, definition, type, register, surface) y descarta el resto. Ese es
el unico embudo hacia fuera, asi que ni el lector web ni el movil ven `reuse`.

Consecuencia para quien codifique el gate de recirculacion: hay que leerlo de
Prisma. Leido del payload del lector saldran 420 `undefined` y el gate dira que
nadie etiqueto nada. (Verificado el 2026-08-23; aviso del chat del IT A1.)"""
import json, re, sys
D = json.load(open("scripts/_a1latamStories.json", encoding="utf-8"))
ORDER = ["night-buses","rooms-and-keys","prices-and-change","calls-and-messages",
         "help-and-repairs","names-for-things","drivers-and-guides"]
D.sort(key=lambda s: (ORDER.index(s["topic"]), s["slotIndex"]))
ART = re.compile(r"^(el|la|los|las|un|una|unos|unas)\s+")
def clave(v):
    return ART.sub("", (v.get("surface") or v["word"]).lower()).strip()
toks = [set(re.findall(r"[a-zá-úñü]+", s["text"].lower())) for s in D]
fail = []
for i, s in enumerate(D):
    for v in s["vocab"]:
        if v.get("reuse") != "portable":
            continue
        k = clave(v)
        if " " in k:
            fail.append((i, v["word"], "multipalabra")); continue
        if not any(k in toks[j] for j in range(len(D)) if j != i):
            fail.append((i, v["word"], "solo aqui"))
tot = sum(1 for s in D for v in s["vocab"] if v.get("reuse") == "portable")
print(f"portables {tot} · reaparecen {tot-len(fail)} ({(tot-len(fail))*100//tot}%) · fallan {len(fail)}")
if "-v" in sys.argv:
    for i, w, why in fail:
        print(f"  {i+1:2d} {w:16s} {why}")
