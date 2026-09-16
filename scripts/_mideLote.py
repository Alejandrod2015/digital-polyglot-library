"""Mide una tanda de mp3 con el gate NUEVO. Entrada: json [{file, id}]. Salida: json."""
import sys, json, numpy as np, parselmouth
sys.path.insert(0, "scripts")
MIN_VOICED, MIN_TAIL, SHORT_SPAN_S, SHORT_RISE = 4, 4, 0.35, 10.0
out = []
for it in json.load(open(sys.argv[1])):
    try:
        snd = parselmouth.Sound(it["file"])
        pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
        t, f = pitch.xs(), pitch.selected_array["frequency"]
        v = f > 0
        if v.sum() < MIN_VOICED: out.append({**it, "medible": False}); continue
        tv, fv = t[v], f[v]
        span = float(tv[-1] - tv[0])
        st = 12*np.log2(fv/np.median(fv))
        drop = min(2, max(0, len(st)-MIN_TAIL))
        if drop: tv, st = tv[:-drop], st[:-drop]
        tail = tv >= tv[-1]-0.45
        if tail.sum() < MIN_TAIL: out.append({**it, "medible": False}); continue
        slope = float(np.polyfit(tv[tail], st[tail],1)[0]); end = float(st[tail][-3:].mean())
        corta = span < SHORT_SPAN_S
        sube = (slope > SHORT_RISE) if corta else (end >= 4.0)
        out.append({**it, "medible": True, "corta": corta, "span": round(span,2),
                    "slope": round(slope,1), "end": round(end,1), "sube": bool(sube)})
    except Exception as e:
        out.append({**it, "medible": False, "error": str(e)[:80]})
json.dump(out, open(sys.argv[2], "w"))
