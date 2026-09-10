"""Los dos bloques que quedaban: el ultimo sin ninguna plaza y el tercero con seis.

El ultimo bloque del lector era una frase suelta de cierre; se le da una plaza
sin anadir palabras, y el tercero pierde la repeticion de "canoa" que lo
cargaba.
"""
import json

RUTA = "scripts/_pta2T4.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[1]["text"] = (
    d[1]["text"]
    .replace("o vento empurra a canoa para o lado", "o vento empurra o casco para o lado")
    .replace("Ele olha o céu e não responde.", "Ele olha o céu alto e não responde.")
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 4: bloque final con plaza, tercero aligerado")
