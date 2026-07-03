"""F0 intonation gate for practice sentence-clips.

Usage: ~/.cache/dpl-qa/venv/bin/python scripts/_f0gate.py <file.mp3> <question|statement>
Prints one JSON line: {"ok": bool, "slope": float, "end": float, "reason": str}

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


def main():
    path, mode = sys.argv[1], sys.argv[2]
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
