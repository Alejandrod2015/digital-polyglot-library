"""Ultimo retoque del tema 3.

La primera se quedaba en 24% de habla citada, un punto por debajo de la banda.
Lo que faltaba no era relleno: era que Renata dijera en voz alta la segunda
mitad de la regla, que es lo que la historia entera va a cobrar en la tercera.
Y la tercera baja tres palabras.
"""
import json

RUTA = "scripts/_pta2T3.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[0]["text"] = d[0]["text"].replace(
    "“Hoje eu cozinho”, avisa, alto, para a casa inteira ouvir.",
    "“Hoje eu cozinho”, avisa, alto, para a casa inteira ouvir. “E hoje eu não lavo.”",
)

d[2]["text"] = (
    d[2]["text"]
    .replace("a regra é a regra, e Edilson sabe disso.", "a regra é a regra, e Edilson sabe.")
    .replace("Às onze ela desce por água e a panela está limpa,", "Às onze ela desce por água: a panela está limpa,")
    .replace("Na bancada há um bilhete de letra grande e gorda:", "Na bancada, um bilhete de letra grande e gorda:")
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 3: banda de citado en la primera, y tres palabras menos en la tercera")
