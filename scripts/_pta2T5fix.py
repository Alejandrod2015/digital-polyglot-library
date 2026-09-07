"""Primera ronda del tema 5.

Dos historias salieron sin NINGUNA ancla sensorial: son las dos mas
"logisticas" del journey (un guichê y una garagem) y se nota, porque sin una
sola nota de olor, luz o sonido la apertura es una ficha tecnica.

Y Gilson: nombrarlo en el flashback lo convertia en personaje nuevo que habla
sin presentar. El recuerdo funciona igual sin el nombre, y ademas asi no mete
un personaje del tema 1 en el reparto del tema 5.
"""
import json

RUTA = "scripts/_pta2T5.json"
d = json.load(open(RUTA, encoding="utf-8"))

DEFS = {
    "nunca": "Never, at no time and in no case.",
    "lento": "Slow, taking longer than it normally would take.",
}
for s in d:
    for v in s["vocab"]:
        if v["word"] in DEFS:
            v["definition"] = DEFS[v["word"]]

# Titulo con ancla concreta en vez del sustantivo generico "noite".
d[0]["title"] = "Três guichês abertos"
d[0]["slug"] = "tres-guiches-abertos"
# Ancla sensorial: el sonido del alto-falante.
d[0]["text"] = d[0]["text"].replace(
    "Na estação de Campo Grande há doze guichês e três abertos.",
    "Na estação de Campo Grande há doze guichês e três abertos. Um alto-falante repete um nome e ninguém atende.",
)

d[2]["text"] = d[2]["text"].replace(
    "Faz dois meses, em Salvador, Gilson escreveu a primeira palavra.",
    "Faz dois meses, em Salvador, um rapaz que varria a sala escreveu a primeira palavra.",
).replace(
    "A rua é larga e vazia.",
    "A rua é larga e vazia, e o motor esquenta debaixo dela.",
)
d[2]["synopsis"] = (
    "Um caderno de duas páginas por dia não vale nada para ninguém mais, e é a única coisa "
    "que ela não pode comprar de novo em nenhuma cidade do caminho. Entre a conexão salva e "
    "as três horas de espera há um preço que ela paga sem discutir, e o homem que o recebe "
    "acha que é dinheiro demais por sete minutos de rua vazia."
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 5: anclas sensoriales, definiciones, titulo y sinopsis")
