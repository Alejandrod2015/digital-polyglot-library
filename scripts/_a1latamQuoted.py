# -*- coding: utf-8 -*-
"""Mide el % de habla citada por historia, que es como lo cuenta
`journey-quoted-speech-band`: palabras dentro de comillas curvas sobre el total.
Banda 25-35."""
import json, re, sys
f = sys.argv[1] if len(sys.argv) > 1 else "scripts/_a1latamV2.json"
D = json.load(open(f, encoding="utf-8"))
ORD = ["night-buses","prices-and-change","calls-and-messages","help-and-repairs",
       "names-for-things","doors-and-neighbours","plans-and-invitations"]
D.sort(key=lambda s: (ORD.index(s["topic"]), s["slotIndex"]))
fuera = 0
for i, s in enumerate(D, 1):
    w = len(s["text"].split())
    q = sum(len(x.split()) for x in re.findall(r"“[^”]*”", s["text"]))
    p = round(q * 100 / w)
    ok = 25 <= p <= 35
    fuera += 0 if ok else 1
    print(f"{i:2d} {p:>3}% {'ok ' if ok else 'FUERA'} {q:>3}/{w:>3} pal · {s['title']}")
print(f"\nfuera de banda: {fuera}/{len(D)}")
