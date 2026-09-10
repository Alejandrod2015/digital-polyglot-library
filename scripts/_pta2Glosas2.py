"""Las glosas del tema 2 que no existen en ningun bundle hermano.

Mismo criterio que el tema 1: la glosa sale de la frase de ESTA historia y la
forma conjugada se glosa como esta en el texto, que es lo que el lector toca.
"nilza" no va aqui: es reparto inventado y entra en la lista de exentos.
"""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    # Historia 1: la farmacia
    "pescoço": {"g": "neck", "t": "noun"},
    "dormiu": {"g": "slept", "t": "verb"},
    "remédio": {"g": "medicine", "t": "noun"},
    "ombro": {"g": "shoulder", "t": "noun"},
    "desiste": {"g": "gives up", "t": "verb"},
    "frasco": {"g": "small bottle of medicine", "t": "noun"},
    "embalagem": {"g": "the box a product comes in", "t": "noun"},
    "recomendo": {"g": "I recommend", "t": "verb"},
    "este": {"g": "this one", "t": "pronoun"},
    "amargo": {"g": "bitter", "t": "adjective"},
    "dor": {"g": "pain", "t": "noun"},
    "doença": {"g": "illness", "t": "noun"},
    "cama": {"g": "bed", "t": "noun"},
    "toma": {"g": "takes, as in takes a pill", "t": "verb"},
    "discutir": {"g": "to argue about something", "t": "verb"},
    # Historia 2: la noche
    "colchão": {"g": "mattress", "t": "noun"},
    "afunda": {"g": "sinks in the middle", "t": "verb"},
    "almofada": {"g": "cushion, pillow", "t": "noun"},
    "deita": {"g": "lies down", "t": "verb"},
    "sono": {"g": "sleep, the need to sleep", "t": "noun"},
    "barriga": {"g": "belly", "t": "noun"},
    "estômago": {"g": "stomach", "t": "noun"},
    "nervoso": {"g": "nerves, being on edge", "t": "noun"},
    "jaqueta": {"g": "jacket", "t": "noun"},
    "desce": {"g": "goes down, downstairs", "t": "verb"},
    "surpreender": {"g": "to be surprised by it", "t": "verb"},
    "aguento": {"g": "I can put up with", "t": "verb"},
    "durmo": {"g": "I sleep", "t": "verb"},
    "virando": {"g": "turning over and over in bed", "t": "verb"},
    "contando": {"g": "counting", "t": "verb"},
    "quatro": {"g": "four", "t": "number"},
    "ouviu": {"g": "heard, was told", "t": "verb"},
    "pesar": {"g": "to feel heavy", "t": "verb"},
    "triste": {"g": "sad", "t": "adjective"},
    # Historia 3: la mano de Nilza
    "enrolada": {"g": "wrapped up in cloth", "t": "adjective"},
    "machucou": {"g": "hurt herself", "t": "verb"},
    "caiu": {"g": "fell", "t": "verb"},
    "inchou": {"g": "swelled up", "t": "verb"},
    "osso": {"g": "bone", "t": "noun"},
    "pancada": {"g": "a knock, a blow", "t": "noun"},
    "sangue": {"g": "blood", "t": "noun"},
    "dobrar": {"g": "to bend it", "t": "verb"},
    "nariz": {"g": "nose", "t": "noun"},
    "enruga": {"g": "wrinkles up", "t": "verb"},
    "formiga": {"g": "it tingles, pins and needles", "t": "verb"},
    "engulo": {"g": "I swallow", "t": "verb"},
    "comprimido": {"g": "a tablet, a pill", "t": "noun"},
    "conheço": {"g": "I know it, I have seen it before", "t": "verb"},
    "devolvendo": {"g": "giving it back", "t": "verb"},
    "hospital": {"g": "hospital", "t": "noun"},
    "quadras": {"g": "blocks, city blocks", "t": "noun"},
    "cuido": {"g": "I look after", "t": "verb"},
    "prefiro": {"g": "I prefer", "t": "verb"},
    "vinte": {"g": "twenty", "t": "number"},
    "discutem": {"g": "they argue", "t": "verb"},
    "calmas": {"g": "calm, without raising their voices", "t": "adjective"},
    "protegido": {"g": "protected, held safe", "t": "adjective"},
    "vermelha": {"g": "red", "t": "adjective"},
    "sermão": {"g": "a telling off", "t": "noun"},
    "fraturou": {"g": "it is broken, it fractured", "t": "verb"},
    "tranquila": {"g": "calm and settled", "t": "adjective"},
    "bebem": {"g": "they drink", "t": "verb"},
    "horário": {"g": "the usual opening time", "t": "noun"},
    "duas": {"g": "two, feminine", "t": "number"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {})
d[BUNDLE].update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(NUEVAS)} glosas nuevas; {len(d[BUNDLE])} en total")
