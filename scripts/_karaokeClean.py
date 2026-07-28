#!/usr/bin/env python3
"""Puntua descartando las marcas degeneradas de la regla.

whisper.cpp a veces colapsa varias palabras seguidas en un mismo instante
(ocho palabras a 5,00 s en la-leyenda-de-la-llorona). Ahi la verdad de
referencia no existe, y medir contra ella inventa errores de segundos. Esto
puntua dos veces: con todo, y descartando los tramos donde la regla se repite.

  python3 scripts/_karaokeClean.py <dir>
"""
import json, os, sys
from collections import Counter
from difflib import SequenceMatcher
from statistics import median

sys.path.insert(0, "scripts")
import _karaokeTruth as K
K.MODEL = os.path.expanduser("~/.cache/whisper/ggml-small.bin")
WL = {"spanish": "es", "italian": "it", "german": "de", "portuguese": "pt", "french": "fr", "english": "en"}

d = sys.argv[1]
print(f"{'historia':38} {'pares':>6} {'degen':>6} {'medTodo':>8} {'medLimpio':>10} {'<300ms':>7}")
for f in sorted(x for x in os.listdir(d) if x.endswith(".json") and not x.startswith("_")):
    doc = json.load(open(os.path.join(d, f)))
    mp3 = os.path.join(d, f[:-5] + ".mp3")
    if not os.path.exists(mp3):
        continue
    truth = K.whisper_words(mp3, WL.get(doc.get("language", "spanish"), "es"))
    idx = [w for w in doc["words"] if w.get("startSec") is not None]
    a = [K.norm(w["text"]) for w in idx]
    b = [K.norm(w) for w, _, _ in truth]
    pares = []
    for i, j, m in SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(m):
            pares.append((truth[j + k][1], idx[i + k]["startSec"] - truth[j + k][1]))
    if not pares:
        continue
    # Marca degenerada: instante que la regla repite en 3+ palabras.
    repes = {t for t, n in Counter(t for t, _ in pares).items() if n >= 3}
    limpio = [e for t, e in pares if t not in repes]
    degen = len(pares) - len(limpio)
    m_todo = median(abs(e) for _, e in pares)
    m_limpio = median(abs(e) for e in limpio) if limpio else float("nan")
    p300 = sum(1 for e in limpio if abs(e) <= 0.3) / len(limpio) if limpio else 0
    print(f"{f[:-5]:38} {len(pares):6} {degen:6} {m_todo:8.3f} {m_limpio:10.3f} {p300*100:6.0f}%")
