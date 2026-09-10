"""Las palabras que entraron al retocar los temas 3 y 7 por la variedad de
formas de presentacion."""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    "limpou": {"g": "cleaned it", "t": "verb"},
    "rindo": {"g": "laughing", "t": "verb"},
    "sorri": {"g": "smiles", "t": "verb"},
    "esquina": {"g": "street corner", "t": "noun"},
    "atende": {"g": "serves the people who come in", "t": "verb"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {}).update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(d[BUNDLE])} glosas escritas a mano")
