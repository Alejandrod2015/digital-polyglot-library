"""Las glosas del tema 6. "wilson" y "petropolis" van a exentos, no aqui."""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    # Historia 1: el cargador
    "carregador": {"g": "charger for a laptop", "t": "noun"},
    "notebook": {"g": "laptop", "t": "noun"},
    "parou": {"g": "stopped working", "t": "verb"},
    "funcionar": {"g": "to work, to do its job", "t": "verb"},
    "empresa": {"g": "the company she works for", "t": "noun"},
    "informática": {"g": "computers, as a trade", "t": "noun"},
    "modelo": {"g": "model, the exact type of a thing", "t": "noun"},
    "computador": {"g": "computer", "t": "noun"},
    "genérico": {"g": "an unbranded copy, cheaper than the original", "t": "noun"},
    "triplo": {"g": "three times as much", "t": "noun"},
    "internet": {"g": "the internet", "t": "noun"},
    "correio": {"g": "post office", "t": "noun"},
    "domingo": {"g": "Sunday", "t": "noun"},
    "fechado": {"g": "closed", "t": "adjective"},
    "enviava": {"g": "was sending, was passing through", "t": "verb"},
    "testa": {"g": "try it, test it", "t": "verb"},
    "acende": {"g": "lights up", "t": "verb"},
    "queimou": {"g": "burned out", "t": "verb"},
    # Historia 2: la reunion
    "conecta": {"g": "connects to the network", "t": "verb"},
    "emprego": {"g": "job", "t": "noun"},
    "digita": {"g": "types it in", "t": "verb"},
    "tarefa": {"g": "the job she has been given", "t": "noun"},
    "solução": {"g": "a way out of the problem", "t": "noun"},
    "má": {"g": "bad (mau)", "t": "adjective"},
    "salário": {"g": "salary", "t": "noun"},
    "rica": {"g": "rich", "t": "adjective"},
    "pobre": {"g": "poor", "t": "adjective"},
    "mesas": {"g": "tables", "t": "noun"},
    # Historia 3: las quince hojas
    "relatório": {"g": "written report of the work done", "t": "noun"},
    "impressora": {"g": "printer", "t": "noun"},
    "teclado": {"g": "keyboard", "t": "noun"},
    "colado": {"g": "stuck, glued together", "t": "adjective"},
    "emperra": {"g": "jams, sticks and will not move", "t": "verb"},
    "preto": {"g": "black", "t": "adjective"},
    "pesado": {"g": "heavy", "t": "adjective"},
    "envelope": {"g": "envelope for a letter", "t": "noun"},
    "pardo": {"g": "brown, the colour of wrapping paper", "t": "adjective"},
    "pacote": {"g": "parcel, a wrapped package", "t": "noun"},
    "endereço": {"g": "address you write on a parcel", "t": "noun"},
    "caixinha": {"g": "little sign or box on a counter", "t": "noun"},
    "país": {"g": "country", "t": "noun"},
    "notícia": {"g": "a piece of news", "t": "noun"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {}).update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(NUEVAS)} glosas nuevas; {len(d[BUNDLE])} en total")
