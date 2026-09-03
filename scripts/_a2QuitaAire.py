"""Localiza la inhalacion que queda DESPUES del titulo y devuelve su ventana.

La palabra y el soplo caen en el mismo bloque si se mira a 20 ms; a 10 ms se
separan. El soplo es energia BAJA con agudos altos y sin tono, justo antes del
silencio digital que abre el hueco del titulo.
"""
import sys, json, wave
import numpy as np

f = sys.argv[1]
lim = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0
w = wave.open(f); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
hop = int(sr * 0.01)
fr = []
for i in range(0, min(len(x) - hop, int(lim * sr)), hop):
    s = x[i:i+hop]
    rms = 20*np.log10(max(np.sqrt((s**2).mean()), 1e-6))
    sp = np.abs(np.fft.rfft(s*np.hanning(len(s)))); fq = np.fft.rfftfreq(len(s), 1/sr)
    lf = sp[(fq > 80) & (fq < 400)].sum() + 1e-9
    hf = sp[(fq > 2000) & (fq < 7000)].sum()
    fr.append((i/sr, rms, hf/lf))

# fin de la palabra: ultimo frame con voz clara (tono presente y nivel audible)
fin = None
for t, rms, r in fr:
    if rms > -45 and r < 1.2:
        fin = t + 0.01
if fin is None:
    print(json.dumps({"ok": False, "why": "no encuentro el final de la palabra"})); sys.exit()

# soplo: a partir de ahi, frames audibles con agudos dominantes
ini = None; end = None
for t, rms, r in fr:
    if t < fin: continue
    if rms > -55 and r > 1.4:
        if ini is None: ini = t
        end = t + 0.01
print(json.dumps({"ok": ini is not None, "finPalabra": round(fin, 3),
                  "aireIni": None if ini is None else round(ini, 3),
                  "aireFin": None if end is None else round(end, 3)}))
