"""SOLO LECTURA. Revision cruzada de los 21 sets curados del Friends FR A0, lo
que ningun gate mira porque cada ejercicio suelto es correcto
(project_curated_sets_gotchas): nombres de personaje en las frases (rompen el
TTS y la QA de Scribe), numeros escritos en la frase, distractores repetidos en
los 21 juntos (tope sano unas 10 apariciones), guiones largos, y el reparto.
  python3 scripts/_frA0/practica_revisa.py
"""
import json, re, os
from collections import Counter

hoja = json.load(open("scripts/_frA0/practica_hoja.json"))
NOMBRES = re.compile(r"\b(Léa|Hugo|Théo|Chloé|Maxime|Louise|Antoine|Clara)\b")
NUMEROS = re.compile(r"\b(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|vingt|trente|cent|mille)\b", re.I)
GUION = re.compile("[\\u2013\\u2014]")
distractores, faltan = Counter(), []
for h in hoja:
    f = f"scripts/_sets/{h['slug']}.json"
    if not os.path.exists(f):
        faltan.append(h["slug"]); continue
    exs = json.load(open(f))
    tipos = Counter(e["type"] for e in exs)
    feat = sum(1 for e in exs if e.get("featured", True))
    avisos = []
    for e in exs:
        frases = [e.get("sentence", ""), (e["payload"].get("audioClip") or {}).get("sentence", "")]
        for fr in frases:
            if NOMBRES.search(fr): avisos.append(f"nombre en '{fr}'")
            m = NUMEROS.search(fr)
            if m and m.group(1).lower() not in e["word"].lower(): avisos.append(f"numero '{m.group(1)}' en '{fr}'")
        if GUION.search(json.dumps(e, ensure_ascii=False)): avisos.append(f"guion largo en '{e['word']}'")
        if e["type"] in ("fill_blank", "meaning_in_context"):
            for o in e["payload"]["options"][1:]: distractores[o.lower()] += 1
    print(f"{h['slug']:32} {len(exs):2} ej · {dict(tipos)} · featured {feat}" + ("" if not avisos else "\n   " + "\n   ".join(sorted(set(avisos)))))
print("\nsin set:", faltan or "ninguno")
print("distractores con mas de 3 apariciones en los 21:", [(d, n) for d, n in distractores.most_common() if n > 3][:25] or "ninguno")
