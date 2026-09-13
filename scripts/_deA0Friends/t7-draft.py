import json, re
O,C="“","”"
def q(s): return O+s+C
T="plans-and-decisions"
s0 = "\n\n".join([
 "Eine Notiz klebt an Annas Tür. Die Schrift ist ordentlich. Anna, die Mieterin von oben, lehnt am Geländer und liest. Die Notiz ist höflich.",
 "Niklas ist der Hausbesitzer. Er wohnt im Erdgeschoss und trägt immer einen braunen Pullover. Er ist nett und freundlich, aber streng.",
 q("Liebe Anna, die Wohnung ist nur bis Freitag frei. Bitte gib mir eine Antwort. Niklas"),
 "Anna liest die Notiz zweimal. Die Wohnung oben ist klein, aber gemütlich. Sie hat viel Licht. Anna mag den Blick in den Hof. Das Fenster ist offen.",
 "Niklas steht plötzlich neben ihr. Er räuspert sich.",
 q("Hallo Anna. Eine Frau aus Hamburg will die Wohnung leider auch."),
 q("Und ich? Ich brauche noch ein bisschen Zeit."),
 q("Ich warte bis Freitag. Der Freitag ist die Grenze."),
 "Anna ist blass, denn München wartet auch bis Freitag. Sie knüllt die Notiz in der Faust.",
 q("Gut. Du bekommst am Freitag eine Antwort."),
 "Niklas nickt. Seine Schuhe quietschen auf der Treppe.",
])
s1 = "\n\n".join([
 "Es ist schon dunkel. Anna steht mit einem Kuli vor Jans Kühlschrank. Sie macht eine Liste mit zwei Spalten.",
 "München steht links. Bremen steht rechts. Anna schreibt unter München: mehr Geld, großes Büro, alte Arbeit. Sie schreibt unter Bremen: Jan, Freunde, Donnerstag, Musik.",
  q("Geld, Büro, Arbeit. Jan, Freunde, Donnerstag")+", murmelt Anna.",
 "Jan kommt in die Küche und gähnt. Der Kühlschrank summt.",
 q("Was ist das für eine Liste?")+", fragt Jan.",
 q("Für Freitag. München oder Bremen."),
 "Jan liest die Liste.",
 q("Mein Name steht hier. Ich will nicht dein Grund sein. Du entscheidest für dich."),
 "Jan macht einen Strich durch seinen Namen.",
 "Anna telefoniert mit München. Sie bittet um eine Woche mehr. Die Chefin sagt sofort Nein.",
 "Anna ist ratlos, denn beide Spalten sind jetzt gleich lang. Sie kaut auf dem Kuli.",
 q("Und jetzt?")+", flüstert sie.",
 q("Jetzt schläfst du. Die Antwort kommt morgen."),
 "Jan geht leise in den Hof. Die Spalte für Bremen ist jetzt kürzer.",
])
s2 = "\n\n".join([
 "Ihre Hand ist ruhig. Anna unterschreibt den Vertrag mit blauer Tinte. Niklas schüttelt ihr die Hand. Er ist zufrieden.",
 "Er gibt ihr zwei Schlüssel. Die Schlüssel sind kalt. Einer ist für oben, einer ist für den Keller.",
 "Anna tippt eine kurze Nachricht an ihre Chefin: Nein, danke. Sie schluckt schwer, denn die Arbeit in München ist gut.",
 "Jan wartet dort mit zwei Gläsern Sekt. Die Gläser klirren.",
 q("Und? Was sagt der Vertrag?")+", fragt Jan.",
 q("Zwei Jahre. Mindestens zwei Jahre."),
 q("Und München? Bist du sicher?"),
 q("München sagt Tschüss. Das Geld auch."),
 q("Dann Prost!")+", ruft Jan.",
 "Jan öffnet seine Schublade. Die erste Postkarte liegt noch dort. Die Ecken sind krumm.",
 q("Lieber Jan, ich komme im Mai. Deine Anna."),
 "Anna schreibt einen neuen Satz darunter.",
 q("Ich bleibe")+", liest Jan. "+q("Das ist der beste Satz auf der Karte."),
 "Jan klebt die Karte mit einem Magneten an den Kühlschrank. Annas Name steht wieder auf der Liste.",
])
out=[
 {"topic":T,"slotIndex":0,"title":"Eine Notiz an Annas Tür","arcType":None,"synopsis":"","text":s0,"vocab":[]},
 {"topic":T,"slotIndex":1,"title":"Die Liste am Kühlschrank","arcType":None,"synopsis":"","text":s1,"vocab":[]},
 {"topic":T,"slotIndex":2,"title":"Die Karte vom Mai","arcType":None,"synopsis":"","text":s2,"vocab":[]},
]
json.dump(out,open(f"scripts/_deA0Friends/t7-texts.json","w"),ensure_ascii=False,indent=1)
for d in out:
    t=d["text"]; w=len(re.findall(r"\w+",t)); qw=sum(len(re.findall(r"\w+",m)) for m in re.findall(O+"([^"+C+"]*)"+C,t))
    narr=re.sub(O+"[^"+C+"]*"+C," ",t); L=sorted(len(x.split()) for x in re.split(r"(?<=[.!?])\s+",narr) if len(x.split())>1)
    print(d["title"],"palabras",w,"citado %.0f%%"%(100*qw/w),"mediana",L[len(L)//2],"max",L[-1])
