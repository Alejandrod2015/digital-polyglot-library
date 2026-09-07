"""Cuarta ronda del tema 2: los dos fallos que solo aparecen con las seis
historias delante.

1. journey-quoted-speech-band. La segunda iba en 16% y la tercera en 22%,
   contra una banda de 25-35%. En las dos, lo que faltaba era dialogo de
   verdad: la segunda contaba en narracion los consejos que Nilza DA en voz
   alta, y en la tercera Renata cedia sin decir nada.
2. journey-opening-shape. Tres de seis abrian con nombre o sustantivo desnudo,
   y el tope es un tercio. La primera del tema 2 pasa a abrir por el lugar.
"""
import json

RUTA = "scripts/_pta2T2.json"
d = json.load(open(RUTA, encoding="utf-8"))

# 2. Otra forma de apertura, sin perder las tres frases de narracion que el
#    bloque de presentacion necesita.
d[0]["text"] = d[0]["text"].replace(
    "Renata chega a Recife com o pescoço travado; ontem dormiu mal e hoje não vira a cabeça. "
    "Quem atende é Nilza, uma mulher que trabalha na farmácia desde que a loja abriu.",
    "Em Recife o pescoço de Renata trava de vez; ontem dormiu mal e hoje não vira a cabeça. "
    "Quem atende na farmácia da esquina é Nilza, uma mulher que trabalha ali desde que a loja abriu.",
)

# 1a. Los consejos, dichos y no resumidos.
d[1]["text"] = d[1]["text"].replace(
    "Nilza sai de trás do balcão e explica devagar. "
    "Manda respirar contando até quatro, com o quarto morno e nunca quente. "
    "A janela aberta um dedo, e o telefone longe da cama.",
    "Nilza sai de trás do balcão e explica devagar. "
    "“Você respira contando até quatro”, diz. "
    "“O quarto morno, nunca quente, a janela aberta um dedo e o telefone longe da cama.”",
)

# 1b. Renata insiste en voz alta, que ademas es de donde sale el titulo.
d[2]["text"] = (
    d[2]["text"]
    .replace(
        "Nilza se machucou na véspera: uma caixa caiu da prateleira, o dedo inchou e a mão pesa.",
        "Nilza se machucou ontem: uma caixa caiu, o dedo inchou e a mão pesa.",
    )
    .replace(
        "Nilza dobra, faz que não com a cabeça, e o nariz enruga sozinho.",
        "Nilza dobra, faz que não, e o nariz enruga sozinho.",
    )
    .replace(
        "Nilza prefere não fechar a loja. As duas discutem em voz baixa, calmas.",
        "“Eu prefiro não fechar”, responde Nilza. “Vinte minutos”, insiste Renata. "
        "“Eu fico no balcão e não vendo nada.” As duas discutem em voz baixa, calmas.",
    )
    .replace(
        "e Renata serve um café fraco e ruim que as duas bebem assim mesmo.",
        "e Renata serve um café fraco e ruim que as duas bebem.",
    )
)
for v in d[2]["vocab"]:
    if v["word"] == "preferir":
        v["surface"] = "prefiro"

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 2: banda de citado y forma de apertura")
