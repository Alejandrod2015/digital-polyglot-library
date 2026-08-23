# -*- coding: utf-8 -*-
import json, sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from defs import DEFS
asign = json.load(open("/tmp/ar_assign.json", encoding="utf-8"))
st = json.load(open("/tmp/ar_a0.json", encoding="utf-8"))
bykey = {f'{s["topic"]}#{s["slotIndex"]}': s for s in st}
out = {}
for k, ws in asign.items():
    s = bykey[k]
    parr = s["text"].split("\n\n")
    items = []
    for w, e in ws:
        t, d = DEFS[w]
        items.append({"word": w, "surface": w, "type": t, "definition": d})
    # orden por aparicion en el cuerpo, para que la distribucion se lea
    pos = {w: (s["text"].lower().find(w)) for w, _ in ws}
    items.sort(key=lambda it: pos[it["word"]])
    out[k] = items
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vocab.json"), "w"), ensure_ascii=False, indent=1)
# distribucion por parrafo de autor
for k, ws in asign.items():
    s = bykey[k]
    parr = s["text"].split("\n\n")
    cnt = []
    for p in parr:
        low = p.lower()
        cnt.append(sum(1 for w, _ in ws if re.search(r"(?<![a-zá-úñ])" + re.escape(w) + r"(?![a-zá-úñ])", low)))
    flag = "" if all(3 <= c <= 5 for c in cnt) else "  <-- FUERA DE 3-5"
    print(f"{k:34} {cnt} suma {sum(cnt)}/{len(ws)}{flag}")
