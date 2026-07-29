#!/usr/bin/env python3
"""Compara el TEXTO guardado con lo que realmente se oye, y saca los tramos
que el audio dice y el texto no (y al reves). Para saber que hay que restituir.

  python3 scripts/_vdiffAudio.py <dir> <slug> <idioma>
"""
import json, os, sys
from difflib import SequenceMatcher
sys.path.insert(0, "scripts")
import _karaokeTruth as K
K.MODEL = os.path.expanduser("~/.cache/whisper/ggml-small.bin")

d, base, lang = sys.argv[1], sys.argv[2], sys.argv[3]
doc = json.load(open(os.path.join(d, base + ".json")))
truth = K.whisper_words(os.path.join(d, base + ".mp3"), lang)
texto = [w["text"] for w in doc["words"]]
oido = [w for w, _, _ in truth]
a = [K.norm(w) for w in texto]
b = [K.norm(w) for w in oido]
print(f"texto guardado: {len(texto)} palabras | oido en el audio: {len(oido)} | ratio {len(oido)/len(texto):.2f}\n")
sm = SequenceMatcher(a=a, b=b, autojunk=False)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "equal":
        continue
    falta = " ".join(oido[j1:j2])
    sobra = " ".join(texto[i1:i2])
    if tag == "insert" and len(falta.split()) >= 4:
        t = truth[j1][1]
        print(f"[{t:6.0f}s] EL AUDIO DICE, EL TEXTO NO ({len(falta.split())} palabras):\n    {falta}\n")
    elif tag == "delete" and len(sobra.split()) >= 4:
        print(f"[  ?   ] EL TEXTO TIENE, NO SE OYE ({len(sobra.split())} palabras):\n    {sobra}\n")
    elif tag == "replace" and (len(falta.split()) >= 4 or len(sobra.split()) >= 4):
        t = truth[j1][1] if j1 < len(truth) else 0
        print(f"[{t:6.0f}s] DISTINTO:\n    texto: {sobra}\n    audio: {falta}\n")
