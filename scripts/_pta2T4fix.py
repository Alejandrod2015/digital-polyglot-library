"""Los tres arreglos del tema 4.

1. Diez definiciones por debajo de las 8 palabras.
2. La segunda cerraba su primer parrafo con una cita, y hasNarratorOpening
   pide que el parrafo de apertura termine en punto de narracion.
3. La tercera amontonaba siete plazas en el ultimo parrafo y dejaba otro a
   cero. Se parte el remate en dos y una plaza se muda al dialogo.
"""
import json

RUTA = "scripts/_pta2T4.json"
d = json.load(open(RUTA, encoding="utf-8"))

DEFS = {
    "tempestade": "Storm, with heavy rain and strong wind together.",
    "esfriar": "To get colder than it was a moment before.",
    "feio": "Ugly, and of weather, dark and threatening more rain.",
    "contente": "Pleased, glad about something small that went well.",
    "canoa": "Narrow boat that you move along with a paddle.",
    "puxar": "To pull something towards where you are standing.",
    "curvado": "Curved, bending round instead of running in a line.",
    "torto": "Crooked, leaning off to one side of straight.",
    "combinar": "To agree something with somebody else in advance.",
    "sozinho": "Alone, with nobody else there with you at all.",
}
for s in d:
    for v in s["vocab"]:
        if v["word"] in DEFS:
            v["definition"] = DEFS[v["word"]]

d[1]["text"] = d[1]["text"].replace(
    "“Desceu chuva a noite inteira lá de cima.”\n\n",
    "“Desceu chuva a noite inteira lá de cima.” A água passa escura pelo casco.\n\n",
)

d[2]["text"] = d[2]["text"].replace(
    "“Você não entra?”, ela pergunta. “Eu entro todo dia”, responde ele. “A senhora entra hoje.”\n\n"
    "Ela cava a areia com o pé, salta uma vez sem motivo e volta a boiar. "
    "Não são férias e não é feriado: é uma quarta-feira qualquer, e ela aproveita como se fosse a última. "
    "A água é bonita e ela está livre até as duas da tarde.",
    "“Você não entra?”, ela pergunta, e cava a areia com o pé. "
    "“Eu entro todo dia”, responde ele. “A senhora entra hoje.”\n\n"
    "Renata salta uma vez sem motivo e volta a boiar. "
    "Não são férias e não é feriado: é uma quarta-feira qualquer.\n\n"
    "Ela aproveita como se fosse a última. "
    "A água é bonita e ela está livre até as duas da tarde.",
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 4: definiciones, apertura de la segunda y remate de la tercera")
