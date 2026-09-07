"""Las nueve palabras que quedaron al descubierto al borrar los trozos viejos.

Estaban cubiertas por trozos largos que dejaron de existir al apretar el
troceador, y solo aparecen dentro de una cita muy corta ("Duro.", "Fico.",
"Quero."). Van palabra a palabra, como el resto de los huecos.
"""
import json
import pathlib

RUTA = pathlib.Path("scripts/_pta2ctx/_huecos.json")
d = json.load(open(RUTA, encoding="utf-8"))

NUEVOS = {
    "ninguem-sabe-do-exame": {
        "letras": {"es": "Pra universidade. Letras", "en": "For university. Languages"},
        "quero": {"es": "idioma? Quero", "en": "a language? I do"},
        "vai": {"es": "Vai", "en": "You will"},
        "sim": {"es": "para acreditar que sim", "en": "to believe that he did"},
    },
    "o-colchao-vence": {
        "que": {"es": "faz o que ouviu", "en": "does what she was told"},
    },
    "a-panela-que-grudou": {
        "mole": {"es": "Mole, mas serve", "en": "Soft, but it will do"},
        "duro": {"es": "Duro", "en": "Hard"},
    },
    "antes-do-sol": {
        "fico": {"es": "Fico", "en": "I stay"},
    },
    "quatro-meses-nao-dois": {
        "que": {"es": "o silêncio dura o que ela não aguenta",
                "en": "the silence lasts longer than she can bear"},
    },
}

# El ingles de este se pasaba del tope y vive aqui, no en el fichero de trozos.
d["o-colchao-vence"]["levanta"] = {
    "es": "Levanta, veste a jaqueta e desce",
    "en": "She gets up, dresses and goes down",
}

n = 1
for slug, palabras in NUEVOS.items():
    d.setdefault(slug, {}).update(palabras)
    n += len(palabras)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"huecos anadidos o apretados: {n}")
