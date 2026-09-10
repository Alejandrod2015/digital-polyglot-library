"""Los trece trozos del B1 cuyo ingles pasa del tope (PT+3 palabras).

El ingles corriente es mas largo que el portugues en frases cortas: "ri
sozinha na fila" son cuatro palabras y "she laughs on her own in the queue"
son ocho. Se aprietan sin perder el sentido; si el ingles cuenta mas que el
trozo, el lector cree que la frase portuguesa dice todo eso.
"""
import json
import pathlib

DIR = pathlib.Path("scripts/_ctxB1")

CAMBIOS = {
    "chuva-na-marginal": {
        "Na marginal a chuva pega o trânsito parado": "On the riverside road rain catches the stalled traffic",
    },
    "tchau-no-engarrafamento": {
        "ele desce no acostamento": "he gets out on the hard shoulder",
    },
    "estacao-tubo-as-seis": {
        "a estação-tubo já tem fila no degrau": "the tube station already has a queue outside",
    },
    "mais-um-pouquinho": {
        "deixar no prato e elogiar alto": "leave some and praise it out loud",
    },
    "dinheiro-na-mao-errada": {
        "A maré subiu e a rua virou canal": "The tide came up and the street became a channel",
    },
    "o-telefone-sublinhado": {
        "ri sozinha na fila": "she laughs to herself, queueing",
    },
    "regra-no-lugar-da-foto": {
        "ri sozinha do risco duplo": "she laughs at the double line",
    },
    "tornozelo-na-subida": {
        "Na enfermaria do posto": "In the first aid room",
    },
    "tartaruga-na-desova": {
        "Hoje não vamos ao recife do folheto": "Today we skip the reef on the leaflet",
    },
    "sorteio-para-dezembro": {
        "No parapeito tem uma lista pregada com percevejo": "On the ledge a list is pinned up with a tack",
    },
    "o-andar-certo": {
        "ri sozinha no elevador": "she laughs to herself in the lift",
        "Pede a certidão negativa junto": "Ask for the clearance certificate too",
    },
    "deferido-no-diario": {
        "Sai quando sair": "It comes out when it does",
    },
}

n = 0
for slug, cambios in CAMBIOS.items():
    f = DIR / f"{slug}.json"
    d = json.load(open(f, encoding="utf-8"))
    for es, en in cambios.items():
        assert es in d, (slug, es)
        d[es] = en
        n += 1
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"trozos apretados: {n}")
