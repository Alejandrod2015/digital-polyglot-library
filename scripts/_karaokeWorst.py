#!/usr/bin/env python3
"""Los peores desvios con su contexto, para ver el patron en vez de adivinarlo."""
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
        pares.append((i + k, idx[i + k]["text"], idx[i + k]["startSec"], truth[j + k][1]))
peores = sorted(pares, key=lambda p: -abs(p[2] - p[3]))[:14]
print(f"{'seg':>7} {'error':>7}  contexto (la palabra desviada entre >>><<<)")
for i, w, s, t in sorted(peores, key=lambda p: p[3]):
    ctx = " ".join(x["text"] for x in idx[max(0, i - 5):i]) + f" >>>{w}<<< " + " ".join(x["text"] for x in idx[i + 1:i + 6])
    print(f"{t:7.1f} {s-t:+7.2f}  {ctx}")
