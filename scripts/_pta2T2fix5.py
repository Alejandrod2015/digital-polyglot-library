"""Quinta ronda del tema 2: la superficie de una plaza y cuatro palabras.

Al pasar el consejo de Nilza a dialogo, "respirar" quedo en el cuerpo como
"respira", asi que la plaza necesita su `surface`; sin eso la pastilla del
lector no encuentra la palabra. Y la tercera volvio a asomar por encima de la
banda al ganar dialogo.
"""
import json

RUTA = "scripts/_pta2T2.json"
d = json.load(open(RUTA, encoding="utf-8"))

for v in d[1]["vocab"]:
    if v["word"] == "respirar":
        v["surface"] = "respira"

d[2]["text"] = (
    d[2]["text"]
    .replace(
        "Três dias depois Renata volta à farmácia e encontra Nilza",
        "Três dias depois Renata volta e encontra Nilza",
    )
    .replace(
        "“Vinte minutos”, insiste Renata.",
        "“Vinte minutos”, repete Renata.",
    )
    .replace(
        "“Isso eu conheço”, insiste Renata, e devolve a frase inteira.",
        "“Isso eu conheço”, insiste Renata, devolvendo a frase.",
    )
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 2: surface de respirar y banda de la tercera")
