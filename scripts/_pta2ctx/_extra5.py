"""Dos trozos que cruzaban el borde de una cita y no salian tal cual.

Las dos palabras aparecen solas dentro de su comilla ("Letras.", "Quero."),
asi que el trozo minimo con sentido ES la palabra: no hay clausula alrededor
que darle sin inventar texto que la historia no tiene.
"""
import json
import pathlib

RUTA = pathlib.Path("scripts/_pta2ctx/_huecos.json")
d = json.load(open(RUTA, encoding="utf-8"))
d["ninguem-sabe-do-exame"]["letras"] = {"es": "Letras", "en": "Languages"}
d["ninguem-sabe-do-exame"]["quero"] = {"es": "Quero", "en": "I do"}
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("dos trozos a su palabra")
