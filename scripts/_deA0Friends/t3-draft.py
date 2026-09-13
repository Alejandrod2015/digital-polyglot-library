import json, re
O,C="“","”"
def q(s): return O+s+C
T="games-and-rules"
s0 = "\n\n".join([
 "Donnerstag ist Spielabend in Jans Küche. Die Küche ist warm und laut. Sechs Freunde sitzen um den Tisch. Anna, die Grafikerin von oben, sitzt zwischen Jan und Nele.",
 "Felix, ein Mathelehrer aus dem Viertel, bringt ein neues Spiel. Er trägt ein graues T-Shirt. Er kennt alle Regeln.",
 q("Das Spiel ist ganz einfach")+", sagt Felix. "+q("Jeder hat vier Figuren. Du würfelst und läufst."),
 q("Und die Punkte? Wie viele Punkte brauche ich?")+", fragt Anna.",
 q("Die Punkte kommen später. Jetzt bist du dran."),
 "Anna würfelt eine Eins. Sie würfelt noch eine Zwei. Felix erklärt schnell.",
 "Annas Hände sind heiß, denn alle kennen die Regeln. Sie kennt die Regeln nicht. Sie wirft den Würfel zu fest. Der Würfel fällt vom Tisch.",
 q("Früher spielen wir hier ein anderes Spiel."),
 q("Ich weiß. Jan erzählt oft davon."),
 "Anna verliert. Sie ist die Letzte, und die Letzte spült.",
 "Anna steht an der Spüle. Felix bringt ihr die Gläser und lächelt.",
])
s1 = "\n\n".join([
 "Ein roter Würfel liegt in Annas Hand. Sie hat ihn seit der Schulzeit. Er bringt ihr immer Glück.",
 "Es ist spät. Jan und Anna sitzen allein in der Küche. Anna hört nur die Uhr.",
 q("Erklär mir die Regeln. Aber bitte langsam")+", bittet Anna.",
 q("Gut. Eine Sechs ist gut. Mit einer Sechs startet deine Figur."),
 "Jan stellt die Figuren auf das Brett. Anna würfelt mit ihrem roten Würfel. Sie würfelt drei Sechsen.",
 q("Drei Sechsen? Du bist wieder die Königin!"),
 "Jan holt eine alte Kiste aus dem Schrank. Das Spiel von früher ist darin. Das Brett ist kaputt. Drei Figuren fehlen.",
 q("Wo sind die anderen drei Figuren?"),
 q("Keine Ahnung. Acht Jahre sind lang. Das Spiel ist alt."),
 "Annas Augen werden nass, denn das alte Spiel ist kaputt. Sie wischt die Augen schnell.",
 "Jan wirft das alte Spiel in den Müll. Anna legt ihren roten Würfel in die neue Schachtel.",
])
s2 = "\n\n".join([
 "Die Gruppe spielt heute im Hof. Felix sitzt Anna gegenüber.",
 "Das Spiel ist fast zu Ende. Anna und Felix haben noch eine Figur. Alle schauen auf das Brett.",
 q("Ich habe Angst. Mein Würfel muss helfen")+", flüstert Anna.",
 q("Du brauchst eine Vier")+", sagt Felix. "+q("Nur eine Vier."),
 "Anna küsst ihren roten Würfel. Sie würfelt. Eine Vier!",
 q("Ich gewinne! Ich gewinne gegen Felix!"),
 "Anna springt vom Stuhl. Der rote Würfel fliegt aus ihrer Hand. Er fällt durch das Gitter im Boden.",
 "Anna liegt auf dem Boden. Der Würfel ist unten im Keller. Niemand kann den Würfel holen.",
 "Ihr Mund ist trocken, denn der Würfel ist seit der Schulzeit bei ihr. Sie legt die Hand auf das Gitter.",
 q("Das tut mir leid. Aber du gewinnst trotzdem."),
 "Felix gibt ihr einen blauen Würfel.",
 q("Er ist nicht rot. Aber er ist für die Königin."),
 "Anna lacht. Felix stellt den blauen Würfel neben ihr Glas.",
])
out=[
 {"topic":T,"slotIndex":0,"title":"Felix erklärt zu schnell","arcType":None,"synopsis":"","text":s0,"vocab":[]},
 {"topic":T,"slotIndex":1,"title":"Annas roter Würfel","arcType":None,"synopsis":"","text":s1,"vocab":[]},
 {"topic":T,"slotIndex":2,"title":"Eine Vier im Hof","arcType":None,"synopsis":"","text":s2,"vocab":[]},
]
json.dump(out,open(f"scripts/_deA0Friends/t3-texts.json","w"),ensure_ascii=False,indent=1)
for d in out:
    t=d["text"]; w=len(re.findall(r"\w+",t)); qw=sum(len(re.findall(r"\w+",m)) for m in re.findall(O+"([^"+C+"]*)"+C,t))
    narr=re.sub(O+"[^"+C+"]*"+C," ",t); L=sorted(len(x.split()) for x in re.split(r"(?<=[.!?])\s+",narr) if len(x.split())>1)
    print(d["title"],"palabras",w,"citado %.0f%%"%(100*qw/w),"mediana",L[len(L)//2],"max",L[-1])
