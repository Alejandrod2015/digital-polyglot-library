"""Ultimo retoque del tema 4: un bloque vacio, otro cargado y nueve palabras.

El bloque final de la segunda se quedaba sin ninguna plaza mientras otro
llevaba seis, que es el reparto que el lector castiga. Se junta el remate en
un solo bloque y se quita una palabra del bloque cargado.
"""
import json

RUTA = "scripts/_pta2T4.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[1]["text"] = (
    d[1]["text"]
    .replace(
        "Eles atravessam o primeiro trecho e a canoa balança feio.",
        "Eles atravessam o primeiro trecho e balançam feio.",
    )
    .replace(
        "Damião salva o remo que ia embora. Voltam sem falar. “Amanhã?”, pergunta ela na margem. Ele olha o céu e não responde.",
        "Damião salva o remo que ia embora. “Amanhã?”, pergunta ela na margem. Ele olha o céu e não responde.",
    )
)

d[2]["text"] = (
    d[2]["text"]
    .replace(
        "Entre as dunas aparece uma planta pequena e uma flor branca que ninguém plantou.",
        "Entre as dunas há uma planta pequena e uma flor branca.",
    )
    .replace(
        "Renata nada dez metros e fica de pé, com água pela cintura.",
        "Renata nada dez metros e fica de pé na água.",
    )
    .replace(
        "Ela salta uma vez sem motivo e volta a boiar.",
        "Ela salta uma vez sem motivo.",
    )
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 4: bloques repartidos y banda de palabras")
