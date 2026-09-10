"""Los ultimos cuatro del tema 6.

El mas de fondo: "fechar" y "fechado" caian en la MISMA historia, y eso son
dos plazas para una raiz. Se reparten, que ademas es lo natural: en la primera
el correo esta cerrado (estado) y en la tercera cierra a las cinco (accion).
"""
import json

RUTA = "scripts/_pta2T6.json"
d = json.load(open(RUTA, encoding="utf-8"))

# 1. "fechado" pasa a la primera y "hoje" a la tercera: misma raiz repartida.
d[0]["text"] = d[0]["text"].replace(
    "“O correio fecha ao meio-dia e hoje é sábado”, diz Wilson.",
    "“O correio fecha ao meio-dia e no domingo fica fechado”, diz Wilson.",
)
for v in d[0]["vocab"]:
    if v["word"] == "hoje":
        v.clear()
        v.update({"word": "fechado", "type": "adjective",
                  "definition": "Closed, not serving anybody until it opens again."})
for v in d[2]["vocab"]:
    if v["word"] == "fechado":
        v.clear()
        v.update({"word": "hoje", "type": "adverb",
                  "definition": "Today, on this day and on no other."})

# 2. Ancla sensorial en la tercera: el frio de Petropolis, que ya esta en la
#    lista del detector y ademas cierra la escena en la calle.
d[2]["text"] = d[2]["text"].replace(
    "Depois lê uma notícia curta: o contrato dos quatro meses está fechado.",
    "Depois lê uma notícia curta: o contrato dos quatro meses saiu. Lá fora faz frio e ela não fecha o casaco.",
)

# 3. Definiciones por debajo de las ocho palabras.
DEFS = {
    "vez": "Time, one single occasion among several other ones.",
    "mandar": "To send something off to somebody else far away.",
    "aberto": "Open, still serving all the people who arrive.",
    "preto": "Black, the darkest colour that there is anywhere.",
}
for s in d:
    for v in s["vocab"]:
        if v.get("word") in DEFS:
            v["definition"] = DEFS[v["word"]]

# 4. La segunda, siete palabras por encima de la banda.
d[1]["text"] = (
    d[1]["text"]
    .replace("Renata tem dez minutos e o emprego dela depende disso.", "Renata tem dez minutos e o emprego depende disso.")
    .replace("Ela digita a senha duas vezes e entra na chamada.", "Ela digita a senha e entra na chamada.")
    .replace("Renata faz uma pergunta e depois oferece uma terceira saída.", "Renata faz uma pergunta e oferece uma terceira saída.")
    .replace("Wilson deixa um café na mesa e não pergunta nada.", "Wilson deixa um café na mesa.")
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 6: raiz repartida, ancla sensorial, definiciones y banda")
