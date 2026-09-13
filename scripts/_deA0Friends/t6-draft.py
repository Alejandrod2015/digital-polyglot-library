import json, re
O,C="“","”"
def q(s): return O+s+C
T="cooking-and-hosting"
s0 = "\n\n".join([
 "Ihr Rezept ist zwölf Jahre alt. Anna ist eine Grafikerin, aber sie kocht am Donnerstag für alle. Die Suppe ist billig und warm.",
 "Luisa, eine Köchin aus Jans Restaurant, steht am Herd. Sie trägt eine schwarze Schürze mit vielen Flecken. Drei riesige Töpfe sind schon da.",
 q("Wie viele Freunde kommen am Donnerstag?")+", fragt Luisa.",
 q("Für zehn Leute. Mein Rezept ist nur für zwei."),
 q("Kein Problem. Wir rechnen einfach mal fünf."),
 "Sie gibt Anna ein spitzes Messer. Anna schneidet Zwiebeln. Die Zwiebeln sind scharf, und ihre Augen tränen. Luisa probiert die Suppe mit einem großen Löffel.",
 q("Noch etwas Salz. Die Suppe ist zu mild."),
 "Die Suppe riecht nach einer Stunde wie früher. Anna ist stolz, und ihr Gesicht ist warm. Sie rührt ganz langsam.",
 "Der alte Zettel mit dem Rezept liegt neben dem Topf. Er rutscht in die Suppe.",
 q("Oh nein! Mein Rezept schwimmt!")+", ruft Anna.",
 q("Egal. Das Rezept ist jetzt in deinem Kopf")+", antwortet Luisa.",
])
s1 = "\n\n".join([
 "Sein Lieblingstopf ist groß und alt. Er steht auf Jans Herd. Anna kocht heute allein darin.",
 "Das Telefon klingelt dreimal. Die Nummer ist aus München. Anna geht mit dem Telefon in den Flur.",
 "Ihre alte Chefin ist freundlich. Sie will Anna zurück in München. Anna hört lange.",
 q("Nach München? Ich weiß nicht. Ich brauche Zeit. Ich antworte später."),
 "Sie vergisst die Suppe.",
 "Rauch kommt aus der Küche. Jan steht in der Tür und hustet.",
 q("Anna! Der Topf!")+", ruft Jan.",
 "Anna rennt zum Herd. Die Suppe ist verbrannt und hart. Anna weint fast, denn der Topf ist Jans Lieblingstopf. Sie hält den heißen Deckel vorsichtig in der linken Hand.",
 q("Es tut mir so leid. Ich kaufe einen neuen Topf."),
 q("Wer ist am Telefon?"),
 q("München. Meine alte Arbeit."),
 "Jan ist nicht böse. Er kratzt lange im Topf.",
 q("Der Topf ist kaputt. Kein Drama. Die Freunde kommen um acht."),
 "Der schwarze Topf steht jetzt vor der Tür.",
])
s2 = "\n\n".join([
 "Drei kleine Töpfe stehen auf dem Herd. Drei kleine Töpfe stehen auf dem Tisch. Es riecht nach Karotten. Jeder im Haus bringt einen Topf.",
 "Luisa kommt mit zwei Tüten Gemüse.",
 q("Sechs Töpfe? Gut! Wir kochen sechs kleine Suppen")+", sagt Luisa.",
 q("Aber die Gäste kommen gleich."),
 q("Wir sind schnell. Hier sind die Karotten."),
 "Anna schneidet. Luisa würzt mit Kräutern. Die Löffel klappern.",
 "Anna ist müde, aber froh, denn der Abend ist nicht verloren. Sie deckt den Tisch mit zehn Tellern.",
 "Die Gäste kommen. Alle sind hungrig. Die Nachbarn sitzen mit Jan am Tisch. Die Löffel passen nicht zusammen. Die Teller sind alle verschieden.",
 q("Das ist meine Suppe von früher. Aber in sechs Töpfen")+", sagt Anna.",
 "Jan isst zwei Teller und schmatzt.",
 q("Die Suppe ist lecker. Wie früher, nur besser."),
 "Alle sind satt und zufrieden. Luisa trinkt ein Glas Wein neben Anna. Die sechs Töpfe sind leer.",
])
out=[
 {"topic":T,"slotIndex":0,"title":"Ein Rezept für zehn","arcType":None,"synopsis":"","text":s0,"vocab":[]},
 {"topic":T,"slotIndex":1,"title":"Jans Lieblingstopf","arcType":None,"synopsis":"","text":s1,"vocab":[]},
 {"topic":T,"slotIndex":2,"title":"Sechs kleine Suppen","arcType":None,"synopsis":"","text":s2,"vocab":[]},
]
json.dump(out,open(f"scripts/_deA0Friends/t6-texts.json","w"),ensure_ascii=False,indent=1)
for d in out:
    t=d["text"]; w=len(re.findall(r"\w+",t)); qw=sum(len(re.findall(r"\w+",m)) for m in re.findall(O+"([^"+C+"]*)"+C,t))
    narr=re.sub(O+"[^"+C+"]*"+C," ",t); L=sorted(len(x.split()) for x in re.split(r"(?<=[.!?])\s+",narr) if len(x.split())>1)
    print(d["title"],"palabras",w,"citado %.0f%%"%(100*qw/w),"mediana",L[len(L)//2],"max",L[-1])
