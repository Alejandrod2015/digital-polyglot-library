#!/usr/bin/env python3
"""Ground-truth karaoke accuracy: compare stored word timings against
whisper.cpp word timestamps (DTW), word by word.

The stored timings only ever drive the highlight through `startSec`, so
that is the only field measured here: for every word the reader will light
up, how far (in seconds) is the stored start from the moment the narrator
actually says it?  Positive = the highlight fires LATE.

Usage:
  python3 scripts/_karaokeTruth.py <dir-with-slug.json+slug.mp3> [--model ...]
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from difflib import SequenceMatcher
from statistics import mean, median

MODEL = os.path.expanduser("~/.cache/whisper/ggml-base.bin")
WHISPER_LANG = {
    "spanish": "es", "german": "de", "italian": "it",
    "portuguese": "pt", "french": "fr", "english": "en",
}


def norm(w: str) -> str:
    return re.sub(r"[^0-9a-zá-úäöüßàèéìòùñçâêîôûëïœ]", "", w.lower())


def dtw_preset() -> str:
    """whisper.cpp needs the alignment-head preset that MATCHES the model;
    passing `--dtw base` to a small model silently yields garbage timings."""
    name = os.path.basename(MODEL)
    for p in ("tiny", "base", "small", "medium", "large"):
        if f"-{p}" in name:
            return p + (".en" if ".en" in name else "")
    return "base"


def whisper_words(mp3: str, lang: str):
    """Run whisper.cpp with DTW + one-token segments, merge subword tokens
    back into words, return [(word, startSec, endSec)]."""
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "a.wav")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", mp3, "-ar", "16000", "-ac", "1",
             "-c:a", "pcm_s16le", wav, "-y"], check=True)
        out = os.path.join(td, "a")
        subprocess.run(
            ["whisper-cli", "-m", MODEL, "-l", lang, "-np", "-ml", "1",
             "--dtw", dtw_preset(), "-ojf", "-of", out, wav],
            check=True, capture_output=True)
        # whisper.cpp can split a multibyte char across tokens, leaving an
        # invalid byte in the JSON; drop those bytes instead of failing.
        with open(out + ".json", "rb") as fh:
            data = json.loads(fh.read().decode("utf-8", errors="replace"))

    words = []
    for seg in data["transcription"]:
        raw = seg["text"]
        if not raw.strip():
            continue
        start = seg["offsets"]["from"] / 1000.0
        end = seg["offsets"]["to"] / 1000.0
        # whisper.cpp marks a new word with a leading space on the token.
        if raw.startswith(" ") or not words:
            words.append([raw.strip(), start, end])
        else:
            words[-1][0] += raw.strip()
            words[-1][2] = end
    return [(w, s, e) for w, s, e in words if norm(w)]


def analyse(path_json: str, path_mp3: str):
    doc = json.load(open(path_json))
    lang = WHISPER_LANG.get(doc["language"], "es")
    stored = [w for w in doc["words"] if w.get("startSec") is not None]
    truth = whisper_words(path_mp3, lang)

    a = [norm(w["text"]) for w in stored]
    b = [norm(w) for w, _, _ in truth]
    sm = SequenceMatcher(a=a, b=b, autojunk=False)

    errs = []          # (storedStart, signedError)
    for i, j, n in sm.get_matching_blocks():
        for k in range(n):
            s = stored[i + k]["startSec"]
            t = truth[j + k][1]
            errs.append((s, s - t))

    matched = len(errs)
    if matched == 0:
        return None
    signed = [e for _, e in errs]
    absv = sorted(abs(e) for e in signed)
    p = lambda q: absv[min(len(absv) - 1, int(q * (len(absv) - 1)))]
    within = lambda th: sum(1 for v in absv if v <= th) / len(absv)

    # Where in the sentence does the error live?  Bucket by how far the word
    # is from the previous pause (>=0.3 s gap in the ground truth).
    gaps = []
    prev_end = None
    for w, s, e in truth:
        gaps.append(prev_end is not None and s - prev_end >= 0.3)
        prev_end = e

    return {
        "slug": doc["slug"],
        "lang": doc["language"],
        "variant": doc.get("variant"),
        "storedWords": len(stored),
        "truthWords": len(truth),
        "matched": matched,
        "matchRate": round(matched / max(len(stored), 1), 3),
        "meanSignedSec": round(mean(signed), 3),
        "medianAbsSec": round(median(absv), 3),
        "p90AbsSec": round(p(0.9), 3),
        "maxAbsSec": round(absv[-1], 3),
        "pctWithin150ms": round(within(0.15), 3),
        "pctWithin300ms": round(within(0.30), 3),
        "worst": sorted(
            [{"atSec": round(s, 2), "errSec": round(e, 2)} for s, e in errs],
            key=lambda d: -abs(d["errSec"]))[:5],
    }


def main():
    global MODEL
    d = sys.argv[1]
    if "--model" in sys.argv:
        MODEL = os.path.expanduser(sys.argv[sys.argv.index("--model") + 1])
    rows = []
    for f in sorted(os.listdir(d)):
        if not f.endswith(".json"):
            continue
        slug = f[:-5]
        mp3 = os.path.join(d, slug + ".mp3")
        if not os.path.exists(mp3):
            continue
        r = analyse(os.path.join(d, f), mp3)
        if not r:
            continue
        rows.append(r)
        print(f"{r['slug']:<28} match={r['matchRate']:<5} "
              f"signed={r['meanSignedSec']:+.3f}s  |err| med={r['medianAbsSec']:.3f}s "
              f"p90={r['p90AbsSec']:.3f}s max={r['maxAbsSec']:.3f}s  "
              f"<=150ms {r['pctWithin150ms']*100:.0f}%  <=300ms {r['pctWithin300ms']*100:.0f}%")

    if rows:
        print("\nAGGREGATE over %d stories" % len(rows))
        print("  mean signed error : %+.3f s" % mean(r["meanSignedSec"] for r in rows))
        print("  median |err|      : %.3f s" % mean(r["medianAbsSec"] for r in rows))
        print("  p90 |err|         : %.3f s" % mean(r["p90AbsSec"] for r in rows))
        print("  words within 150ms: %.1f%%" % (100 * mean(r["pctWithin150ms"] for r in rows)))
        print("  words within 300ms: %.1f%%" % (100 * mean(r["pctWithin300ms"] for r in rows)))
    out = os.path.join(d, "_truth.json")
    json.dump(rows, open(out, "w"), indent=2)
    print("\nwrote", out)


if __name__ == "__main__":
    main()
