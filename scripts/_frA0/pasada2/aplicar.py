"""Pasada 2: SOLO las sustituciones de texto aceptadas por el chat de
planificacion (2026-09-11), sobre copias en pasada2/. Mide la escalera como el
checker (con el arreglo de guion de 645a0fdb).
  python3 scripts/_frA0/pasada2/aplicar.py
"""
import json, re
D = "scripts/_frA0"; O = f"{D}/pasada2"
S = {
 ("t1",0): [("Ils jouent à la pétanque le dimanche.", "Ils jouent à la pétanque chaque dimanche."),
            ("“Très près. C'est bien”, dit Hugo.", "“Très près. Génial!”, dit Hugo.")],
 ("t1",1): [("“C'est facile. Regarde, comme ça.”", "“C'est facile. Tu tiens la boule comme ça.”"),
            ("“D'accord, je paie.", "“Pas grave, je paie."),
            ("Mais elle prend une boule et tire.", "Mais elle prend une boule. Elle veut essayer.")],
 ("t1",2): [("“D'accord”, dit Hugo.", "“Avec plaisir”, dit Hugo.")],
 ("t2",0): [("“Ce n'est pas facile ici.", "“C'est difficile ici.")],
 ("t2",1): [("Léa ferme les yeux.", "Léa ferme les yeux et retient ses larmes."),
            ("“Paris, c'est bien.", "“Paris, c'est génial.")],
 ("t2",2): [("L'eau est chaude.", "L'eau est tiède.")],
 ("t3",0): [("“Je peux aider”, dit Chloé.", "“Je peux aider. Je suis libre”, dit Chloé."),
            ("Hugo part en mars.", "Hugo déménage en mars."),
            ("Elles portent le fauteuil ensemble.", "Elles portent le fauteuil lentement, ensemble.")],
 ("t3",2): [("“Mais je commence à comprendre.”", "“Mais je commence à voir.”")],
 ("t4",1): [("Le matin, le quai du métro est plein.", "Le matin, le quai du métro est plein et étroit.")],
 ("t4",2): [("Il a raison.", "Il a raison: c'est difficile.")],
 ("t5",2): [("Enfin, Hugo ouvre le paquet.", "Enfin, Hugo ouvre le paquet, surpris."),
            ("Un chat dort sur le banc.", "Un gros chat dort sur le banc.")],
 ("t6",1): [("“Pourquoi moi?”, demande Léa.", "“Pourquoi moi? Je suis occupée!”, demande Léa.")],
 ("t7",0): [("Puis il monte dans la voiture.", "Il monte dans la voiture.")],
 ("t7",1): [("Clara lance. Sa boule roule", "Clara veut tirer. Sa boule roule")],
 ("t7",2): [("On parie le café?”", "Tu paies le café?”"),
            ("Personne ne joue exprès.", "Personne ne perd exprès.")],
}
data = {t: json.load(open(f"{D}/{t}.json")) for t in ("t1","t2","t3","t4","t5","t6","t7")}
fallos, cambios = [], []
for (t, i), subs in S.items():
    s = data[t][i]
    for a, b in subs:
        if s["text"].count(a) != 1: fallos.append(f"{t}#{i}: {a}"); continue
        s["text"] = s["text"].replace(a, b); cambios.append(f"{t}#{i}\t{s['title']}\t{a}\t{b}")
for t, v in data.items(): json.dump(v, open(f"{O}/{t}.json", "w"), ensure_ascii=False, indent=2)
open(f"{O}/cambios-texto.tsv", "w").write("historia\ttitulo\tantes\tdespues\n" + "\n".join(cambios) + "\n")
print(f"{len(cambios)} cambios de texto aceptados · {len(fallos)} sin aplicar", fallos)
st = [s for t in data for s in data[t]]
tok = lambda x: set(re.findall(r"[^\W\d_]+", x.lower()))
cu = [tok(s["text"]) for s in st]; tx = [s["text"].lower().replace("’","'") for s in st]
def clave(v): return re.sub(r"^(der|die|das|le|la|el|il|o|a)\s+", "", str(v.get("surface") or v["word"]).lower()).replace("’","'")
def enc(v):
    k = clave(v)
    if " " not in k and not re.fullmatch(r"[^\W\d_]+", k):
        r = re.compile(r"(?<![^\W\d_])" + re.escape(k) + r"(?![^\W\d_])"); return sum(1 for x in tx if r.search(x))
    if " " not in k: return sum(1 for c in cu if k in c)
    l = str(v["word"]).lower(); return sum(1 for x in tx if k in x or l in x)
port = [enc(v) for s in st for v in s["vocab"] if not v.get("anchor")]
suma = sum(port); sueltos = sum(1 for n in port if n <= 1)
print(f"portables {len(port)} · suma {suma} · media {suma/len(port):.4f} (necesita suma >= {int(2.5*len(port))}, faltan {max(0, int(2.5*len(port))-suma)}) · sueltos {sueltos} (tope {int(0.3*len(port))}, sobran {max(0, sueltos-int(0.3*len(port)))})")
W = lambda x: len(re.findall(r"[A-Za-zÀ-ÿœ'’-]+", x)); Q = lambda x: sum(W(m) for m in re.findall(r"“([^”]*)”", x))
print("fuera de vara:", [(f"{t}#{i}", W(s['text']), round(100*Q(s['text'])/W(s['text']))) for t in data for i, s in enumerate(data[t]) if W(s['text'])>145 or not 25 <= 100*Q(s['text'])/W(s['text']) <= 35] or "ninguna")
