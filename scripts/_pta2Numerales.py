"""Los numerales no se glosan: van a la lista de exentos.

Un numeral no es una palabra tocable (el lector no la envuelve), asi que
darle glosa es lo que `checkGlossVariants` llama "forma que no es de su
variante". Se quitan de las glosas escritas a mano y se anaden donde les toca.
"""
import json

NUMS = ["duas", "vinte", "quatro"]
BUNDLE = "portuguese-traveler-brazil-a2"

# 1. Fuera de las glosas escritas a mano.
RUTA_G = "scripts/_newGlosses.json"
g = json.load(open(RUTA_G, encoding="utf-8"))
quitadas = [n for n in NUMS if g.get(BUNDLE, {}).pop(n, None) is not None]
json.dump(g, open(RUTA_G, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# 2. Dentro de los exentos.
RUTA_E = "scripts/tap-gloss-exempt.json"
e = json.load(open(RUTA_E, encoding="utf-8"))
fila = e["bundles"][BUNDLE]
fila["numerals"] = sorted(set(fila["numerals"]) | set(NUMS))
json.dump(e, open(RUTA_E, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"quitadas de las glosas: {quitadas} · numerales exentos: {fila['numerals']}")
