#!/usr/bin/env python3
"""Puntua ignorando los primeros N segundos.

El narrador LEE el titulo, pero el titulo no esta en el texto guardado (solo se
antepone para alinear y luego se descarta). whisper, ademas, se lo come en la
transcripcion del fichero completo y arranca su linea de tiempo en el, asi que
en la apertura la regla no vale. Esto mide el resto de la historia, donde si
vale, y lo compara con un control medido igual.

  python3 scripts/_karaokeDesde.py <dir> <segundos>
"""
import json, os, sys
from difflib import SequenceMatcher
from statistics import median
sys.path.insert(0, "scripts")
import _karaokeTruth as K
K.MODEL = os.path.expanduser("~/.cache/whisper/ggml-small.bin")
WL = {"spanish": "es", "italian": "it", "german": "de"}

d, desde = sys.argv[1], float(sys.argv[2])
print(f"{'historia':34} {'todo':>7} {'desde '+str(int(desde))+'s':>10} {'<300ms':>8} {'pares':>7}")
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
    resto = [e for t, e in pares if t >= desde]
    todo = median(abs(e) for _, e in pares)
    r = median(abs(e) for e in resto) if resto else float("nan")
    p300 = sum(1 for e in resto if abs(e) <= 0.3) / len(resto) if resto else 0
    print(f"{f[:-5]:34} {todo:7.3f} {r:10.3f} {p300*100:7.0f}% {len(resto):7}")
