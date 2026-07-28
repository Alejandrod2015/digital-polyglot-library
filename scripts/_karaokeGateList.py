#!/usr/bin/env python3
"""Turn the measured scores into the karaoke gate list, and sort the failures
by CAUSE, because they need different fixes.

  wrong-audio  : almost none of the text is heard in the audio. The story is
                 paired with someone else's recording. Gate it and fix the
                 pairing.
  short-text   : the words match but the audio says far more of them. The
                 stored text is an abridged version of the same narration.
                 Gate it and restore the text.
  weak-align   : content is fine (words match, counts match) but the aligner
                 placed them poorly. Gating is a judgement call; re-aligning
                 may be enough.

  python3 scripts/_karaokeGateList.py <fullscore.json>
"""
import json
import sys

# A healthy story measured ~0.19 s of median error; the approved reference
# (kehrwoche-bei-achim) sits at 0.170 s with 94% of its words matched.
BAR_SEC = 0.45
MATCH_FLOOR = 0.40      # below this the audio is simply not this text
RATIO_CEILING = 1.35    # above this the audio says materially more than the text


def classify(row):
    match = row["matched"] / max(1, row["storedWords"])
    if match < MATCH_FLOOR:
        return "wrong-audio"
    if row["ratio"] > RATIO_CEILING:
        return "short-text"
    if row["medianAbsSec"] > BAR_SEC:
        return "weak-align"
    return None


def main():
    rows = json.load(open(sys.argv[1]))
    buckets = {}
    for row in rows:
        cause = classify(row)
        if cause:
            buckets.setdefault(cause, []).append(row)

    total = sum(len(v) for v in buckets.values())
    print(f"medidas: {len(rows)} | bajo la barra: {total}\n")
    for cause in ("wrong-audio", "short-text", "weak-align"):
        items = sorted(buckets.get(cause, []), key=lambda r: -r["medianAbsSec"])
        if not items:
            continue
        print(f"{cause} ({len(items)}):")
        for r in items:
            match = 100 * r["matched"] / max(1, r["storedWords"])
            print(f"  {r['slug'][:46]:<48} err={r['medianAbsSec']:>8.3f}s "
                  f"ratio={r['ratio']:<5} coinciden={match:.0f}%")
        print()

    gated = buckets.get("wrong-audio", []) + buckets.get("short-text", [])
    print("Para KARAOKE_BLOCKED_SLUGS en src/lib/karaokeQualityGate.ts:")
    for r in sorted(gated, key=lambda r: r["slug"]):
        print(f'  "{r["slug"]}",')


if __name__ == "__main__":
    main()
