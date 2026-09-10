"""Los trozos que cambiaron al arreglar los tres defectos de arco."""
import json
import pathlib

DIR = pathlib.Path("scripts/_pta2ctx")

NUEVOS = {
    "volto-pelo-caderno": {
        "já limparam": "have they cleaned it",
    },
    "o-frasco-mais-barato": {
        "Escreve avisar se não passar": "She writes: say something if it lasts",
        "na última linha do caderno": "on the last line of the notebook",
        "guarda o frasco no bolso": "and puts the bottle in her pocket",
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
