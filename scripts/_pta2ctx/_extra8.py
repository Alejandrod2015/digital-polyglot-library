"""Los trozos que cambiaron con los cinco retoques de la revision de arco."""
import json
import pathlib

DIR = pathlib.Path("scripts/_pta2ctx")

NUEVOS = {
    "volto-pelo-caderno": {
        "Entra no primeiro por engano e sai": "She gets into the first by mistake and out again",
        "No terceiro": "In the third one",
        "o caderno está na poltrona": "the notebook is on the seat",
    },
    "quatro-meses-nao-dois": {
        "Pela primeira vez o assunto": "For the first time the thing",
        "real não era o dinheiro": "at stake was not the money",
    },
    "a-caixa-que-nao-chegou": {
        "escrevem devagar": "they write slowly",
        "sem barulho": "with no noise",
    },
    "uma-lampada-so": {
        "Ela olha a faixa até dormir": "She watches the strip until she sleeps",
        "com o nariz vivo de frio": "with her nose alive with cold",
    },
    "quinze-folhas-e-barbante": {
        "Um aviso na caixinha do balcão": "A notice in the box on the counter",
    },
}

n = 0
for slug, extra in NUEVOS.items():
    f = DIR / f"{slug}.json"
    d = json.load(open(f, encoding="utf-8"))
    d.update(extra)
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    n += len(extra)
print(f"trozos anadidos: {n}")
