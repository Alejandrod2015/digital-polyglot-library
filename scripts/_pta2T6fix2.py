"""Los tres del cierre del tema 6.

1. "diz" cerraba 6 de las 11 citas (55%, tope 40%). Se cambian dos verbos y
   una acotacion desaparece entera: Wilson levanta el paquete y la frase se
   sostiene sola.
2. Renata llegaba a la primera del tema sin sintagma que diga que es. Se le
   pone la forma de oficio, que ademas explica por que la reunion importa:
   trabaja para una empresa que nunca ha visto.
3. Las tres historias tenian SEIS parrafos exactos. Es aviso, no fallo, pero
   leidas seguidas se nota; la primera pasa a cinco.
"""
import json

RUTA = "scripts/_pta2T6.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[0]["text"] = (
    d[0]["text"]
    .replace(
        "Em Petrópolis faz frio de manhã. O carregador do notebook de Renata parou de funcionar ontem à noite. Amanhã tem reunião com a empresa que paga o trabalho dela.",
        "Em Petrópolis faz frio de manhã. Renata trabalha para uma empresa que nunca viu, e o carregador do notebook dela parou de funcionar ontem à noite. Amanhã tem reunião.",
    )
    .replace("“Esse modelo eu não tenho”, diz ele,", "“Esse modelo eu não tenho”, responde ele,")
    # Dos parrafos en uno: la primera baja a cinco y deja de clonar la forma.
    .replace(
        "pergunta pelo correio.\n\n“O correio fecha ao meio-dia",
        "pergunta pelo correio. “O correio fecha ao meio-dia",
    )
)

d[1]["text"] = d[1]["text"].replace(
    "“A gente aceita”, diz a chefe depois.",
    "“A gente aceita”, responde a chefe depois.",
)

d[2]["text"] = d[2]["text"].replace(
    "“Pesado assim não cabe em envelope”, diz Wilson.",
    "Wilson levanta o pacote. “Pesado assim não cabe em envelope.”",
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 6: acotacion repartida, Renata presentada, y la primera a cinco parrafos")
