"""Las glosas del tema 4. "damiao" y "lencois" van a exentos, no aqui."""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    # Historia 1: la tormenta
    "tempestade": {"g": "storm", "t": "noun"},
    "deixou": {"g": "left it, made it stay that way", "t": "verb"},
    "excursão": {"g": "day trip you book and pay for", "t": "noun"},
    "região": {"g": "region, this part of the country", "t": "noun"},
    "comprada": {"g": "already bought", "t": "adjective"},
    "canoa": {"g": "canoe", "t": "noun"},
    "clima": {"g": "the weather over a season", "t": "noun"},
    "melhora": {"g": "gets better", "t": "verb"},
    "janeiro": {"g": "January", "t": "noun"},
    "nasci": {"g": "I was born", "t": "verb"},
    "trovão": {"g": "thunder", "t": "noun"},
    "esfria": {"g": "gets colder", "t": "verb"},
    "minta": {"g": "should lie, from mentir", "t": "verb"},
    "diga": {"g": "should tell, from dizer", "t": "verb"},
    "feio": {"g": "ugly; of weather, threatening", "t": "adjective"},
    "desistir": {"g": "to give up", "t": "verb"},
    "campo": {"g": "open ground outside town", "t": "noun"},
    "esconde": {"g": "hides it from view", "t": "verb"},
    "contente": {"g": "pleased, glad", "t": "adjective"},
    "remos": {"g": "paddles", "t": "noun"},
    "sobre": {"g": "on, over", "t": "preposition"},
    # Historia 2: el rio
    "rema": {"g": "rows, paddles", "t": "verb"},
    "fazer": {"g": "to do, to make", "t": "verb"},
    "desceu": {"g": "came down", "t": "verb"},
    "rápida": {"g": "fast", "t": "adjective"},
    "floresta": {"g": "forest", "t": "noun"},
    "temperatura": {"g": "temperature", "t": "noun"},
    "remo": {"g": "paddle for a canoe", "t": "noun"},
    "atravessam": {"g": "they cross over", "t": "verb"},
    "balançam": {"g": "they rock from side to side", "t": "verb"},
    "agarra": {"g": "grabs hold of", "t": "verb"},
    "solto": {"g": "loose, not held tight", "t": "adjective"},
    "puxar": {"g": "to pull", "t": "verb"},
    "montanha": {"g": "mountain; here a high pile of sand", "t": "noun"},
    "curvada": {"g": "curved", "t": "adjective"},
    "embora": {"g": "ir embora means to go away", "t": "adverb"},
    # Historia 3: antes del sol
    "estrela": {"g": "star", "t": "noun"},
    "lua": {"g": "moon", "t": "noun"},
    "pronta": {"g": "ready", "t": "adjective"},
    "combinei": {"g": "I agreed it beforehand", "t": "verb"},
    "planta": {"g": "plant", "t": "noun"},
    "flor": {"g": "flower", "t": "noun"},
    "pesco": {"g": "I fish", "t": "verb"},
    "lagoa": {"g": "shallow lake between the dunes", "t": "noun"},
    "metros": {"g": "metres", "t": "noun"},
    "entro": {"g": "I go in", "t": "verb"},
    "salta": {"g": "jumps", "t": "verb"},
    "motivo": {"g": "reason", "t": "noun"},
    "férias": {"g": "holidays off work", "t": "noun"},
    "feriado": {"g": "a public holiday", "t": "noun"},
    "quarta-feira": {"g": "Wednesday", "t": "noun"},
    "bonita": {"g": "beautiful", "t": "adjective"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {}).update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(NUEVAS)} glosas nuevas; {len(d[BUNDLE])} en total")
