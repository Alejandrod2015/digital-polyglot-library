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
statement: HARD gate desde 2026-07-23 (antes warn-only). Calibrado a ciegas
           con el usuario sobre el catálogo (1543 declarativas medidas):
           - medición robusta a creak: outliers >6 st de la mediana móvil se
             descartan (la razón original del warn-only era el creak final
             metiendo +20 st fantasma).
           - "duda"/uptalk perceptual = subida MODERADA sostenida: rise
             (mediana del último 0.25 s vs tramo -1.0..-0.4 s) >= +5 st Y
             slope final >= +10 st/s. Los 4 clips que el usuario marcó como
             duda caían ahí (+5.7..+8.6, +13.9..+39.3).
           - extremos NO son duda: +29 st sonó a énfasis/alarma y rise alto
             con slope negativo es pico enfático; por eso el AND de ambas.
           Frontera imperfecta (dos clips con métricas casi iguales tuvieron
           juicios opuestos): ~67% precisión; para render-gate es barato
           (re-tirar un intento), para condenar audio publicado se requiere
           oído humano.
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


def robust_rise(path):
    """rise/slope del final, con outliers de octava filtrados (ver _f0survey)."""
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    t = pitch.xs()
    f = pitch.selected_array["frequency"]
    voiced = f > 0
    if voiced.sum() < 12:
        return None
    tv, fv = t[voiced], f[voiced]
    st = 12 * np.log2(fv / np.median(fv))
    k = 5
    pad = np.pad(st, (k // 2, k // 2), mode="edge")
    med = np.array([np.median(pad[i:i + k]) for i in range(len(st))])
    keep = np.abs(st - med) <= 6
    tv, st = tv[keep], st[keep]
    if len(st) < 12:
        return None
    tv, st = tv[:-2], st[:-2]
    t_end = tv[-1]
    tail = tv >= t_end - 0.25
    ref = (tv >= t_end - 1.0) & (tv < t_end - 0.4)
    if tail.sum() < 3 or ref.sum() < 4:
        return None
    rise = float(np.median(st[tail]) - np.median(st[ref]))
    seg = tv >= t_end - 0.45
    slope = float(np.polyfit(tv[seg], st[seg], 1)[0]) if seg.sum() >= 4 else 0.0
    return rise, slope


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

    if mode == "statement":
        r = robust_rise(path)
        if r is None:
            print(json.dumps({"ok": True, "slope": None, "end": None, "reason": "unvoiced-tail"}))
            return
        rise, slope = r
        ok = not (rise >= 5.0 and slope >= 10.0)
        reason = "ok" if ok else "uptalk (rise %+0.1f st, slope %+0.1f)" % (rise, slope)
        print(json.dumps({"ok": ok, "slope": round(slope, 1), "end": round(rise, 1), "reason": reason}))
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
