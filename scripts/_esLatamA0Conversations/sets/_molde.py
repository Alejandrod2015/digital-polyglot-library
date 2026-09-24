"""Expande la forma compacta de un set de practica al JSON que come
scripts/_seedAllSets.ts. Un .py por historia; este modulo solo arma la forma.

  M(word, "frase con [[palabra]]", answer, [d1,d2,d3])
  F(word, "frase con _____", [d1,d2,d3], "translation con _____", [ta,t1,t2,t3])
  MATCH([(word, meaning), ...4])

Los diez PRIMEROS ejercicios van featured; el resto es pool, que es lo que
pide el validador (featured exactamente 10, pool no vacio). El audioClip lleva
la frase y la palabra pero NO clipUrl: los clips son otra fase y este encargo
no los genera.
"""
import json, sys

SLUG = None
LANG = "spanish"

def _clip(sentence, word):
    return {"storySlug": SLUG, "storySource": "user", "sentence": sentence,
            "targetWord": word, "language": LANG}

def M(word, sentence, answer, distractores):
    plana = sentence.replace("[[", "").replace("]]", "")
    return {"type": "meaning_in_context", "word": word, "sentence": sentence,
            "payload": {"prompt": "Choose the meaning in context.", "answer": answer,
                        "options": [answer] + list(distractores),
                        "audioClip": _clip(plana, word)}}

def F(word, sentence, distractores, translation, optrads):
    plana = sentence.replace("_____", word)
    return {"type": "fill_blank", "word": word, "sentence": sentence,
            "payload": {"prompt": "Complete the sentence.", "answer": word,
                        "options": [word] + list(distractores),
                        "translation": translation, "optionTranslations": list(optrads),
                        "audioClip": _clip(plana, word)}}

def MATCH(pares):
    opciones = [a for _, a in pares]
    return {"type": "match_meaning", "word": ",".join(w for w, _ in pares), "sentence": "",
            "payload": {"prompt": "Match the words to their meanings.",
                        "pairs": [{"word": w, "answer": a, "options": list(opciones)} for w, a in pares],
                        "audioClip": None}}

def escribe(slug, ejercicios, destino="scripts/_sets"):
    for i, e in enumerate(ejercicios):
        e["featured"] = i < 10
    ruta = f"{destino}/{slug}.json"
    with open(ruta, "w", encoding="utf8") as fh:
        json.dump(ejercicios, fh, ensure_ascii=False, indent=1)
    print(f"{slug}: {len(ejercicios)} ejercicios ({sum(1 for e in ejercicios if e['featured'])} featured)")
