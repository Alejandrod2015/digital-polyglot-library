"""La ultima: "educados" cae en un trozo de una sola palabra tocable, que el
troceador descarta, asi que va palabra a palabra como el resto de huecos."""
import json
import pathlib

RUTA = pathlib.Path("scripts/_pta2ctx/_huecos.json")
d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault("a-caixa-que-nao-chegou", {})["educados"] = {
    "es": "escrevem devagar, educados",
    "en": "they write slowly, politely",
}
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ultimo hueco")
