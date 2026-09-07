"""Tercera ronda del tema 2, dos retoques.

El detector de habla lee la primera palabra en mayuscula de una frase como
nombre de quien habla, asi que un infinitivo abriendo frase ("Respirar
contando...") se leia como un personaje nuevo sin presentar. Y la tercera
seguia dos palabras por encima de la banda.
"""
import json

RUTA = "scripts/_pta2T2.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[1]["text"] = d[1]["text"].replace(
    "Respirar contando até quatro, o quarto morno e nunca quente.",
    "Manda respirar contando até quatro, com o quarto morno e nunca quente.",
)

d[2]["text"] = d[2]["text"].replace(
    "a mão apoiada numa almofada", "a mão numa almofada"
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 2: infinitivo que se leia como personaje, y banda de palabras")
