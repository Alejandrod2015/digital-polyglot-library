#!/usr/bin/env python3
"""Prueba si los tiempos estan asignados a la palabra EQUIVOCADA.

Si el alineador acierta pero el remapeo posterior corre los tiempos N tokens,
el sintoma es identico a "todo va tarde". Esto mide el error aplicando
desplazamientos de -4 a +4 tokens: si alguno baja mucho el error, la averia es
de indice, no de alineacion.

  python3 scripts/_karaokeDesplaz.py <dir> <base>
"""
import json, os, sys
from difflib import SequenceMatcher
from statistics import median
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
# Emparejamiento por identidad, una sola vez.
pares = []
for i, j, m in SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
    for k in range(m):
        pares.append((i + k, truth[j + k][1]))

print(f"{'desplazamiento':>15} {'medianaAbs':>11} {'<=300ms':>8}")
for s in range(-4, 5):
    errs = []
    for i, t in pares:
        j = i + s
        if 0 <= j < len(idx):
            errs.append(idx[j]["startSec"] - t)
    if not errs:
        continue
    m = median(abs(e) for e in errs)
    p = sum(1 for e in errs if abs(e) <= 0.3) / len(errs)
    marca = "   <-- mejor" if s != 0 and m < 0.9 * median(abs(idx[i]["startSec"] - t) for i, t in pares) else ""
    print(f"{s:>15} {m:11.3f} {p*100:7.0f}%{marca}")
