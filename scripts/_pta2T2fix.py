"""Los cinco arreglos que pidio el validador en el tema 2, aplicados de una vez."""
import json

RUTA = "scripts/_pta2T2.json"
d = json.load(open(RUTA, encoding="utf-8"))

# 1. Definiciones por debajo de las 8 palabras que pide la spec.
FIX = {
    "precisar": "To need something you really cannot manage without.",
    "ontem": "Yesterday, the day that came right before today.",
    "acordar": "To wake up and stop being asleep again.",
    "triste": "Sad, low in spirits about something that happened.",
    "osso": "Bone, one of the hard parts inside your body.",
    "sangue": "Blood, the red liquid that runs inside your body.",
    "fraco": "Weak, without much strength, or without much flavour.",
    "amanhã": "Tomorrow, the day that comes right after today.",
}
for s in d:
    for v in s["vocab"]:
        if v["word"] in FIX:
            v["definition"] = FIX[v["word"]]

# 2. S1: el lector agrupa de tres frases en tres, asi que la presentacion
#    necesita tres frases de narracion antes de la primera cita.
d[0]["text"] = d[0]["text"].replace(
    "desde que a loja abriu.\n\n",
    "desde que a loja abriu. O balcão é alto e a fila é curta.\n\n",
)

# 3. S2: UN solo ancla sensorial (temperatura), y sin repetir cama ni colchao,
#    que era lo que amontonaba diez plazas en un bloque.
d[1]["text"] = (
    d[1]["text"]
    .replace("a almofada cheira a armário", "a almofada é fina como um pano dobrado")
    .replace("Eu não aguento essa cama", "Eu não aguento esse quarto")
    .replace(
        "o quarto morno e nunca quente, a almofada no chão se o colchão afunda no meio.",
        "o quarto morno e nunca quente, a janela aberta um dedo.",
    )
)

# 4. S3: la apertura tiene que CERRAR en narracion, no en una cita.
# 5. S3: titulo fuera de la formula "X de Y", y cuerpo dentro de la banda.
d[2]["title"] = "Nilza fecha vinte minutos"
d[2]["slug"] = "nilza-fecha-vinte-minutos"
d[2]["text"] = (
    d[2]["text"]
    .replace(
        "a mão pesa. No pano há sangue seco. “Não é osso”, diz ela. “É pancada.”",
        "a mão pesa. “Não é osso”, diz ela. “É pancada.” No pano há sangue seco.",
    )
    .replace(
        "As duas discutem em voz baixa, calmas, e a loja fica fechada vinte minutos.",
        "As duas discutem em voz baixa, calmas.",
    )
    .replace(
        "Fica tranquila atrás do balcão o resto do dia, a mão apoiada numa almofada,",
        "Fica tranquila atrás do balcão, a mão apoiada numa almofada,",
    )
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 2: cinco arreglos aplicados")
