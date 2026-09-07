"""Anade la fila del A2 PT a la lista de exentos del lookup de glosas.

Exento NO quiere decir "sin glosa que valga": quiere decir que el lector no
envuelve esa palabra en un span tocable, asi que no deja un toque muerto.
Solo entran las tres categorias que ya usan los bundles hermanos: articulos,
el reparto inventado y los numerales.
"""
import json

RUTA = "scripts/tap-gloss-exempt.json"
d = json.load(open(RUTA, encoding="utf-8"))
d["bundles"]["portuguese-traveler-brazil-a2"] = {
    "articles": ["a", "as", "o", "os", "um", "uma", "uns", "umas", "às"],
    # "alegre" es el segundo trozo de Porto Alegre, igual que "noronha" en el
    # B1: nombre propio del mapa, no una palabra que alguien vaya a tocar.
    "characterNames": ["renata", "gilson", "alegre"],
    "numerals": ["dezoito", "dois", "seis", "três"],
}
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("bundles en la lista de exentos:", len(d["bundles"]))
