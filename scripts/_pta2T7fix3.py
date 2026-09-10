"""Los dos ultimos del tema 7.

Renata llegaba a la primera del tema sin sintagma que diga que es: al cerrar
un tema el conjunto son sus tres historias, y ahi esta es su primera
aparicion. Se le pone la aposicion, que no toca el recuento del journey
porque su primera aparicion de verdad sigue siendo la del tema 1.

Y las tres tenian seis parrafos exactos: la segunda pasa a cinco.
"""
import json

RUTA = "scripts/_pta2T7.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[0]["text"] = (
    d[0]["text"]
    .replace(
        "Em Gramado faz frio de verdade, e Renata chega com roupa de praia.",
        "Em Gramado faz frio de verdade, e Renata, uma professora em viagem, chega com roupa de praia.",
    )
    .replace("Tudo o que traz na mala está molhado da chuva do ônibus.", "Tudo na mala está molhado da chuva do ônibus.")
    .replace("Renata não tem resposta: trouxe duas camisetas e uma saia.", "Não tem resposta: trouxe duas camisetas e uma saia.")
)

d[1]["text"] = d[1]["text"].replace(
    "põe por cima dos pés.\n\nPermanece assim,",
    "põe por cima dos pés. Permanece assim,",
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 7: Renata presentada, y la segunda a cinco parrafos")
