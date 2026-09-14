"""Pasada 3, palanca 2 (2026-09-11): cambios de plaza portable sobre las copias
que deja aplicar.py. Las 6 anclas de cada historia no se tocan.
  python3 scripts/_frA0/pasada3/aplicar.py && python3 scripts/_frA0/pasada3/plazas.py
"""
import json, re
O = "scripts/_frA0/pasada3"
# (historia, palabra actual) -> cambios. Solo "surface": misma plaza, forma mas
# frecuente que ya esta en su texto. Con "word": plaza nueva.
P = [
 ("t2",1,"demander",   {"surface":"demande"}),
 ("t1",0,"partir",     {"surface":"part"}),
 ("t1",1,"payer",      {"surface":"paie"}),
 ("t1",1,"tirer",      {"surface":"tire"}),
 ("t3",1,"avoir besoin",{"word":"le besoin","surface":"besoin","type":"noun","definition":"Need; avoir besoin de means to need something."}),
 ("t3",2,"avoir raison",{"word":"la raison","surface":"raison","type":"noun","definition":"Reason; avoir raison means to be right."}),
 ("t3",0,"large",      {"word":"en bas","surface":"en bas","type":"expression","definition":"Downstairs; on the floor below."}),
 ("t6",0,"à louer",    {"word":"rien","surface":"rien","type":"pronoun","definition":"Nothing; not one thing at all."}),
 ("t5",1,"gai",        {"word":"vieux","surface":"vieux","type":"adjective","definition":"Old; with a lot of years."}),
 ("t4",1,"lent",       {"word":"poser","surface":"pose","type":"verb","definition":"To put down; to place something on a table."}),
 ("t6",2,"ailleurs",   {"word":"ici","surface":"ici","type":"adverb","definition":"Here; in this place, not there."}),
 ("t2",0,"l'oreille",  {"word":"quoi","surface":"quoi","type":"pronoun","definition":"What; a word to ask about something."}),
 ("t4",0,"c'est ça",   {"word":"l'ami","surface":"ami","type":"noun","definition":"Friend; a person you like and trust."}),
 ("t7",2,"manger",     {"word":"sentir","surface":"sent","type":"verb","definition":"To smell of; to have the smell of something."}),
 ("t7",2,"la prochaine fois",{"word":"faire","surface":"fait","type":"verb","definition":"To do, to make; here, to give a kiss."}),
 ("t1",1,"l'après-midi",{"word":"aller","surface":"va","type":"verb","definition":"To go; here, to move in a line."}),
 ("t2",1,"deux fois",  {"word":"deux","surface":"deux","type":"noun","definition":"Two; the number after one."}),
 # pouvoir pasa de t7#0 a t7#1 (peux); t7#0 toma nouveau (nouvelle); t2#0 toma s'appeler
 ("t7",1,"trouver",    {"word":"pouvoir","surface":"peux","type":"verb","definition":"Can; to be able to do something."}),
 ("t7",0,"pouvoir",    {"word":"nouveau","surface":"nouvelle","type":"adjective","definition":"New; here for the first time."}),
 ("t2",0,"nouveau",    {"word":"s'appeler","surface":"s'appelle","type":"verb","definition":"To be called; to have a name."}),
]
data = {t: json.load(open(f"{O}/{t}.json")) for t in ("t1","t2","t3","t4","t5","t6","t7")}
fila, fallos = [], []
for t, i, w, nuevo in P:
    s = data[t][i]
    v = next((v for v in s["vocab"] if v["word"] == w and not v.get("anchor")), None)
    if not v: fallos.append(f"{t}#{i} sin plaza {w}"); continue
    sf = nuevo["surface"]
    if not re.search(r"(?<![^\W\d_])" + re.escape(sf) + r"(?![^\W\d_])", s["text"]): fallos.append(f"{t}#{i} sin '{sf}' en el texto"); continue
    antes = f"{v['word']} ({v['surface']})"
    v.update(nuevo)
    fila.append(f"{t}#{i}\t{s['title']}\t{antes}\t{v['word']} ({v['surface']})\t{'superficie' if 'word' not in nuevo else 'plaza nueva'}")
for t, v in data.items(): json.dump(v, open(f"{O}/{t}.json", "w"), ensure_ascii=False, indent=2)
open(f"{O}/plazas.tsv", "w").write("historia\ttitulo\tantes\tdespues\ttipo\n" + "\n".join(fila) + "\n")
tx = open(f"{O}/cambios-texto.tsv").read().splitlines()
open(f"{O}/cambios.tsv", "w").write("tipo\thistoria\ttitulo\tantes\tdespues\n" + "\n".join(["texto\t" + l for l in tx[1:]] + ["plaza\t" + "\t".join(l.split("\t")[:4]) for l in fila]) + "\n")
print(f"{len(fila)} plazas · fallos: {fallos or 'ninguno'}")
