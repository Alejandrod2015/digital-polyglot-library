#!/usr/bin/env python3
"""Primeras palabras: donde dice el alineador que empieza cada una frente a
donde se oye de verdad. Para ver que pasa en el arranque de la historia."""
import json, os, sys
from difflib import SequenceMatcher
sys.path.insert(0, "scripts")
import _karaokeTruth as K
K.MODEL = os.path.expanduser("~/.cache/whisper/ggml-small.bin")
WL = {"spanish": "es", "italian": "it", "german": "de"}

d, base = sys.argv[1], sys.argv[2]
doc = json.load(open(os.path.join(d, base + ".json")))
truth = K.whisper_words(os.path.join(d, base + ".mp3"), WL.get(doc.get("language", "spanish"), "es"))
idx = [w for w in doc["words"] if w.get("startSec") is not None]
a = [K.norm(w["text"]) for w in idx]
b = [K.norm(w) for w, _, _ in truth]
pares = []
for i, j, m in SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
    for k in range(m):
        pares.append((idx[i + k]["text"], idx[i + k]["startSec"], truth[j + k][1]))
print(f"{'palabra':18} {'alineador':>10} {'oida':>8} {'error':>8}")
for w, s, t in pares[:18]:
    print(f"{w[:18]:18} {s:10.2f} {t:8.2f} {s-t:+8.2f}")
print(f"\ntranscripcion whisper (primeras 25): {' '.join(w for w,_,_ in truth[:25])}")
print(f"texto guardado (primeras 25):        {' '.join(w['text'] for w in idx[:25])}")
