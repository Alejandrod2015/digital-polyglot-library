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
            ("Mais elle prend une boule et tire.", "Mais elle prend une boule. Elle veut essayer.")],
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
 ("t4",0): [("avec un grand sac", "avec un gros sac")],
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
 ("t6",2): [("Léa monte l'écharpe.", "Léa monte l'écharpe, lentement.")],
 ("t7",0): [("Puis il monte dans la voiture.", "Il monte dans la voiture."),
            ("Hugo lui donne un mouchoir.", "Hugo lui donne un mouchoir blanc.")],
 ("t7",1): [("Clara descend avec son chien.", "Clara descend avec son gros chien."),
            ("Clara lance. Sa boule roule", "Clara veut tirer. Sa boule roule"),
            ("“Oui. Chaque fois, il gagne.”", "“Oui. Chaque fois, il est le gagnant.”")],
 ("t7",2): [("On parie le café?”", "Tu paies le café?”"),
            ("Personne ne joue exprès.", "Personne ne perd exprès.")],
}
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
    k = clave(v)
    if " " not in k: return sum(1 for c in cuerpos if k in c)
    lema = str(v["word"]).lower(); return sum(1 for x in textos if k in x or lema in x)
port = [enc(v) for s in st for v in s["vocab"] if not v.get("anchor")]
W = lambda x: len(re.findall(r"[A-Za-zÀ-ÿœ'’-]+", x))
Q = lambda x: sum(W(m) for m in re.findall(r"“([^”]*)”", x))
print(f"portables {len(port)} · media {sum(port)/len(port):.2f} (suelo 2.5) · sueltos {sum(1 for n in port if n<=1)} ({round(100*sum(1 for n in port if n<=1)/len(port))}%, tope 30% = {int(0.3*len(port))})")
over = [(f"{t}#{i}", W(s['text']), round(100*Q(s['text'])/W(s['text']))) for t in data for i, s in enumerate(data[t]) if W(s['text'])>145 or not 25 <= 100*Q(s['text'])/W(s['text']) <= 35]
print("fuera de vara (palabras>145 o citado fuera de 25-35):", over or "ninguna")
