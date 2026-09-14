"""Pase de edicion: costura "X, perche Y" como mucho en 5, "Poi" en 6 historias,
"Va bene" y "Mi dispiace" en 3 cada una. Sin tocar trama, temas ni vocab."""
import json, sys
E = {
(1,0):[("Lei è triste, perché la festa è finita.","Lei è triste. Dodici piatti, e nessuno."),("“Anche tu? Va bene. Ciao,”","“Anche tu? Ah. Ciao,”")],
(1,1):[("Poi apre il portafoglio.","Apre il portafoglio."),("Alice guarda il tovagliolo e poi guarda lui.","Alice guarda il tovagliolo. Guarda lui."),("Poi ride troppo forte.","E ride troppo forte."),("Poi lo dà ad Alice.","Lo dà ad Alice.")],
(1,2):[("Parliamo domenica, va bene?","Parliamo domenica, d'accordo?"),("Poi corre giù per le scale.","Corre giù per le scale."),("Poi chiude il cassetto, piano piano.","Chiude il cassetto, piano piano.")],
(2,0):[("Ma dentro è triste, perché lui è felice per un'altra.","Ma dentro è triste. Lui è felice, e non per lei.")],
(2,1):[("e poi deve sparire.","e deve sparire."),("Poi Francesca chiede piano:","Francesca chiede piano:"),("Poi scende le scale piano piano.","Scende le scale piano piano.")],
(2,2):[("Alice sente una piccola speranza, perché forse è una buona notizia.","“Forse è una buona notizia,” pensa Alice."),("“Mi dispiace, Matteo. Davvero,”","“Povero Matteo. Davvero,”")],
(3,0):[("Poi arriva Riccardo, un tassista","Alle otto arriva Riccardo, un tassista"),("Alice ha caldo in faccia, perché lui ride della sua squadra.","Lui ride della sua squadra. Alice ha caldo in faccia.")],
(3,1):[("“Mi dispiace. È solo una maglia, no?","“Dai, Alice. È solo una maglia, no?")],
(3,2):[("Ma poi guarda la faccia di Alice.","Ma guarda la faccia di Alice."),("“Va bene. La maglia torna a te.","“Okay. La maglia torna a te.")],
(4,0):[("Lei ha paura, perché le sedie volano.","Le sedie volano! Lei ha paura."),("Poi arriva un tuono.","Arriva un tuono.")],
(4,1):[("Poi la luce torna","La luce torna")],
(4,2):[("Poi insieme mettono","Insieme mettono")],
(5,0):[("Alice è agitata, perché Matteo arriva alle due.","Alice guarda l'orologio: Matteo arriva alle due. È agitata.")],
(5,1):[("Alice ha le mani fredde, perché è il mortaio di Matteo.","Alice ha le mani fredde. Nel lavandino ci sono due pezzi di marmo."),("“Così va bene?”","“Così è giusto?”")],
(5,2):[("Poi posa i due pezzi","Posa i due pezzi")],
(6,0):[("Lei è contenta, perché il pranzo va bene.","Lei è contenta: il pranzo è bello."),("Poi Matteo alza il bicchiere pieno per brindare.","Matteo alza il bicchiere pieno per brindare."),("Sente vergogna, perché Matteo scherza sul suo segreto davanti a un'altra.","Matteo scherza sul suo segreto, davanti a un'altra. Alice sente vergogna e guarda il piatto."),("Poi si alza ed esce.","Si alza ed esce.")],
(6,1):[("Poi arriva Valentina","Arriva Valentina"),("si morde il labbro, perché Valentina ha ragione.","si morde il labbro. Valentina ha ragione.")],
(6,2):[("Poi bussa due volte.","Bussa due volte."),("A pranzo sono cattiva con te. Mi dispiace davvero,”","A pranzo sono cattiva con te. Non è giusto,”")],
}
for (t, sl), ch in E.items():
    p = f"scripts/_itA0Friends/t{t}-data.json"; d = json.load(open(p))
    for a, b in ch:
        if a not in d[sl]["text"]: sys.exit(f"NO CASA {t}.{sl+1}: {a}")
        d[sl]["text"] = d[sl]["text"].replace(a, b, 1)
    json.dump(d, open(p, "w"), ensure_ascii=False, indent=1)
print("ok")
