"""Las glosas del tema 3 que no existen en ningun bundle hermano.

"edilson" y "jericoacoara" no van aqui: reparto inventado y nombre del mapa,
los dos a la lista de exentos, igual que Renata, Gilson y Nilza.
"""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    # Historia 1: la cocina comun
    "coletiva": {"g": "shared by everyone in the house", "t": "adjective"},
    "garfos": {"g": "forks", "t": "noun"},
    "sujos": {"g": "dirty", "t": "adjective"},
    "cozinhar": {"g": "to cook", "t": "verb"},
    "fogão": {"g": "cooker, stove", "t": "noun"},
    "bocas": {"g": "burners on a cooker", "t": "noun"},
    "pratos": {"g": "plates, dishes", "t": "noun"},
    "peixaria": {"g": "fish shop", "t": "noun"},
    "lavo": {"g": "I wash up", "t": "verb"},
    "limpo": {"g": "clean", "t": "adjective"},
    "esponja": {"g": "sponge for washing dishes", "t": "noun"},
    "guarda": {"g": "puts away", "t": "verb"},
    "organiza": {"g": "sorts out, arranges", "t": "verb"},
    "espaço": {"g": "space, room", "t": "noun"},
    "sobrou": {"g": "was left over", "t": "verb"},
    "vassoura": {"g": "broom", "t": "noun"},
    "frigideira": {"g": "frying pan", "t": "noun"},
    "bico": {"g": "burner on a cooker", "t": "noun"},
    "alho": {"g": "garlic", "t": "noun"},
    "logo": {"g": "soon, straight away", "t": "adverb"},
    "cozinho": {"g": "I cook", "t": "verb"},
    # Historia 2: el feijao salado
    "cebola": {"g": "onion", "t": "noun"},
    "azeite": {"g": "olive oil", "t": "noun"},
    "prepara": {"g": "gets it ready", "t": "verb"},
    "feijão": {"g": "beans, the everyday dish with rice", "t": "noun"},
    "tomate": {"g": "tomato", "t": "noun"},
    "arroz": {"g": "rice", "t": "noun"},
    "posta": {"g": "laid, said of the table", "t": "adjective"},
    "tirar": {"g": "to take off, to take out", "t": "verb"},
    "boné": {"g": "cap with a peak", "t": "noun"},
    "quieto": {"g": "quiet, saying nothing", "t": "adjective"},
    "crua": {"g": "raw, not cooked", "t": "adjective"},
    "morreu": {"g": "died", "t": "verb"},
    "salgada": {"g": "salty", "t": "adjective"},
    "comível": {"g": "edible, good enough to eat", "t": "adjective"},
    "comenta": {"g": "says anything about it", "t": "verb"},
    "janta": {"g": "has dinner", "t": "verb"},
    "ovo": {"g": "egg", "t": "noun"},
    "salvo": {"g": "saved, rescued", "t": "adjective"},
    # Historia 3: la olla pegada
    "passou": {"g": "spent, as in spent the night", "t": "verb"},
    "grudou": {"g": "stuck to the bottom", "t": "verb"},
    "geladeira": {"g": "fridge", "t": "noun"},
    "esvazia": {"g": "empties out", "t": "verb"},
    "escorre": {"g": "drains", "t": "verb"},
    "macarrão": {"g": "pasta", "t": "noun"},
    "cogumelo": {"g": "mushroom", "t": "noun"},
    "milho": {"g": "corn", "t": "noun"},
    "duro": {"g": "hard", "t": "adjective"},
    "cenoura": {"g": "carrot", "t": "noun"},
    "alface": {"g": "lettuce", "t": "noun"},
    "rega": {"g": "pours dressing over it", "t": "verb"},
    "vinagre": {"g": "vinegar", "t": "noun"},
    "lavar": {"g": "to wash up", "t": "verb"},
    "cozinhou": {"g": "cooked", "t": "verb"},
    "solta": {"g": "drops, lets go of", "t": "verb"},
    "onze": {"g": "eleven o'clock", "t": "noun"},
    "gordura": {"g": "grease, fat", "t": "noun"},
    "derreteu": {"g": "melted off", "t": "verb"},
    "gorda": {"g": "thick, said of handwriting", "t": "adjective"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {}).update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(NUEVAS)} glosas nuevas; {len(d[BUNDLE])} en total")
