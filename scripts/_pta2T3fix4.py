"""'velho' no era del tema 3: es del 6, y al guardarse alli quedo repetida
dentro del journey (vocab-taught-same-type, tope 0). Se sustituye por
'limpar', que si esta en el plan del tema 3 y era la unica plaza sin usar.
"""
import json

RUTA = "scripts/_pta2T3.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[2]["text"] = d[2]["text"].replace(
    "Às onze ela desce por água: a panela está limpa, virada para baixo.",
    "Às onze ela desce por água: alguém limpou a panela e a deixou virada para baixo.",
)
for v in d[2]["vocab"]:
    if v["word"] == "velho":
        v.clear()
        v.update({
            "word": "limpar", "surface": "limpou", "type": "verb",
            "definition": "To clean something until all the dirt is gone.",
        })

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 3: velho fuera, limpar dentro")
