"""Pasada 3 (2026-09-11): cambios de texto que sobreviven a la revision del
chat de planificacion (tandas 1-3 menos lo rechazado), sobre copias en
pasada3/. Las plazas se cambian aparte (plazas.py). Mide como el checker.
  python3 scripts/_frA0/pasada3/aplicar.py
"""
import json, re
D = "scripts/_frA0"; O = f"{D}/pasada3"
S = {
 ("t1",0): [("Ils jouent à la pétanque le dimanche.", "Ils jouent à la pétanque chaque dimanche."),
            ("“Très près. C'est bien”, dit Hugo.", "“Très près. Génial!”, dit Hugo."),
            ("Hugo lance le cochonnet.", "Hugo lance le cochonnet, vite.")],
 ("t1",1): [("“C'est facile. Regarde, comme ça.”", "“C'est facile. Tu tiens la boule comme ça.”"),
            ("“D'accord, je paie.", "“Pas grave, je paie."),
            ("Mais elle prend une boule et tire.", "Mais elle prend une boule. Elle veut essayer."),
            ("Il tire encore: carreau.", "Encore: carreau.")],
 ("t1",2): [("“D'accord”, dit Hugo.", "“Avec plaisir”, dit Hugo."),
            ("“Non. Je range”", "“Non. Je balaie”")],
 ("t2",0): [("“Ce n'est pas facile ici.", "“C'est difficile ici.")],
 ("t2",1): [("Léa ferme les yeux.", "Léa ferme les yeux et retient ses larmes."),
            ("“Paris, c'est bien.", "“Paris, c'est génial.")],
 ("t2",2): [("L'eau est chaude.", "L'eau est tiède."),
            ("“Bon. Bonne nuit, Léa.”", "“Bon. Au revoir, Léa.”"),
            ("Il monte là-haut, chez lui.", "Il monte là-haut, à la maison."),
            ("“À toi, Hugo. Tu racontes?”, demande Léa.", "“À toi, Hugo. Tu racontes?”, dit Léa."),
            ("“Oui. J'écoute.”", "“J'écoute.”")],
 ("t3",0): [("“Je peux aider”, dit Chloé.", "“Je peux aider. Je suis libre”, dit Chloé."),
            ("Hugo part en mars.", "Hugo déménage en mars."),
            ("Elles portent le fauteuil ensemble.", "Elles portent le fauteuil lentement, ensemble."),
            ("Il donne le fauteuil à Léa.", "Il veut offrir le fauteuil à Léa."),
            ("“Oui. Je ne suis jamais fatiguée”, répond Léa.", "“Oui. Je ne suis jamais fatiguée”, rit Léa.")],
 ("t3",1): [("Puis il dit:", "Ensuite, il dit:")],
 ("t3",2): [("“Mais je commence à comprendre.”", "“Mais je commence à voir.”"),
            ("“Attention! Il y a de l'eau partout!”, crie Léa.", "“Attention! Il y a de l'eau partout!”, rit Léa.")],
 ("t4",1): [("Le matin, le quai du métro est plein.", "Le matin, le quai du métro est plein et étroit.")],
 ("t4",2): [("Il a raison.", "Il a raison: c'est difficile."),
            ("Dehors, la lune est douce.", "Léa rêve. Dehors, la lune est douce.")],
 ("t5",0): [("Puis elle la donne.", "Ensuite, elle la donne.")],
 ("t5",1): [("Léa applaudit très fort", "Léa applaudit vraiment fort")],
 ("t5",2): [("Enfin, Hugo ouvre le paquet.", "Enfin, Hugo ouvre le paquet, surpris."),
            ("Un chat dort sur le banc.", "Un gros chat dort sur le banc, sous les feuilles."),
            ("Puis il rentre chez lui.", "À la fin, il rentre chez lui.")],
 ("t6",0): [("Léa n'aime pas ça, mais elle ne dit rien.", "Léa n'aime pas ça. Elle sait, mais elle ne dit rien."),
            ("L'annonce est sur la boîte aux lettres.", "Léa lit l'annonce sur la boîte aux lettres."),
            ("Léa touche la poignée", "Léa touche doucement la poignée"),
            ("cent euros de plus”, explique Antoine.", "cent euros de plus. C'est cher”, explique Antoine.")],
 ("t6",1): [("“Pourquoi moi?”, demande Léa.", "“Pourquoi moi? Je suis occupée!”, demande Léa."),
            ("“Mais ce n'est plus chez toi.”", "“Mais ce n'est plus comme avant.”"),
            ("Au plafond, il y a une vieille ampoule.", "Au plafond, Hugo allume une vieille ampoule."),
            ("Il n'y a plus de meubles.", "L'appartement est vide, sans meubles."),
            ("“C'est joli”, répond Léa.", "“C'est joli. J'aime beaucoup”, répond Léa.")],
 ("t6",2): [("“C'est une femme sympa”, explique Antoine.", "“C'est une femme sympa. Elle veut louer”, explique Antoine.")],
 ("t7",0): [("Puis il monte dans la voiture.", "Il monte dans la voiture."),
            ("Clara est une nouvelle voisine", "Clara est une nouvelle locataire"),
            ("“Tu gardes la plante?”", "“Tu arroses la plante?”")],
 ("t7",1): [("Clara lance. Sa boule roule", "Clara veut tirer. Sa boule roule"),
            ("Clara boit à la gourde.", "Clara boit encore un peu à la gourde."),
            ("Clara a une casquette et des lunettes.", "Clara a une casquette verte et des lunettes."),
            ("Sa boule roule, et elle rate le cochonnet.", "Sa boule roule loin, et elle rate le cochonnet."),
            ("Puis elle ne dit rien.", "Ensuite, elle ne dit rien.")],
 ("t7",2): [("On parie le café?”", "Tu paies le café?”"),
            ("Personne ne joue exprès.", "Personne ne perd exprès."),
            ("Hugo arrive en TGV.", "Hugo arrive en TGV, heureux."),
            ("Il dort sur le canapé du café.", "Il dort sur le long canapé du café.")],
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
print(f"{len(cambios)} cambios de texto · {len(fallos)} sin aplicar", fallos)
