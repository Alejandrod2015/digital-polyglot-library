#!/usr/bin/env python3
"""Score EVERY stored payload against the whisper ruler and write one row per
story, so we know which ones reach the approved bar and which cannot.

Also reports the text/audio word-count ratio, which is what separates "the
aligner did badly" from "the stored text is not what the audio says" (no
aligner can fix the latter).

  python3 scripts/_karaokeFullScore.py <dumpDir> <out.json>

The dump dir is produced by _dumpTimings.ts / _dumpCatalogTimings.ts.
"""
import json
import os
import sys
from difflib import SequenceMatcher
from statistics import mean, median

sys.path.insert(0, "scripts")
import _karaokeTruth as K  # noqa: E402

K.MODEL = os.path.expanduser("~/.cache/whisper/ggml-small.bin")
WL = {"spanish": "es", "german": "de", "italian": "it",
      "portuguese": "pt", "french": "fr", "english": "en"}


def score(doc, mp3):
    lang = WL.get(doc.get("language", "spanish"), "es")
    truth = K.whisper_words(mp3, lang)
    idx = [w for w in doc["words"] if w.get("startSec") is not None]
    if not idx or not truth:
        return None
    a = [K.norm(w["text"]) for w in idx]
    b = [K.norm(w) for w, _, _ in truth]
    errs = []
    for i, j, n in SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(n):
            errs.append(idx[i + k]["startSec"] - truth[j + k][1])
    if not errs:
        return None
    av = sorted(abs(e) for e in errs)
    return {
        "slug": doc["slug"],
        "language": doc.get("language"),
        "storedWords": len(idx),
        "heardWords": len(truth),
        "ratio": round(len(truth) / max(1, len(idx)), 2),
        "matched": len(errs),
        "medianAbsSec": round(median(av), 3),
        "p90AbsSec": round(av[int(0.9 * (len(av) - 1))], 3),
        "within150ms": round(sum(1 for v in av if v <= 0.15) / len(av), 3),
        "within300ms": round(sum(1 for v in av if v <= 0.30) / len(av), 3),
    }


def main():
    src, out = sys.argv[1], sys.argv[2]
    rows = []
    files = sorted(f for f in os.listdir(src) if f.endswith(".json") and not f.startswith("_"))
    for n, f in enumerate(files, 1):
        slug = f[:-5]
        mp3 = os.path.join(src, slug + ".mp3")
        if not os.path.exists(mp3):
            continue
        try:
            r = score(json.load(open(os.path.join(src, f))), mp3)
        except Exception as exc:  # keep going; one bad file must not kill the run
            print(f"[{n}/{len(files)}] {slug} ERROR {exc}", flush=True)
            continue
        if not r:
            continue
        rows.append(r)
        print(f"[{n}/{len(files)}] {slug:<46} med={r['medianAbsSec']:.3f} "
              f"<300ms={100*r['within300ms']:.0f}% ratio={r['ratio']}", flush=True)
        json.dump(rows, open(out, "w"), indent=2)
    print(f"\nlistas: {len(rows)}")


if __name__ == "__main__":
    main()
