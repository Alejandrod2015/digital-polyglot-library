# -*- coding: utf-8 -*-
"""Escribe la capa de contexto de UNA historia sobre el bundle.

Cada entrada de byStory PISA la glosa plana entera, asi que aqui se parte de la
plana (g y t intactos) y encima van el trozo, el genero y las formas. Lo que no
se toca, se queda como estaba: el generador de conjugaciones ya paso por aqui.
"""
import json, sys
P = "src/data/tapGlosses/spanish-friends.json"

def aplica(slug, trozos, generos=None, lineas=None):
    d = json.load(open(P, encoding="utf-8"))
    plana = d["glosses"]; st = d["byStory"].setdefault(slug, {})
    faltan = [w for w in trozos if w not in plana]
    if faltan:
        print("NO estan en la glosa plana, no escribo:", faltan); sys.exit(1)
    for w, (es, en) in trozos.items():
        e = st.get(w) or {"g": plana[w]["g"], "t": plana[w]["t"]}
        e.setdefault("g", plana[w]["g"]); e.setdefault("t", plana[w]["t"])
        e["c"] = {"es": es, "en": en}
        st[w] = e
    for w, g in (generos or {}).items():
        if w in st: st[w]["gm"] = g
    for w, rows in (lineas or {}).items():
        if w in st: st[w]["f"] = {"kind": "line", "rows": rows, "here": -1}
    json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    con = sum(1 for e in st.values() if e.get("c"))
    print(f"{slug}: {con} trozos, {sum(1 for e in st.values() if e.get('f'))} con formas, {len(st)} entradas")
