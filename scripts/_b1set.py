"""Constructores de ejercicios de practica para el B1 latam.

El validador fuerte (scripts/_validateSets.ts) pide: exactamente un
match_meaning, diez destacados, el resto con featured=False, sin repetir
palabra objetivo y cubriendo TODAS las plazas de vocab de la historia.
"""
import json

def build(slug, exs):
    for e in exs:
        p = e["payload"]
        if e["type"] in ("meaning_in_context", "fill_blank"):
            p["audioClip"] = {"storySlug": slug, "storySource": "journey",
                              "sentence": e["sentence"].replace("[[", "").replace("]]", "").replace("_____", e["word"]),
                              "targetWord": e["word"], "language": "spanish"}
    import os
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_sets")
    json.dump(exs, open(os.path.join(base, f"{slug}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return len(exs), sum(1 for e in exs if e.get("featured") is not False)

def mic(word, sentence, answer, opts, featured=True):
    e = {"type": "meaning_in_context", "word": word, "sentence": sentence,
         "payload": {"prompt": "Choose the meaning in context.", "answer": answer, "options": [answer] + opts}}
    if not featured: e["featured"] = False
    return e

def fb(word, sentence, opts, translation, tropts, featured=True):
    e = {"type": "fill_blank", "word": word, "sentence": sentence,
         "payload": {"prompt": "Complete the sentence.", "answer": word, "options": [word] + opts,
                     "translation": translation, "optionTranslations": tropts}}
    if not featured: e["featured"] = False
    return e

def match(pairs):
    opts = [p[1] for p in pairs]
    return {"type": "match_meaning", "word": ",".join(p[0] for p in pairs), "sentence": "",
            "payload": {"prompt": "Match the words to their meanings.",
                        "pairs": [{"word": w, "answer": a, "options": opts} for w, a in pairs]}}
