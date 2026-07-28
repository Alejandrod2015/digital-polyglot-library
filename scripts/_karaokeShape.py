#!/usr/bin/env python3
"""Forma del error a lo largo de la historia.

Un desfase CONSTANTE y un desajuste que nace al principio y se va corrigiendo
dan la misma mediana, pero son averias distintas y se arreglan distinto. Esto
parte la historia en tramos y da la mediana CON SIGNO de cada uno.

  python3 scripts/_karaokeShape.py <dir> [--tramos N]
"""
import json, os, sys
from difflib import SequenceMatcher
from statistics import median

sys.path.insert(0, "scripts")
import _karaokeTruth as K

K.MODEL = os.path.expanduser("~/.cache/whisper/ggml-small.bin")
WL = {"spanish": "es", "german": "de", "italian": "it",
      "portuguese": "pt", "french": "fr", "english": "en"}


def main():
    d = sys.argv[1]
    n = int(sys.argv[sys.argv.index("--tramos") + 1]) if "--tramos" in sys.argv else 8
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
        pares.sort()
        dur = pares[-1][0]
        tramos = []
        for t in range(n):
            lo, hi = dur * t / n, dur * (t + 1) / n
            xs = [e for tt, e in pares if lo <= tt < hi]
            tramos.append(median(xs) if xs else float("nan"))
        print(f"{f[:-5]:36} dur={dur:6.0f}s  " + " ".join(f"{x:+.2f}" for x in tramos))


main()
