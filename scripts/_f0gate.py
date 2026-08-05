"""F0 intonation gate for practice sentence-clips.

Usage: ~/.cache/dpl-qa/venv/bin/python scripts/_f0gate.py <file.mp3> <question|statement|statement-multi>
Prints one JSON line: {"ok": bool, "slope": float, "end": float, "reason": str}

`statement-multi` (added 2026-08-03) scores EVERY sentence ending inside a
multi-sentence clip, not just the last one, and reports the WORST. Narration
is rendered one PARAGRAPH per fragment, so the single-ending modes above are
blind to every sentence that is not the paragraph's last: on 2026-07-29 a
reviewer flagged uptalk at 0:59 of "El mar es turquesa", which sits mid
paragraph, and the gate had passed that fragment with its best score of the
six (-4.8 st) because it only ever looked at the paragraph's final 450 ms.
Sentence boundaries are found from internal pauses (no alignment needed).
Adds `endings` (per-sentence detail) and `worst` to the JSON.

Spanish yes/no questions are distinguished from statements almost solely by a
final F0 rise, so a question whose final contour is flat/falling sounds like a
statement (user-reported defect 2026-07-02: "las preguntas no suenan como
pregunta"). Measured on that defective batch: flat questions had end <= +1.3 st
and slope <= -2.5 st/s; clean declaratives cluster at end -5..-0 st.

question:  fail unless the final 450 ms voiced stretch RISES
           (endpoint >= +2.0 st above clip median AND slope > 0).
statement: warn-only (never fails): pitch tracking on final creak/fricatives
           throws octave errors (+20 st endpoints on clips a human hears as
           fine), so a hard uptalk gate would false-reject. Logged for data.
"""
import sys, json
import numpy as np
import parselmouth


def final_contour(path):
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    t = pitch.xs()
    f = pitch.selected_array["frequency"]
    voiced = f > 0
    if voiced.sum() < 10:
        return None
    tv, fv = t[voiced], f[voiced]
    st = 12 * np.log2(fv / np.median(fv))
    # drop the last 2 voiced frames: boundary creak often octave-jumps there
    tv, st = tv[:-2], st[:-2]
    tail = tv >= tv[-1] - 0.45
    if tail.sum() < 4:
        return None
    slope = float(np.polyfit(tv[tail], st[tail], 1)[0])
    end = float(st[tail][-3:].mean())
    return slope, end


# --- statement-multi -------------------------------------------------------

# A declarative ending scored at or above this many semitones over the clip
# median reads as uptalk. Calibrated 2026-08-03 on the four MX A0 masters:
# the one reviewer-reported ending that this statistic can see scored +3.09 st,
# while the 16 unreported endings had p90 +1.25 st and only one outlier above
# (+11.81 st, an octave artefact, filtered by `undouble`). See CLAUDE.md.
UPTALK_ST = 2.5

# Absolute floor for anything that could be a boundary at all.
MIN_PAUSE_S = 0.28
# Ignore a "sentence" shorter than this (clipped fragments, trailing noise).
MIN_SENT_S = 0.9

# A pause alone does NOT identify a sentence boundary: Spanish commas take a
# breath too, and a comma is SUPPOSED to rise (continuation), so scoring one
# as uptalk is a false positive. Caller therefore passes how many sentences
# the fragment's text has (argv[3]); we keep only the (n-1) LONGEST internal
# pauses as boundaries. Without that count we fall back to a conservative
# pause floor that only catches unambiguous full stops.
FALLBACK_PAUSE_S = 0.55


def undouble(st_vals):
    """Undo octave-doubling before judging.

    Praat reports a doubled frame exactly +12 st off. A real declarative never
    ends a full octave above its own median, so anything in the doubling band
    is corrected down rather than counted as a catastrophic rise (which would
    burn every re-roll on a tracking error instead of on real uptalk).
    """
    return np.array([v - 12.0 if v >= 9.0 else v for v in st_vals])


def sentence_ends(t, voiced, n_sentences=None):
    """Sentence-final instants inside the clip.

    The clip's own last voiced instant is always one. Internal boundaries are
    chosen from the gaps: with `n_sentences` known, the (n-1) LONGEST gaps win
    (a full stop always outlasts the commas around it); otherwise only gaps
    above FALLBACK_PAUSE_S qualify.
    """
    if voiced.sum() < 10:
        return []
    tv = t[voiced]
    gaps = []
    for i in range(1, len(tv)):
        d = tv[i] - tv[i - 1]
        if d >= MIN_PAUSE_S:
            gaps.append((d, float(tv[i - 1])))
    if n_sentences and n_sentences > 1:
        gaps.sort(reverse=True)
        chosen = sorted(at for _, at in gaps[: n_sentences - 1])
    else:
        chosen = sorted(at for d, at in gaps if d >= FALLBACK_PAUSE_S)

    ends, start = [], tv[0]
    for at in chosen:
        if at - start >= MIN_SENT_S:
            ends.append(at)
            start = at
    if tv[-1] - start >= MIN_SENT_S:
        ends.append(float(tv[-1]))
    return ends


def multi_contour(path, n_sentences=None):
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    t = pitch.xs()
    f = pitch.selected_array["frequency"]
    voiced = f > 0
    if voiced.sum() < 10:
        return None
    med = float(np.median(f[voiced]))
    out = []
    for e in sentence_ends(t, voiced, n_sentences):
        m = voiced & (t >= e - 0.60) & (t <= e + 0.02)
        if m.sum() < 6:
            out.append({"at": round(e, 2), "end": None})
            continue
        st = undouble(12 * np.log2(f[m] / med))
        st = st[:-2] if len(st) > 5 else st        # boundary creak guard
        if len(st) < 4:
            out.append({"at": round(e, 2), "end": None})
            continue
        out.append({"at": round(e, 2), "end": round(float(np.mean(st[-3:])), 2)})
    return out


def main():
    path, mode = sys.argv[1], sys.argv[2]

    if mode == "statement-multi":
        n_sent = int(sys.argv[3]) if len(sys.argv) > 3 else None
        endings = multi_contour(path, n_sent)
        if not endings:
            print(json.dumps({"ok": True, "slope": None, "end": None,
                              "endings": [], "worst": None,
                              "reason": "unvoiced, not gated"}))
            return
        scored = [e for e in endings if e["end"] is not None]
        if not scored:
            print(json.dumps({"ok": True, "slope": None, "end": None,
                              "endings": endings, "worst": None,
                              "reason": "no measurable ending"}))
            return
        worst = max(scored, key=lambda e: e["end"])
        ok = worst["end"] < UPTALK_ST
        print(json.dumps({
            "ok": ok, "slope": None, "end": worst["end"],
            "endings": endings, "worst": worst,
            "measured": len(scored), "total": len(endings),
            "reason": "ok" if ok else f"uptalk at {worst['at']}s (+{worst['end']} st)",
        }))
        return

    r = final_contour(path)
    if r is None:
        # A question whose tail cannot be pitch-tracked cannot be verified as
        # rising; force a retry rather than silently passing (a flat carpeta
        # clip auto-passed through this hole on 2026-07-02).
        ok = mode != "question"
        print(json.dumps({"ok": ok, "slope": None, "end": None, "reason": "unvoiced-tail" + ("" if ok else ", question unverifiable")}))
        return
    slope, end = r
    if mode == "question":
        # Calibrated against the gold standard (the same sentence inside the
        # story narration, same voice): a real question rise ENDS high, +11.1
        # st above the clip median. Flat-sounding clips maxed at +1.3 st even
        # when their tail slope was positive (+12..+17 st/s), and the user's
        # ear rejected them: the ENDPOINT is the perceptual cue, not the slope.
        ok = end >= 4.0
        reason = "rising final" if ok else "question ends flat/falling"
    else:
        ok = True
        reason = "uptalk-suspect (warn only)" if (end > 6 and slope > 15) else "ok"
    print(json.dumps({"ok": ok, "slope": round(slope, 1), "end": round(end, 1), "reason": reason}))


main()
