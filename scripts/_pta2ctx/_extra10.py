"""Quita "embaixo" del fichero de huecos.

La palabra desaparecio del cuerpo al mover el remate de la historia del frasco,
pero seguia en _huecos.json, asi que cada pasada la volvia a escribir con un
trozo que ya no existe en el texto. Los huerfanos hay que quitarlos tambien de
la FUENTE, no solo de la base.
"""
import json
import pathlib

RUTA = pathlib.Path("scripts/_pta2ctx/_huecos.json")
d = json.load(open(RUTA, encoding="utf-8"))
quitada = d.get("o-frasco-mais-barato", {}).pop("embaixo", None)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("embaixo quitada:", bool(quitada))
