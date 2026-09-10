"""Las glosas del tema 5. "cleide" y "aquidauana" van a exentos, no aqui."""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    # Historia 1: la estacion
    "guichês": {"g": "ticket windows", "t": "noun"},
    "abertos": {"g": "open, not closed", "t": "adjective"},
    "alto-falante": {"g": "loudspeaker", "t": "noun"},
    "impresso": {"g": "printed out on paper", "t": "adjective"},
    "passagens": {"g": "tickets for a journey", "t": "noun"},
    "mudou": {"g": "changed", "t": "verb"},
    "devo": {"g": "I have to, I am due to", "t": "verb"},
    "estar": {"g": "to be somewhere", "t": "verb"},
    "conexão": {"g": "the connecting bus you have to catch", "t": "noun"},
    "apressado": {"g": "in a hurry", "t": "adjective"},
    "documento": {"g": "official paper that proves who you are", "t": "noun"},
    "nesse": {"g": "on that one", "t": "pronoun"},
    "embarca": {"g": "gets on board", "t": "verb"},
    "volante": {"g": "steering wheel", "t": "noun"},
    "rodovia": {"g": "highway between cities", "t": "noun"},
    # Historia 2: la noche en la carretera
    "cruza": {"g": "crosses", "t": "verb"},
    "semáforo": {"g": "traffic light", "t": "noun"},
    "seta": {"g": "indicator light on a vehicle", "t": "noun"},
    "automóvel": {"g": "motor car", "t": "noun"},
    "estreita": {"g": "narrow", "t": "adjective"},
    "apertado": {"g": "tight, with little room", "t": "adjective"},
    "cruzamento": {"g": "crossroads", "t": "noun"},
    "ronca": {"g": "snores", "t": "verb"},
    "acordar": {"g": "to wake up", "t": "verb"},
    "longa": {"g": "long", "t": "adjective"},
    "encosto": {"g": "the back of a seat", "t": "noun"},
    "meia": {"g": "half, as in half an hour", "t": "adjective"},
    "noites": {"g": "nights", "t": "noun"},
    "ocupado": {"g": "full, with every seat taken", "t": "adjective"},
    # Historia 3: la garagem
    "ficou": {"g": "stayed behind", "t": "verb"},
    "trem": {"g": "train", "t": "noun"},
    "garagem": {"g": "depot where the buses are parked", "t": "noun"},
    "bicicleta": {"g": "bicycle", "t": "noun"},
    "moto": {"g": "motorbike", "t": "noun"},
    "motocicleta": {"g": "motorcycle, the full word", "t": "noun"},
    "freia": {"g": "brakes, stops the vehicle", "t": "verb"},
    "homens": {"g": "men", "t": "noun"},
    "descarregam": {"g": "they unload", "t": "verb"},
    "malas": {"g": "suitcases", "t": "noun"},
    "carregam": {"g": "they load up", "t": "verb"},
    "limparam": {"g": "they cleaned it", "t": "verb"},
    "limpamos": {"g": "we cleaned it", "t": "verb"},
    "mexeu": {"g": "touched it, moved it", "t": "verb"},
    "ganha": {"g": "catches it just in time", "t": "verb"},
    "valeu": {"g": "valeu means thanks, it was worth it", "t": "expression"},
    "dobro": {"g": "double the amount", "t": "noun"},
    "volto": {"g": "I go back", "t": "verb"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {}).update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(NUEVAS)} glosas nuevas; {len(d[BUNDLE])} en total")
