#!/usr/bin/env python3
"""Escribe `hero` y `heroCredit` en el frontmatter de los posts tocados.

La atribucion es la condicion de la licencia CC BY / CC BY-SA de Commons, y
vive en el post, no en un JSON suelto, para que no se pueda perder de vista al
editar el articulo. `scripts/_blogHeroes.credits.json` es la salida del
buscador; este script la vuelca en los .mdx.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDITS = json.load(open(os.path.join(ROOT, "scripts", "_blogHeroes.credits.json")))
CONTENT = os.path.join(ROOT, "content", "blog")


def yaml_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


for slug, c in sorted(CREDITS.items()):
    path = os.path.join(CONTENT, f"{slug}.mdx")
    raw = open(path).read()
    m = re.match(r"(---\n)(.*?)(\n---\n)", raw, re.S)
    if not m:
        print(f"  sin frontmatter  {slug}")
        continue
    head, body, tail = m.groups()

    # Fuera lo anterior, para que reejecutar no acumule bloques.
    body = re.sub(r"\nheroCredit:\n(?:  .*\n?)*", "\n", body)
    body = body.rstrip("\n")

    hero = f"/blog/{slug}/hero.webp"
    if re.search(r"^hero:", body, re.M):
        body = re.sub(r"^hero: .*$", f"hero: {yaml_str(hero)}", body, count=1, flags=re.M)
    else:
        body += f"\nhero: {yaml_str(hero)}"

    body += (
        "\nheroCredit:"
        f"\n  author: {yaml_str(c['author'])}"
        f"\n  licence: {yaml_str(c['licence'])}"
        f"\n  source: {yaml_str(c['filePage'])}"
    )
    open(path, "w").write(head + body + tail + raw[m.end():])
    print(f"  {slug}")
