"""Las glosas del tema 7. "neuza" y "gramado" van a exentos, no aqui."""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    # Historia 1: la ropa de verano
    "portas": {"g": "doors", "t": "noun"},
    "abertas": {"g": "open", "t": "adjective"},
    "camisetas": {"g": "t-shirts", "t": "noun"},
    "saia": {"g": "skirt", "t": "noun"},
    "suéter": {"g": "jumper, a warm knitted top", "t": "noun"},
    "cachecol": {"g": "scarf for the neck", "t": "noun"},
    "luva": {"g": "glove", "t": "noun"},
    "par": {"g": "pair; sem par means with no matching one", "t": "noun"},
    "buscar": {"g": "to come and fetch it", "t": "verb"},
    "invernos": {"g": "winters", "t": "noun"},
    "despe": {"g": "takes it off", "t": "verb"},
    "chá": {"g": "tea", "t": "noun"},
    "convida": {"g": "invites her over", "t": "verb"},
    "congelada": {"g": "frozen through, unable to warm up", "t": "adjective"},
    "fecho": {"g": "I close up", "t": "verb"},
    "meias": {"g": "socks", "t": "noun"},
    "secam": {"g": "they dry out", "t": "verb"},
    "cansa": {"g": "it wears you out", "t": "verb"},
    "viajar": {"g": "to travel", "t": "verb"},
    # Historia 2: la lampara
    "lâmpada": {"g": "light bulb", "t": "noun"},
    "cortina": {"g": "curtain", "t": "noun"},
    "tapete": {"g": "rug on the floor", "t": "noun"},
    "lavanderia": {"g": "laundry, where clothes are washed for you", "t": "noun"},
    "caneca": {"g": "mug", "t": "noun"},
    "uso": {"g": "use; de tanto uso means from being used so much", "t": "noun"},
    "vocês": {"g": "you, speaking to more than one person", "t": "pronoun"},
    "vivem": {"g": "they live, they get by", "t": "verb"},
    "pijama": {"g": "pyjamas", "t": "noun"},
    "nesta": {"g": "in this one, feminine", "t": "pronoun"},
    "pensei": {"g": "I have thought about it", "t": "verb"},
    "cômoda": {"g": "chest of drawers", "t": "noun"},
    "fronha": {"g": "pillowcase", "t": "noun"},
    "gelada": {"g": "icy cold to the touch", "t": "adjective"},
    "permanece": {"g": "stays exactly as she is", "t": "verb"},
    "mexer": {"g": "to move, to shift about", "t": "verb"},
    "esquentar": {"g": "to warm up", "t": "verb"},
    "faixa": {"g": "a strip, here a strip of light", "t": "noun"},
    "roxa": {"g": "purple", "t": "adjective"},
    # Historia 3: la ultima pagina
    "ensaia": {"g": "rehearses it", "t": "verb"},
    "desfile": {"g": "street parade", "t": "noun"},
    "passeia": {"g": "walks about with no hurry", "t": "verb"},
    "gravata": {"g": "tie worn at the neck", "t": "noun"},
    "visito": {"g": "I come and see you", "t": "verb"},
    "brincam": {"g": "they joke about it", "t": "verb"},
    "desafinado": {"g": "out of tune", "t": "adjective"},
    "sapato": {"g": "shoe", "t": "noun"},
    "colorido": {"g": "colourful", "t": "adjective"},
    "pula": {"g": "jumps over it", "t": "verb"},
    "linhas": {"g": "lines of writing", "t": "noun"},
    "tênis": {"g": "trainers", "t": "noun"},
    "vermelhos": {"g": "red", "t": "adjective"},
    "balão": {"g": "balloon", "t": "noun"},
    "voa": {"g": "flies away", "t": "verb"},
    "apontava": {"g": "used to point at things instead of saying them", "t": "verb"},
    "deseja": {"g": "wants it enough to say so", "t": "verb"},
    "ama": {"g": "loves it", "t": "verb"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {}).update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(NUEVAS)} glosas nuevas; {len(d[BUNDLE])} en total")
