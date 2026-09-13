import json, sys
E = {
(1,0):[("“Allora tanti auguri,” dice Alice,","“Allora tanti auguri. E un desiderio!” dice Alice,")],
(3,1):[("“Il Genoa vince stasera. Io lo sento,” dice Alice.","“Io non perdo mai. Il Genoa vince stasera,” dice Alice.")],
(4,1):[("Nell'ascensore c'è anche Federica.","Nell'ascensore Alice incontra Federica."),
       ("Al quarto piano la luce si spegne","Tra il terzo e il quarto piano la luce si spegne"),
       ("Federica non ride.","Federica ascolta e non ride."),
       ("Tu lo dici a lui un giorno. Con coraggio,” sussurra Federica.","Tu lo dici a lui un giorno. Oppure mai,” sussurra Federica.")],
(4,2):[("Dopo la tempesta, il cielo è pulito e il sole torna su Genova.","Dopo la tempesta, il cielo è pulito."),
       ("Una sedia è rotta, l'altra è bagnata. ",""),],
(5,0):[("Oggi Alice vuole fare il pesto per lui.","Oggi lo vuole fare Alice."),
       ("Lei prende il piccolo vaso di basilico e scende le scale in ciabatte.","Lei prende il basilico e scende in ciabatte."),
       ("“Il pesto? Con questa pianta? È troppo piccola,”","“Il pesto? Questa pianta è carina, ma è troppo piccola,”"),
       ("Lorenzo guarda Alice. Lei è sincera.","Lorenzo guarda Alice. Lui è gentile.")],
(5,1):[("Alice schiaccia il basilico con il pestello, troppo forte.","Alice usa il pestello e schiaccia il basilico troppo forte."),
       ("Alice assaggia e sorride, contenta.","Alice assaggia e sorride, felice."),
       ("Lui taglia il formaggio e annusa il basilico.","Lui taglia il formaggio.")],
(5,2):[("Matteo riempie di terra i due pezzi di marmo. Come sempre, non si arrabbia.","Matteo riempie di terra i due pezzi di marmo."),
       ("Davanti a lei ci sono due piatti di trofie al pesto e una bottiglia d'acqua.","Davanti a lei ci sono due piatti di trofie e una bottiglia d'acqua.")],
(6,0):[("Matteo racconta storie di mare e Valentina ride spesso.","Matteo racconta storie di mare. Valentina è simpatica e ride spesso."),
       ("Lei è contenta, perché il pranzo è buono e va bene.","Lei è contenta, perché il pranzo va bene."),
       ("“Sai, Valentina? Alice e io","“Un brindisi per noi! Sai, Valentina? Alice e io"),
       ("Poi Matteo alza il bicchiere pieno per brindare.","Poi Matteo alza il bicchiere pieno."),
       ("Lavora con lei in ospedale.",""),
       ("dice Alice. Poi si alza ed esce.","dice Alice, arrabbiata. Poi si alza ed esce.")],
(6,1):[("“Alice, lui non sa del patto.","“Alice, lui non capisce. Non sa del patto."),
       ("si siede vicino al davanzale.","si siede accanto al davanzale."),
       ("Coraggio. È giusto,”","È un buon consiglio. Pazienza,”")],
(6,2):[("Alice apre la bocca, ma la verità resta dentro.","Alice apre la bocca. La verità, invece, resta dentro."),
       ("“Sto bene. Sono solo stanca.","“Sto bene. Sono stanca."),
       ("La pace è vera, ma c'è una crepa, come nel mortaio di marmo.","Alice sente sollievo. Ma c'è una crepa, come nel mortaio.")],
(7,0):[("“E questo è per te. Apri, dai,” dice lui. È un pacchetto con un nastro rosso.","“E questo è per te. Tieni,” dice lui. Matteo mostra un pacchetto con un nastro rosso."),
       ("“Sono bellissimi. Grazie, Matteo,”","“È il regalo più bello. Grazie,”"),
       ("Ma il cuore di Alice batte forte.","Ma il cuore batte forte nel petto."),
       ("“Aspetta qui. Torno subito,” dice lei. Lei va in casa","“Aspetta qui. Torno subito,” dice lei, e si alza. Va in casa"),
       ("Le sue mani tremano, perché adesso non ha più una scusa. Ha paura.","Le sue mani tremano, perché adesso non ha più una scusa.")],
(7,1):[("C'è silenzio.","C'è un silenzio strano."),
       ("Lei singhiozza e Matteo le dà un fazzoletto.","Lei singhiozza e asciuga le lacrime con un fazzoletto."),
       ("Lei trova il coraggio con un respiro profondo.","Trova il coraggio con un respiro profondo.")],
(7,2):[("Una domenica dopo, Matteo sale al quinto piano con due piatti e una focaccia.","Una domenica dopo, Matteo viene al quinto piano con due piatti e una focaccia."),
       ("Ha una camicia pulita e i capelli pettinati.","Ha un maglione pulito e i capelli pettinati."),
       ("Io porto la focaccia,” chiede lui, timido.","Forse è presto?” chiede lui, timido."),
       ("Nei due vasi di marmo il basilico cresce, verde e forte.","Nei due vasi di marmo la pianta è viva e cresce, verde."),
       ("Due piatti, come ogni domenica.","Due piatti bastano, come ogni domenica.")],
}
for (t, sl), ch in E.items():
    p = f"scripts/_itA0Friends/t{t}-data.json"; d = json.load(open(p))
    for a, b in ch:
        if a not in d[sl]["text"]:
            sys.exit(f"NO CASA {t}.{sl+1}: {a}")
        d[sl]["text"] = d[sl]["text"].replace(a, b, 1)
    json.dump(d, open(p, "w"), ensure_ascii=False, indent=1)
for t in range(1,8):
    for s in json.load(open(f"scripts/_itA0Friends/t{t}-data.json")):
        miss=[v["surface"] for v in s["vocab"] if v["surface"].lower() not in s["text"].lower()]
        if miss: print("FALTA", t, s["slotIndex"]+1, miss)
print("ok")
