"""Los tres retoques que quedaban en el tema 3.

1. Edilson habla en la tercera sin estar nombrado en la apertura. No hay que
   volver a explicar quien es (ya salio en las dos anteriores del tema), basta
   con nombrarlo antes de su primera cita; se mete en una frase que ya existe
   para no mover los bloques de tres.
2. La sinopsis de la tercera repetia la apertura del cuerpo. La sinopsis es el
   ARCO, no el decorado: se reescribe como pregunta.
3. La segunda iba tres palabras por encima de la banda.
"""
import json

RUTA = "scripts/_pta2T3.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[1]["text"] = (
    d[1]["text"]
    .replace(
        "Renata cozinha para seis pessoas que não conhece, e Edilson ainda não chegou da peixaria.",
        "Renata cozinha para seis pessoas que não conhece; Edilson ainda não chegou.",
    )
    .replace(
        "com um ovo frito que ela mesma não pediu.",
        "com um ovo frito que não pediu.",
    )
)

d[2]["text"] = d[2]["text"].replace(
    "Renata não lava nada: a regra é a regra.",
    "Renata não lava nada: a regra é a regra, e Edilson sabe disso.",
)

d[2]["synopsis"] = (
    "A regra da casa diz que quem cozinha não lava, e ontem foi ela quem cozinhou. "
    "O dia inteiro vira uma pergunta em voz baixa: uma regra dita de passagem na pia "
    "vale também quando dá trabalho a quem a disse? Nenhum dos dois cede durante horas, "
    "e a resposta aparece de madrugada sem que ninguém precise dizer mais nada."
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 3: nombrado antes de la cita, sinopsis como arco, banda de palabras")
