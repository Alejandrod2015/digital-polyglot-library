"""Pasada de escalera sobre COPIAS de t1..t7 (los originales no se tocan).
Aplica sustituciones del mismo largo o casi, mide la escalera como el checker
(validateJourneyStories.ts:746-797) y deja antes/despues en cambios.tsv.
  python3 scripts/_frA0/pasada/aplicar.py
"""
import json, re, shutil, sys
D = "scripts/_frA0"
S = {
 ("t1",0): [("Ils jouent à la pétanque le dimanche.", "Ils jouent à la pétanque chaque dimanche."),
            ("Sa boule roule tout près.", "Sa boule roule lentement, tout près."),
            ("“Très près. C'est bien”, dit Hugo.", "“Très près. Génial!”, dit Hugo."),
            ("“Oui. Je suis désolé.”", "“C'est ça. Je suis désolé.”")],
 ("t1",1): [("Léa apporte deux tasses de café.", "Léa apporte deux tasses de café noir."),
            ("“C'est facile. Regarde, comme ça.”", "“C'est facile. Tu tiens la boule comme ça.”"),
            ("“D'accord, je paie.", "“Pas grave, je paie."),
            ("Il tire encore: carreau.", "Encore: carreau."),
            ],
 ("t1",2): [("Elle les nettoie avec un chiffon.", "Elle les nettoie avec un chiffon propre."),
            ("“D'accord”, dit Hugo.", "“Avec plaisir”, dit Hugo."),
            ("“Tu pars en mars. C'est tout”", "“Tu pars en mars. C'est ça”")],
 ("t2",0): [("Il est à Paris, loin d'ici.", "Il est à Paris, ailleurs."),
            ("“Ce n'est pas facile ici.", "“C'est difficile ici."),
            ("Léa retourne le portable et sert les cafés.", "Léa cache le portable et sert les cafés."),
            ("Léa comprend. “Merci", "Léa comprend le sens. “Merci")],
 ("t2",1): [("Léa ferme les yeux.", "Léa ferme les yeux et retient ses larmes."),
            ("“Paris, c'est bien.", "“Paris, c'est génial.")],
 ("t2",2): [("L'eau est chaude.", "L'eau est tiède."),
            ("Il casse des tasses”", "Il est gentil”")],
 ("t3",0): [("“Je peux aider”, dit Chloé.", "“Je peux aider. Je suis libre”, dit Chloé."),
            ("Hugo part en mars.", "Hugo déménage en mars."),
            ("Léa est dans le fauteuil.", "Léa est dans le gros fauteuil."),
            ("Elles portent le fauteuil ensemble.", "Elles portent le fauteuil lentement, ensemble.")],
 ("t3",1): [("Hugo prend un stylo.", "Hugo prend un stylo noir."),
            ("Léa retourne au comptoir.", "Léa retourne au comptoir, occupée.")],
 ("t3",2): [("“Mais je commence à comprendre.”", "“Mais je commence à voir.”")],
 ("t4",1): [("Le matin, le quai du métro est plein.", "Le matin, le quai du métro est plein et étroit."),
            ("Hugo ne comprend pas.", "Hugo ne comprend pas le sens."),
            ("Dehors, on entend le bateau du port.", "Dehors, on entend le gros bateau du port.")],
 ("t4",2): [("Il a raison.", "Il a raison: c'est difficile.")],
 ("t5",0): [("Louise fait un nœud rouge.", "Louise fait un gros nœud rouge."),
            ("Puis elle la donne.", "Puis elle la donne, lentement.")],
 ("t5",2): [("Enfin, Hugo ouvre le paquet.", "Enfin, Hugo ouvre le paquet, surpris."),
            ("Un chat dort sur le banc.", "Un gros chat dort sur le banc.")],
 ("t6",0): [("Le couloir est froid.", "Le couloir est froid et étroit.")],
 ("t6",1): [("Mais elle prend l'arrosoir.", "Mais elle prend l'arrosoir, lourd."),
            ("“Pourquoi moi?”, demande Léa.", "“Pourquoi moi? Je suis occupée!”, demande Léa.")],
 ("t7",0): [("Puis il monte dans la voiture.", "Il monte dans la voiture."),
            ("Hugo lui donne un mouchoir.", "Hugo lui donne un mouchoir blanc.")],
 ("t7",1): [("Clara descend avec son chien.", "Clara descend avec son gros chien."),
            ("Clara lance. Sa boule roule", "Clara veut tirer. Sa boule roule"),
            ("“Oui. Chaque fois, il gagne.”", "“Oui. Chaque fois, il est le gagnant.”")],
 ("t7",2): [("On parie le café?”", "Tu paies le café?”"),
            ("Personne ne joue exprès.", "Personne ne perd exprès.")],
}

# Segunda tanda (2026-09-11): la diferencia que queda tras el arreglo de guion.
S2 = {
 ("t1",0): [("Hugo lance le cochonnet.", "Hugo lance le cochonnet, vite.")],
 ("t1",2): [("“Non. Je range”", "“Non. Je balaie”")],
 ("t2",2): [("“Bon. Bonne nuit, Léa.”", "“Bon. Au revoir, Léa.”"),
            ("Il monte là-haut, chez lui.", "Il monte là-haut, à la maison.")],
 ("t3",0): [("Il donne le fauteuil à Léa.", "Il veut offrir le fauteuil à Léa.")],
 ("t3",1): [("Puis il dit:", "Ensuite, il dit:")],
 ("t4",2): [("Dehors, la lune est douce.", "Léa rêve. Dehors, la lune est douce.")],
 ("t5",0): [("Puis elle la donne, lentement.", "Ensuite, elle la donne, lentement.")],
 ("t5",1): [("Léa applaudit très fort", "Léa applaudit vraiment fort")],
 ("t5",2): [("Puis il rentre chez lui.", "À la fin, il rentre chez lui."),
            ("Un gros chat dort sur le banc.", "Un gros chat dort sur le banc, sous les feuilles.")],
 ("t6",0): [("Léa n'aime pas ça, mais elle ne dit rien.", "Léa n'aime pas ça. Elle sait, mais elle ne dit rien."),
            ("L'annonce est sur la boîte aux lettres.", "Léa lit l'annonce sur la boîte aux lettres."),
            ("Léa touche la poignée", "Léa touche doucement la poignée"),
            ("cent euros de plus”, explique Antoine.", "cent euros de plus. C'est cher”, explique Antoine.")],
 ("t6",1): [("“Mais ce n'est plus chez toi.”", "“Mais ce n'est plus comme avant.”"),
            ("Au plafond, il y a une vieille ampoule.", "Au plafond, Hugo allume une vieille ampoule."),
            ("Il n'y a plus de meubles.", "L'appartement est vide, sans meubles."),
            ("“C'est joli”, répond Léa.", "“C'est joli. J'aime beaucoup”, répond Léa.")],
 ("t6",2): [("“C'est une femme sympa”, explique Antoine.", "“C'est une femme sympa. Elle veut louer”, explique Antoine."),
            ("Léa ne peut pas être méchante.", "Léa la trouve sympa, et ne peut pas être méchante."),
            ("“Il est beau, ce chien”, dit Léa.", "“Beau chien”, dit Léa.")],
 ("t7",0): [("Clara est une nouvelle voisine", "Clara est une nouvelle locataire"),
            ("“Tu gardes la plante?”", "“Tu arroses la plante?”")],
 ("t7",1): [("Clara boit à la gourde.", "Clara boit encore un peu à la gourde."),
            ("Clara a une casquette et des lunettes.", "Clara a une casquette verte et des lunettes."),
            ("Sa boule roule, et elle rate le cochonnet.", "Sa boule roule loin, et elle rate le cochonnet."),
            ("Puis elle ne dit rien.", "Ensuite, elle ne dit rien.")],
 ("t7",2): [("Hugo arrive en TGV.", "Hugo arrive en TGV, heureux."),
            ("Il dort sur le canapé du café.", "Il dort sur le long canapé du café.")],
}
for k, v in S2.items():
    S.setdefault(k, []).extend(v)

# Tercera tanda: verbos de acotacion que son plaza (dit, repond, explique, rit)
# en historias que no los tenian; solo donde el original se repite o no es plaza.
S3 = {
 ("t1",0): [("“Très près. Génial!”, dit Hugo.", "“Très près. Génial!”, rit Hugo."),
            ("“Non. C'est un jeu”, répond Hugo.", "“Non. C'est un jeu”, explique Hugo.")],
 ("t1",1): [("Il souffle fort.", "Il souffle vraiment fort.")],
 ("t1",2): [("“Ma boule est plus près”, dit Hugo.", "“Ma boule est plus près”, rit Hugo."),
            ("“Je sais. Le perdant ramasse”, dit Léa.", "“Je sais. Le perdant ramasse”, explique Léa.")],
 ("t2",0): [("“Bien sûr”, sourit Théo.", "“Bien sûr”, rit Théo."),
            ("où sont les tasses”, dit Théo.", "où sont les tasses”, explique Théo.")],
 ("t2",2): [("“À toi, Hugo. Tu racontes?”, demande Léa.", "“À toi, Hugo. Tu racontes?”, dit Léa.")],
 ("t3",0): [("“Je peux aider. Je suis libre”, dit Chloé.", "“Je peux aider. Je suis libre”, explique Chloé."),
            ("“Oui. Je ne suis jamais fatiguée”, répond Léa.", "“Oui. Je ne suis jamais fatiguée”, rit Léa.")],
 ("t3",2): [("“Attention! Il y a de l'eau partout!”, crie Léa.", "“Attention! Il y a de l'eau partout!”, rit Léa.")],
 ("t4",1): [("Tout est près.", "Tout est vraiment près.")],
 ("t5",1): [("“Le perdant paie le pastis”, dit Hugo.", "“Le perdant paie le pastis”, explique Hugo.")],
 ("t5",2): [("“Un service pour un service”, dit Hugo.", "“Un service pour un service”, rit Hugo.")],
 ("t6",2): [("“Beau chien”, dit Léa.", "“Beau chien”, rit Léa.")],
 ("t7",2): [("“Oui. Mais personne ne triche”, dit Léa.", "“Oui. Mais personne ne triche”, explique Léa.")],
}
for k, v in S3.items():
    S.setdefault(k, []).extend(v)

data = {t: json.load(open(f"{D}/{t}.json")) for t in ("t1","t2","t3","t4","t5","t6","t7")}
fallos, cambios = [], []
for (t, i), subs in S.items():
    s = data[t][i]
    for a, b in subs:
        if s["text"].count(a) != 1:
            fallos.append(f"{t}#{i}: no casa una sola vez: {a}"); continue
        s["text"] = s["text"].replace(a, b)
        cambios.append(f"{t}#{i}\t{s['title']}\t{a}\t{b}")
for t, v in data.items():
    json.dump(v, open(f"{D}/pasada/{t}.json", "w"), ensure_ascii=False, indent=2)
open(f"{D}/pasada/cambios.tsv", "w").write("historia\ttitulo\tantes\tdespues\n" + "\n".join(cambios) + "\n")
print(f"{len(cambios)} cambios aplicados · {len(fallos)} sin aplicar"); [print("  " + f) for f in fallos]
# medicion, igual que el checker
st = [s for t in data for s in data[t]]
tok = lambda x: set(re.findall(r"[^\W\d_]+", x.lower()))
cuerpos = [tok(s["text"]) for s in st]; textos = [s["text"].lower() for s in st]
def clave(v): return re.sub(r"^(der|die|das|le|la|el|il|o|a)\s+", "", str(v.get("surface") or v["word"]).lower())
def enc(v):
    k = clave(v).replace("’", "'")
    if " " not in k and not re.fullmatch(r"[^\W\d_]+", k):
        pieza = re.compile(r"(?<![^\W\d_])" + re.escape(k) + r"(?![^\W\d_])")
        return sum(1 for x in textos if pieza.search(x.replace("’", "'")))
    if " " not in k: return sum(1 for c in cuerpos if k in c)
    lema = str(v["word"]).lower(); return sum(1 for x in textos if k in x or lema in x)
port = [enc(v) for s in st for v in s["vocab"] if not v.get("anchor")]
W = lambda x: len(re.findall(r"[A-Za-zÀ-ÿœ'’-]+", x))
Q = lambda x: sum(W(m) for m in re.findall(r"“([^”]*)”", x))
print(f"portables {len(port)} · media {sum(port)/len(port):.2f} (suelo 2.5) · sueltos {sum(1 for n in port if n<=1)} ({round(100*sum(1 for n in port if n<=1)/len(port))}%, tope 30% = {int(0.3*len(port))})")
over = [(f"{t}#{i}", W(s['text']), round(100*Q(s['text'])/W(s['text']))) for t in data for i, s in enumerate(data[t]) if W(s['text'])>145 or not 25 <= 100*Q(s['text'])/W(s['text']) <= 35]
print("fuera de vara (palabras>145 o citado fuera de 25-35):", over or "ninguna")

print("\n--- sueltos que quedan, por historia (margen de palabras, citado) ---")
i0 = 0
for t in data:
    for i, s_ in enumerate(data[t]):
        solos = [clave(v) for v in s_["vocab"] if not v.get("anchor") and enc(v) <= 1]
        w = W(s_["text"]); q = round(100*Q(s_["text"])/w)
        print(f"{t}#{i} {s_['title'][:24]:24} margen {145-w:>2} · citado {q}% · {len(solos)}: {', '.join(solos)}")
