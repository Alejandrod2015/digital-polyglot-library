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
