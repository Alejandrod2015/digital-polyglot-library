"""La palabra que entro al reescribir la presentacion de Renata."""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {})["escolas"] = {"g": "schools", "t": "noun"}
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(d[BUNDLE])} glosas escritas a mano")
