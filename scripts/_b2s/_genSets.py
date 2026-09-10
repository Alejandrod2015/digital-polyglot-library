"""Expande las fichas compactas de scripts/_b2s/sets/t*.py al formato de scripts/_sets/<slug>.json.

Ficha por historia: {"M": [(palabra, ingles) x4], "E": [...]} con E en el orden final:
  ("C", palabra, oracion con [[superficie]], respuesta, d1, d2, d3)      meaning_in_context
  ("F", palabra, oracion con _____, [d1, d2, d3], traduccion, [en x4])   fill_blank
  ("M",)                                                                 donde cae el match
Los diez primeros van destacados; el resto, al pool. Comprueba lo que el validador no mira:
nombres del reparto, numerales escritos, largo de la clausula y distractores repetidos.
Los guiones largos los rechazan ya _validateSets.ts y npm run lint:no-emdash.
"""
import json, re, sys, glob, importlib.util, collections

NOMBRES = {"claudia", "marcos", "carla", "pablo", "hugo", "alba", "martina", "paula", "cádiz", "vitoria"}
NUMERALES = {"dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce",
             "quince", "veinte", "treinta", "cuarenta", "cincuenta", "cien", "mil"}


def palabras(s):
    return re.sub(r"\[\[|\]\]", "", s).split()


avisos, freq = [], collections.Counter()


def construye(slug, ficha):
    out = []
    for e in ficha["E"]:
        if e[0] == "M":
            ens = [en for _, en in ficha["M"]]
            out.append({"type": "match_meaning", "word": ",".join(w for w, _ in ficha["M"]), "sentence": "",
                        "payload": {"prompt": "Match the words to their meanings.",
                                    "pairs": [{"word": w, "answer": en, "options": ens} for w, en in ficha["M"]],
                                    "audioClip": None}})
        elif e[0] == "C":
            _, w, s, ans, *ds = e
            sup = re.search(r"\[\[(.+?)\]\]", s).group(1)
            limpio = s.replace("[[", "").replace("]]", "")
            if len(palabras(s)) > 14:
                avisos.append(f"{slug} C {w}: {len(palabras(s))} palabras")
            freq.update(ds)
            out.append({"type": "meaning_in_context", "word": w, "sentence": s,
                        "payload": {"prompt": "Choose the meaning in context.", "answer": ans, "options": [ans, *ds],
                                    "audioClip": {"storySlug": slug, "storySource": "user", "sentence": limpio,
                                                  "targetWord": sup, "language": "spanish"}}})
        elif e[0] == "F":
            _, w, s, ds, tr, ens = e
            if len(palabras(s)) > 12:
                avisos.append(f"{slug} F {w}: {len(palabras(s))} palabras")
            if "_____" not in s or "_____" not in tr:
                avisos.append(f"{slug} F {w}: sin hueco")
            if len(ens) != 4 or len(ds) != 3:
                avisos.append(f"{slug} F {w}: opciones")
            freq.update(ds)
            out.append({"type": "fill_blank", "word": w, "sentence": s,
                        "payload": {"prompt": "Complete the sentence.", "answer": w, "options": [w, *ds],
                                    "translation": tr, "optionTranslations": ens,
                                    "audioClip": {"storySlug": slug, "storySource": "user",
                                                  "sentence": s.replace("_____", w), "targetWord": w,
                                                  "language": "spanish"}}})
    for i, x in enumerate(out):
        if i >= 10:
            x["featured"] = False
        txt = (x["sentence"] + " " + ((x["payload"].get("audioClip") or {}).get("sentence") or "")).lower()
        for t in re.findall(r"\w+", txt):
            if t in NOMBRES:
                avisos.append(f"{slug} {x['word']}: nombre '{t}'")
            if t in NUMERALES and t not in x["word"].lower().split():
                avisos.append(f"{slug} {x['word']}: numeral '{t}'")
    return out


solo = sys.argv[1:]
for f in sorted(glob.glob("scripts/_b2s/sets/t*.py")):
    spec = importlib.util.spec_from_file_location("m", f)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    for slug, ficha in m.SETS.items():
        if solo and slug not in solo:
            continue
        exs = construye(slug, ficha)
        open(f"scripts/_sets/{slug}.json", "w").write(json.dumps(exs, ensure_ascii=False, indent=1) + "\n")
        n_f = sum(1 for x in exs if x["type"] == "fill_blank")
        n_c = sum(1 for x in exs if x["type"] == "meaning_in_context")
        print(f"{slug}: {len(exs)} ejercicios ({n_f} fill, {n_c} meaning, 1 match)")
for a in avisos:
    print("  AVISO", a)
rep = [(d, n) for d, n in freq.most_common() if n > 3]
if rep:
    print("  distractores repetidos (>3):", rep[:15])
