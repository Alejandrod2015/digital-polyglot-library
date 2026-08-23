# -*- coding: utf-8 -*-
"""Cuantas plazas portables reaparecen en OTRA historia, con el mismo criterio
de token que usa la escalera del gate."""
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
