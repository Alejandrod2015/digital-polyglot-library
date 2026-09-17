"""Las palabras que entraron con los cinco retoques de la revision de arco."""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    "escrevem": {"g": "they write", "t": "verb"},
    "educados": {"g": "polite, well behaved", "t": "adjective"},
    "vivo": {"g": "alive, and feeling it", "t": "adjective"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {}).update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(d[BUNDLE])} glosas escritas a mano")
