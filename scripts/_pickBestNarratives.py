#!/usr/bin/env python3
"""Elige, para cada historia, la mejor extracción entre varios volcados.

El manuscrito llega en tres tramos solapados (la lectura del navegador corta a
~50 KB). Concatenarlos mete cabeceras y solapes que rompen el separador, así
que cada tramo se parte por su cuenta y luego se elige por historia la
candidata que PASA la validación: con diálogo, sin el test de comprensión y sin
la lista de vocabulario.

  python3 scripts/_pickBestNarratives.py <outDir> <tramo1.txt> <tramo2.txt> ...
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _splitManuscript import TITULOS, body_start  # noqa: E402


def validate(text: str) -> list:
    bad = []
    if "Preguntas de opción múltiple" in text:
        bad.append("trae el test")
    if re.search(r"^\s*[abcd]\)\s", text, re.M):
        bad.append("trae opciones")
    if "Vocabulary" in text:
        bad.append("trae vocabulario")
    if len(re.findall(r"(?m)^\S.*:\s*—", text)) < 3:
        bad.append("casi sin diálogo")
    if "docs.google.com" in text or "Copia de Colombian" in text:
        bad.append("trae cabecera del volcado")
    if not (300 < len(text.split()) < 1100):
        bad.append(f"largo raro ({len(text.split())} palabras)")
    return bad


def extract(text: str, title: str):
    i = body_start(text, title)
    if i < 0:
        return None, None
    rest = text[i:]
    cut = rest.find("Vocabulary")
    if cut < 0:
        return None, None
    narrative = rest[:cut].strip()
    vocab_block = rest[cut:].split("Preguntas")[0]
    words = [
        w.strip()
        for w in re.findall(r"^([A-Za-zÁÉÍÓÚÑáéíóúñ' ]{2,28}):", vocab_block, re.M)
        if w.strip().lower() != "vocabulary"
    ]
    return narrative, words


def main():
    out = sys.argv[1]
    sources = [open(f, encoding="utf-8").read() for f in sys.argv[2:]]
    os.makedirs(out, exist_ok=True)

    ok = 0
    for slug, title in TITULOS:
        best = None
        for src in sources:
            narrative, words = extract(src, title)
            if not narrative:
                continue
            problems = validate(narrative)
            if problems:
                continue
            if best is None or len(narrative) > len(best[0]):
                best = (narrative, words)
        if not best:
            print(f"  {slug:<36} SIN CANDIDATA VÁLIDA")
            continue
        narrative, words = best
        open(os.path.join(out, f"{slug}.txt"), "w", encoding="utf-8").write(narrative + "\n")
        json.dump(words, open(os.path.join(out, f"{slug}.words.json"), "w"), ensure_ascii=False)
        print(f"  {slug:<36} {len(narrative.split()):>4} palabras   vocab: {len(words)}")
        ok += 1
    print(f"\nválidas: {ok}/{len(TITULOS)}")


if __name__ == "__main__":
    main()
