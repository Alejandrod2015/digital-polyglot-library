#!/usr/bin/env python3
"""Is the text/audio mismatch real, or an artefact of the whisper ruler?

Whisper can hallucinate or loop, which would inflate the "words heard" count
and fake a mismatch. This check never runs STT: it measures how many seconds
the narrator actually SPEAKS (audio duration minus detected silence) and
compares that with how long the stored text should take at the rate the
healthy library is narrated at.

A story whose speech time is far longer than its text can account for really
does contain narration that is not in the text. One whose speech time matches
was a false alarm.

  python3 scripts/_karaokeVerifyMismatch.py <dumpDir> <slug> [slug...]
"""
import json
import os
import re
import subprocess
import sys


def duration(mp3):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", mp3], capture_output=True, text=True).stdout
    return float(out.strip())


def silence_seconds(mp3, thr=-35, mind=0.15):
    """Total silent time, walking a threshold ladder so an ambient bed does not
    read as 'no silence at all'."""
    for db in (thr, -30, -27, -24):
        p = subprocess.run(
            ["ffmpeg", "-hide_banner", "-nostats", "-i", mp3, "-af",
             f"silencedetect=noise={db}dB:duration={mind}", "-f", "null", "-"],
            capture_output=True, text=True)
        durs = [float(x) for x in re.findall(r"silence_duration:\s*([\d.]+)", p.stderr)]
        if durs:
            return sum(durs), db
    return 0.0, thr


def main():
    src = sys.argv[1]
    slugs = sys.argv[2:]
    print(f"{'historia':<36}{'audio':>8}{'habla':>8}{'palabras':>10}{'pal/s habla':>13}{'veredicto':>16}")
    for slug in slugs:
        path = os.path.join(src, slug + ".json")
        mp3 = os.path.join(src, slug + ".mp3")
        if not (os.path.exists(path) and os.path.exists(mp3)):
            print(f"{slug:<36}  (sin datos locales)")
            continue
        doc = json.load(open(path))
        words = len([w for w in doc["words"] if w.get("startSec") is not None])
        dur = duration(mp3)
        sil, db = silence_seconds(mp3)
        speech = max(0.1, dur - sil)
        rate = words / speech
        # The healthy library narrates at ~2.4 words per second of TOTAL audio,
        # so over speech-only time a healthy story sits near 3. Well under that
        # means the narrator is saying words the text does not contain.
        verdict = "MISMATCH REAL" if rate < 2.0 else ("dudoso" if rate < 2.4 else "sano")
        print(f"{slug[:35]:<36}{dur:>7.0f}s{speech:>7.0f}s{words:>10}{rate:>13.2f}{verdict:>16}")


if __name__ == "__main__":
    main()
