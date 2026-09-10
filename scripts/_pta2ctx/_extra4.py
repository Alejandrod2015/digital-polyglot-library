"""Los dos ultimos huecos: dos verbos que solo salen dentro de una relativa."""
import json
import pathlib

RUTA = pathlib.Path("scripts/_pta2ctx/_huecos.json")
d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault("ninguem-lava-nada-aqui", {})["sobrou"] = {
    "es": "organiza o espaço que sobrou",
    "en": "sorts out the space left over",
}
d.setdefault("a-ultima-pagina", {})["voa"] = {
    "es": "um balão que voa",
    "en": "a balloon that flies off",
}
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("dos ultimos huecos")
