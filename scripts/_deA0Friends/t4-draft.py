import json, re
O,C="“","”"
def q(s): return O+s+C
T="books-and-reading"
s0 = "\n\n".join([
 "Die Treppe im Haus ist dunkel. Anna ist eine Grafikerin und wohnt oben. Sie steht vor einem alten Schrank. Der Schrank ist hoch und voll mit Büchern.",
 "Die Bücher sind dick und dünn, neu und alt. Staub liegt auf den Büchern. Anna sucht ein grünes Buch. Ein Zettel für Jan liegt darin.",
 "Johanna ist eine Buchhändlerin aus dem zweiten Stock. Sie trägt einen Stapel Bücher im Arm und einen Stift hinter dem Ohr.",
 q("Suchst du etwas Bestimmtes?")+", fragt Johanna.",
 q("Ja. Einen dicken grünen Roman."),
 q("Grün? Das Buch ist leider nicht mehr hier."),
 q("Wo ist es?")+", flüstert Anna.",
 q("Jemand aus Hamburg liest es jetzt."),
 "Annas Magen ist schwer, denn der Zettel ist in dem Buch. Sie seufzt und setzt sich auf die Stufe.",
 q("Der Zettel ist für Jan. Er ist wichtig."),
 q("Keine Sorge. Ich sammle alle Zettel aus den Büchern."),
 "Johanna rennt sofort in den zweiten Stock. Sie kommt mit einer Dose.",
])
s1 = "\n\n".join([
 "Viele kleine Zettel liegen in Johannas Dose. Johanna und Anna sitzen zusammen auf der Treppe. Johanna liest die Zettel laut.",
 q("Seite zwölf ist traurig. Danke für das Buch!"),
 "Johanna lacht über jeden Zettel. Die Treppe ist kalt, aber die Zettel sind lustig.",
 q("Noch einer: Der Kaffee ist kalt, das Buch ist gut."),
 "Anna lächelt. Sie nimmt einen gelben Zettel. Die Schrift ist klein und schief. Die Schrift ist ihre Schrift.",
 q("Jan, lies Seite vierzig. Ich denke an dich. Anna")+", liest Anna leise.",
 "Jan findet den Zettel nie. Er liest die Seite nie.",
 "Annas Kopf ist leer, denn der Zettel wartet acht Jahre in einer Dose. Sie drückt den Zettel an ihr Herz.",
 q("Was steht auf Seite vierzig?")+", fragt Johanna.",
 q("Ich weiß es nicht mehr. Ich kenne nur den Titel."),
 q("Der Titel reicht. Ich besorge das Buch bald."),
 "Johanna schreibt den Titel in ihr Heft. Anna steckt den gelben Zettel in die Jacke.",
])
s2 = "\n\n".join([
 "Ein neues Buch ist da. Es ist grün, genau wie das alte. Johanna bringt es aus ihrer Buchhandlung. Das Buch riecht nach Papier.",
 "Anna klopft zweimal an Jans Tür. Der gelbe Zettel ist in ihrer Hand.",
 q("Anna? Ein Buch für mich?"),
 q("Ein Buch und ein Zettel. Beide sind acht Jahre zu spät."),
 "Jan kocht gerade Tomatensuppe. Er liest den Zettel am Herd. Er setzt sich an den Tisch und öffnet das Buch auf Seite vierzig.",
 q("Lies du. Bitte")+", sagt Jan.",
 "Anna liest vorsichtig, Zeile für Zeile. Ihre Stimme zittert, denn Jan sitzt ganz ruhig neben ihr.",
 q("Zwei Freunde sitzen am Meer. Sie sprechen nicht. Sie sind trotzdem zusammen."),
 q("Wir sitzen nicht am Meer. Wir sitzen in meiner Küche."),
 q("Die Küche ist auch schön."),
 "Jan stellt das grüne Buch in sein Regal. Anna sieht den Rahmen mit dem Foto daneben. Die beiden essen Suppe und sagen lange nichts. Jan ist froh.",
])
out=[
 {"topic":T,"slotIndex":0,"title":"Bücher auf der Treppe","arcType":None,"synopsis":"","text":s0,"vocab":[]},
 {"topic":T,"slotIndex":1,"title":"Zettel in Johannas Dose","arcType":None,"synopsis":"","text":s1,"vocab":[]},
 {"topic":T,"slotIndex":2,"title":"Seite vierzig","arcType":None,"synopsis":"","text":s2,"vocab":[]},
]
json.dump(out,open(f"scripts/_deA0Friends/t4-texts.json","w"),ensure_ascii=False,indent=1)
for d in out:
    t=d["text"]; w=len(re.findall(r"\w+",t)); qw=sum(len(re.findall(r"\w+",m)) for m in re.findall(O+"([^"+C+"]*)"+C,t))
    narr=re.sub(O+"[^"+C+"]*"+C," ",t); L=sorted(len(x.split()) for x in re.split(r"(?<=[.!?])\s+",narr) if len(x.split())>1)
    print(d["title"],"palabras",w,"citado %.0f%%"%(100*qw/w),"mediana",L[len(L)//2],"max",L[-1])
