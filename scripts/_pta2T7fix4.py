"""Deshace la fusion de la segunda y la hace en la tercera.

Juntar los dos ultimos parrafos de "Uma lampada so" dejaba diez plazas en uno
(50%, tope 30%): esa historia tiene el vocabulario amontonado al final por
construccion, porque el remate es el cuarto entero. La tercera admite la
fusion sin pasarse, y con eso el tema deja de tener las tres historias con
seis parrafos exactos.
"""
import json

RUTA = "scripts/_pta2T7.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[1]["text"] = d[1]["text"].replace(
    "põe por cima dos pés. Permanece assim,",
    "põe por cima dos pés.\n\nPermanece assim,",
)

d[2]["text"] = d[2]["text"].replace(
    "“Eu volto e visito a senhora”, promete ela.\n\n“Então volta em junho”",
    "“Eu volto e visito a senhora”, promete ela. “Então volta em junho”",
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 7: la fusion pasa a la tercera")
