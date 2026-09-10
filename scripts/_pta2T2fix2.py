"""Segunda ronda del tema 2.

El lector agrupa de TRES FRASES en tres, no por parrafos, asi que dos bloques
llevaban siete plazas cada uno aunque los parrafos estuvieran repartidos. Se
parten las frases largas y se mueven dos plazas de bloque; no se toca la
escena. La tercera baja de 174 palabras a la banda.
"""
import json

RUTA = "scripts/_pta2T2.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[1]["text"] = (
    "O colchão da pousada afunda no meio e a almofada é fina como um pano dobrado. "
    "Renata deita, vira, senta, deita de novo; o sono não vem.\n\n"
    "À uma da manhã a barriga entra na conta. Ela não sabe se é o estômago ou o nervoso. "
    "Levanta, veste a jaqueta e desce.\n\n"
    "Nilza está no turno da noite, com um café frio na mão. "
    "“A senhora de novo”, diz ela, sem se surpreender. "
    "“Eu não aguento esse quarto”, reclama Renata. "
    "“Não durmo, não acordo, fico virando.”\n\n"
    "Nilza sai de trás do balcão e explica devagar. "
    "Respirar contando até quatro, o quarto morno e nunca quente. "
    "A janela aberta um dedo, e o telefone longe da cama.\n\n"
    "“Isso não dura a noite inteira”, diz Nilza. “Falta pouco pro sol.” "
    "Renata volta, faz o que ouviu e sente o corpo pesar. "
    "Dorme sem nada triste na cabeça, e o quarto, de repente, serve."
)

d[2]["text"] = (
    d[2]["text"]
    .replace("Renata pergunta se dói quando ela dobra o dedo.", "Renata pergunta se dói ao dobrar o dedo.")
    .replace("e a orelha vermelha de tanto ouvir sermão", "e a orelha vermelha do sermão")
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 2: bloques reequilibrados y tercera dentro de banda")
