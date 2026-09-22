#!/usr/bin/env python3
"""Expande la forma compacta de un set de practica al JSON que come
_validateSets.ts. Una linea por ejercicio, en orden: las 10 primeras son
featured y el resto va al pool.

  MATCH|w1=gloss|w2=gloss|w3=gloss|w4=gloss
  M|headline|frase con [[superficie]]|respuesta|d1|d2|d3
  F|superficie|cloze con _____|traduccion con _____|gloss-respuesta|d1=g1|d2=g2|d3=g3

Uso: python3 scripts/_deA2/expande.py <slug>
"""
import json, sys, os

LANG = "german"

def build(slug, lineas):
    out = []
    for i, raw in enumerate(lineas):
        p = raw.split("|")
        kind = p[0]
        if kind == "MATCH":
            pares = [x.split("=", 1) for x in p[1:5]]
            glosas = [g for _, g in pares]
            ex = {"type": "match_meaning", "word": ",".join(w for w, _ in pares), "sentence": "",
                  "payload": {"prompt": "Match the words to their meanings.",
                              "pairs": [{"word": w, "answer": g, "options": list(glosas)} for w, g in pares],
                              "audioClip": None}}
        elif kind == "M":
            _, head, frase, ans, d1, d2, d3 = p
            limpia = frase.replace("[[", "").replace("]]", "")
            sup = frase.split("[[")[1].split("]]")[0]
            ex = {"type": "meaning_in_context", "word": head, "sentence": frase,
                  "payload": {"prompt": "Choose the meaning in context.", "answer": ans,
                              "options": [ans, d1, d2, d3],
                              "audioClip": {"storySlug": slug, "storySource": "user",
                                            "sentence": limpia, "targetWord": sup, "language": LANG}}}
        elif kind == "F":
            _, sup, cloze, trad, gans, *ds = p
            dw, dg = zip(*[d.split("=", 1) for d in ds])
            ex = {"type": "fill_blank", "word": sup, "sentence": cloze,
                  "payload": {"prompt": "Complete the sentence.", "answer": sup,
                              "options": [sup, *dw],
                              "translation": trad,
                              "optionTranslations": [gans, *dg],
                              "audioClip": {"storySlug": slug, "storySource": "user",
                                            "sentence": cloze.replace("_____", sup),
                                            "targetWord": sup, "language": LANG}}}
        else:
            raise SystemExit(f"{slug}: tipo desconocido {kind!r}")
        if i >= 10:
            ex["featured"] = False
        out.append(ex)
    return out

def main():
    slug = sys.argv[1]
    src = f"scripts/_deA2/p/{slug}.txt"
    lineas = [l.rstrip("\n") for l in open(src, encoding="utf-8") if l.strip() and not l.startswith("#")]
    js = build(slug, lineas)
    os.makedirs("scripts/_sets", exist_ok=True)
    with open(f"scripts/_sets/{slug}.json", "w", encoding="utf-8") as f:
        json.dump(js, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{slug}: {len(js)} ejercicios ({sum(1 for e in js if e.get('featured') is not False)} featured)")

main()
