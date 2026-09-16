import sys, numpy as np, parselmouth
print(f"{'fixture':30} {'dur':>5} {'voic':>5} {'span':>6} {'hueco_max':>9} {'slope':>7} {'end':>6}")
for path in sys.argv[1:]:
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    t = pitch.xs(); f = pitch.selected_array["frequency"]; v = f > 0
    name = path.split("/")[-1].replace(".mp3","")
    if v.sum() < 3:
        print(f"{name:30} {snd.duration:5.2f} {v.sum():5d}      -         -       -      -"); continue
    tv = t[v]; span = tv[-1]-tv[0]
    gap = max((tv[i]-tv[i-1] for i in range(1,len(tv))), default=0.0)
    st = 12*np.log2(f[v]/np.median(f[v]))
    drop = min(2, max(0, len(st)-4))
    tv2, st2 = (tv[:-drop], st[:-drop]) if drop else (tv, st)
    tail = tv2 >= tv2[-1]-0.45
    if tail.sum() >= 4:
        sl = float(np.polyfit(tv2[tail], st2[tail],1)[0]); en = float(st2[tail][-3:].mean())
        print(f"{name:30} {snd.duration:5.2f} {v.sum():5d} {span:6.2f} {gap:9.2f} {sl:7.1f} {en:6.1f}")
    else:
        print(f"{name:30} {snd.duration:5.2f} {v.sum():5d} {span:6.2f} {gap:9.2f}   tail<4")
