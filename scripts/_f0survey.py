"""Encuesta F0 de uptalk sobre declarativas del catálogo.

Uso: venv/python scripts/_f0survey.py <lista.tsv>   (lineas: key\tmp3path)
Imprime una línea JSON por clip: {key, end, rise, slope, nvoiced}.

Diferencias vs _f0gate (que es por-clip y warn-only en statements):
- filtra saltos de octava: descarta frames a >6 st de la mediana móvil (el
  creak final mete +12/+20 st fantasma; era la razón del warn-only).
- `end`  = mediana st del último 0.25 s sonoro (mediana, no media: robusta).
- `rise` = end - mediana del tramo de referencia previo (-1.0..-0.4 s):
  cuánto SUBE el final respecto a lo que venía diciendo. El uptalk perceptual
  es ese delta, no el valor absoluto contra la mediana global.
"""
import sys, json
import numpy as np
import parselmouth


def measure(path):
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    t = pitch.xs()
    f = pitch.selected_array["frequency"]
    voiced = f > 0
    if voiced.sum() < 12:
        return None
    tv, fv = t[voiced], f[voiced]
    st = 12 * np.log2(fv / np.median(fv))
    # limpieza de octavas: mediana móvil (k=5) y descarte de outliers > 6 st
    k = 5
    pad = np.pad(st, (k // 2, k // 2), mode="edge")
    med = np.array([np.median(pad[i:i + k]) for i in range(len(st))])
    keep = np.abs(st - med) <= 6
    tv, st = tv[keep], st[keep]
    if len(st) < 12:
        return None
    tv, st = tv[:-2], st[:-2]  # frontera final: creak residual
    t_end = tv[-1]
    tail = tv >= t_end - 0.25
    ref = (tv >= t_end - 1.0) & (tv < t_end - 0.4)
    if tail.sum() < 3 or ref.sum() < 4:
        return None
    end = float(np.median(st[tail]))
    rise = float(end - np.median(st[ref]))
    seg = tv >= t_end - 0.45
    slope = float(np.polyfit(tv[seg], st[seg], 1)[0]) if seg.sum() >= 4 else 0.0
    return {"end": round(end, 1), "rise": round(rise, 1), "slope": round(slope, 1), "nvoiced": int(len(st))}


def main():
    for line in open(sys.argv[1]):
        key, path = line.rstrip("\n").split("\t")
        try:
            r = measure(path)
        except Exception:
            r = None
        print(json.dumps({"key": key, **(r or {"end": None, "rise": None, "slope": None, "nvoiced": 0})}))


main()
