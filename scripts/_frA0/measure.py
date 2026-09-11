"""Mide un fichero de historias A0 contra la vara externa (mediana ~6 palabras
por frase, la demo aprobada del jambu), no contra el techo del validador.

  python3 scripts/_frA0/measure.py scripts/_frA0/t1.json
"""
import json, re, statistics, sys

WORD = re.compile(r"[A-Za-zÀ-ÿœŒ'’-]+")

def sentences(text):
    t = text.replace("\n", " ")
    parts = re.split(r"(?<=[.!?:])\s+|(?<=[.!?]”)\s+", t)
    out = []
    for p in parts:
        w = WORD.findall(p)
        if w:
            out.append(len(w))
    return out

stories = json.load(open(sys.argv[1]))
if len(sys.argv) > 2:
    # textos nuevos aparte, para no reescribir el JSON de vocab a mano
    nuevos = json.load(open(sys.argv[2]))
    for s in stories:
        if str(s["slotIndex"]) in nuevos:
            s["text"] = nuevos[str(s["slotIndex"])]
    json.dump(stories, open(sys.argv[1], "w"), ensure_ascii=False, indent=2)

from collections import Counter
acot = Counter()
for s in stories:
    acot.update(re.findall(r"”,\s+(\w+)", s["text"]))
tot = sum(acot.values())
print("acotaciones del tema:", dict(acot), "· dominante", f"{round(100*max(acot.values())/tot)}%" if tot else "-")

for s in stories:
    text = s["text"]
    lens = sentences(text)
    words = len(WORD.findall(text))
    quoted = sum(len(WORD.findall(q)) for q in re.findall(r"“([^”]*)”", text))
    paras = text.split("\n\n")
    per = []
    low = text.lower()
    def first(sf):
        m = re.search(r"(?<![\wÀ-ÿ])" + re.escape(sf.lower()) + r"(?![\wÀ-ÿ])", low)
        return m.start() if m else -1
    firsts = {v["surface"]: first(v["surface"]) for v in s["vocab"]}
    missing = [k for k, i in firsts.items() if i < 0]
    bounds, acc = [], 0
    for p in paras:
        bounds.append((acc, acc + len(p)))
        acc += len(p) + 2
    for a, b in bounds:
        per.append(sum(1 for i in firsts.values() if a <= i < b))
    print(f"{s['slotIndex']} {s['title']!r} ({len(s['title'])} car.)")
    print(f"   palabras {words} · frases {len(lens)} · mediana {statistics.median(lens)} · max {max(lens)} · citado {round(100*quoted/words)}%")
    print(f"   plazas {len(s['vocab'])} (ancladas {sum(1 for v in s['vocab'] if v.get('anchor'))}) · por parrafo {per}" + (f" · FALTAN {missing}" if missing else ""))
    print(f"   sinopsis {len(WORD.findall(s['synopsis']))} palabras")
    t = text.replace("\n", " ")
    frs = [f for f in re.split(r"(?<=[.!?:])\s+|(?<=[.!?]”)\s+", t) if WORD.findall(f)]
    larga = max(frs, key=lambda f: len(WORD.findall(f)))
    if len(WORD.findall(larga)) > 9:
        print(f"   frase larga ({len(WORD.findall(larga))}): {larga}")
