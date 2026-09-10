"""El ingles de un trozo no puede pasar de PT+3 palabras.

El ingles corriente es mas largo que el portugues en frases cortas, asi que
diecinueve trozos se pasaban del tope. Se aprietan sin perder el sentido, que
es lo que la tarjeta ensena debajo de la definicion: si el ingles cuenta mas
que el trozo, el lector cree que la frase portuguesa dice todo eso.

Y dos trozos partian una oracion por la mitad y no salian tal cual en el
texto; se recortan a su lado util.
"""
import json
import pathlib

DIR = pathlib.Path("scripts/_pta2ctx")

CAMBIOS = {
    "a-caixa-que-nao-chegou": {
        "Gilson tira um giz do bolso": "Gilson takes chalk from his pocket",
    },
    "a-ultima-pagina": {
        "Um homem de boné dança sozinho na esquina": "A man in a cap dances alone at the corner",
    },
    "antes-do-sol": {
        "Não são férias e não é feriado": "It is no holiday and no public holiday",
        "Então aproveita": "Enjoy it then",
    },
    "feijao-salgado-demais": {
        "Puxa o sal e pronto": "It draws the salt out, done",
    },
    "nada-aqui-serve": {
        "Quem lava é Neuza": "The one washing is Neuza",
        "Gente esquece e não volta buscar, explica": "People forget and never come back, she explains",
        "Sozinha aqui, congelada, não dá": "Alone here, frozen through, no good",
    },
    "nilza-fecha-vinte-minutos": {
        "Fraturou, conta": "It is fractured, she says",
    },
    "ninguem-lava-nada-aqui": {
        "Coloca a frigideira no bico bom": "She puts the pan on the good burner",
    },
    "ninguem-sabe-do-exame": {
        "diz ele na terceira errada": "he says at the third mistake",
        "Não vou conseguir. Vai": "I will not manage it. You will",
        "Não vou conseguir": "I will not manage it",
        "Letras. Você quer ensinar idioma? Quero": "Languages. You want to teach a language? I do",
    },
    "o-colchao-vence": {
        "Levanta, veste a jaqueta e desce": "She gets up, puts her jacket on, goes down",
    },
    "o-frasco-mais-barato": {
        "avisar se não passar": "let someone know if it lasts",
    },
    "uma-lampada-so": {
        "acende a luz e abre a cômoda": "she puts the light on and opens the drawers",
    },
    "volto-pelo-caderno": {
        "diz ao da moto": "she tells the motorbike man",
        "Volto pelo caderno": "Going back for the notebook",
    },
}

# Los dos trozos que partian una oracion y no salian tal cual en el texto.
RENOMBRA = {
    "a-panela-que-grudou": {"mas serve. E o milho? Duro": ("E o milho", "And the corn")},
}

# Los que viven en _huecos.json, escritos palabra a palabra.
HUECOS = {
    "nada-aqui-serve": {
        "explica": {"es": "não volta buscar, explica", "en": "never come back, she explains"},
        "congelada": {"es": "Sozinha aqui, congelada", "en": "Alone here, frozen through"},
    },
    "nilza-fecha-vinte-minutos": {
        "fraturou": {"es": "Fraturou, conta", "en": "It is fractured, she says"},
        "conta": {"es": "Fraturou, conta", "en": "It is fractured, she says"},
    },
    "ninguem-sabe-do-exame": {
        "devagar": {"es": "Devagar", "en": "Slowly"},
    },
    "o-frasco-mais-barato": {
        "volta": {"es": "Se ficar pior, volta", "en": "If it gets worse, she returns"},
    },
}

n = 0
for slug, cambios in CAMBIOS.items():
    f = DIR / f"{slug}.json"
    d = json.load(open(f, encoding="utf-8"))
    for es, en in cambios.items():
        if es not in d:
            continue  # viene de _huecos.json, se aprieta abajo
        d[es] = en
        n += 1
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

for slug, cambios in RENOMBRA.items():
    f = DIR / f"{slug}.json"
    d = json.load(open(f, encoding="utf-8"))
    for viejo, (nuevo, en) in cambios.items():
        d.pop(viejo, None)
        d[nuevo] = en
        n += 1
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

fh = DIR / "_huecos.json"
h = json.load(open(fh, encoding="utf-8"))
for slug, palabras in HUECOS.items():
    h.setdefault(slug, {}).update(palabras)
    n += len(palabras)
json.dump(h, open(fh, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"trozos apretados: {n}")
