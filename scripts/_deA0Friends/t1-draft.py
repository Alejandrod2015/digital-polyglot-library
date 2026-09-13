import json
O,C="“","”"
def q(s): return O+s+C
s0 = "\n\n".join([
 "Anna, eine Grafikerin aus Bremen, sitzt in einer alten Küche im Viertel. Sie ist zurück in Bremen. Ihre Hände sind kalt.",
 "Jan ist ein Koch und ihr Freund aus der Schulzeit. Er wohnt unten im Haus. Er bringt zwei Tassen Tee.",
 "Anna hat eine Schachtel dabei. Die Schachtel ist voll mit Postkarten. Keine Karte hat eine Briefmarke.",
 q("Was ist das?")+", fragt Jan.",
 q("Meine Karten aus München. Alle für dich. Ich schicke sie nie."),
 "Jan nimmt die erste Karte. Er liest laut.",
 q("Lieber Jan, ich komme im Mai. Deine Anna."),
 q("Im Mai? Welcher Mai?"),
 "Anna wird rot, denn dieser Mai ist acht Jahre alt. Sie steckt die Hände in die Jacke.",
 q("Ich weiß. Ich komme nicht. Es tut mir leid."),
 "Jan trinkt still seinen Tee. Er öffnet eine Schublade. Die sieben Karten liegen jetzt dort.",
 q("Die Karten bleiben hier bei mir. Und du bleibst auch hier, oder?"),
 "Anna atmet tief. Ihr Tee ist noch warm.",
])
s1 = "\n\n".join([
 "Zwölf Namen stehen auf einem alten Zettel. Der Zettel ist sehr alt. Anna kennt jeden Namen. Die Küche riecht nach Tee.",
 "Anna will jedem Freund eine Postkarte schicken. Die Karte ist eine Einladung für Donnerstag. Alle essen dann bei Jan, wie früher.",
 q("Ich brauche die Adressen")+", sagt Anna.",
 "Jan nimmt sein Handy. Er zeigt auf die Namen.",
 q("Er wohnt in Kiel. Sie wohnt in Hamburg. Er wohnt in Berlin. Sie wohnt in Köln."),
 "Anna macht einen Strich durch jeden Namen. Ein Strich, noch ein Strich.",
 q("Und hier?")+", fragt sie.",
 q("Hamburg. Der auch."),
 "Anna zählt.",
 q("Vier Freunde sind noch in Bremen. Acht Karten sind zu viel."),
 "Ihr Hals ist eng, denn die Gruppe ist so klein. Sie faltet den Zettel langsam. Acht Karten landen im Müll.",
 q("Vier ist nicht schlecht")+", meint Jan.",
 q("Vier ist nicht zwölf."),
 q("Und ich? Ich bin fünf."),
 "Anna lächelt ein bisschen. Sie nimmt eine Karte mehr und schreibt Jans Namen darauf.",
])
s2 = "\n\n".join([
 "Die Post ist am Sonntag geschlossen. Anna hat fünf Karten und keine Briefmarke. Der Donnerstag kommt bald.",
 "Jan sucht in seiner Schublade. Er findet ein kleines Heft mit Briefmarken.",
 q("Die Marken sind alt, aber gut. Fünf Stück. Genau fünf."),
 "Anna zieht noch eine Karte aus der Jacke.",
 q("Ich habe sechs Karten. Diese Karte ist für München, für meine alte Arbeit."),
 q("Sechs Karten und fünf Marken?")+", ruft Jan.",
 "Anna legt zwei Karten nebeneinander. Eine ist für München. Eine ist für Jan.",
 q("München oder du")+", sagt sie leise.",
 "Anna zerreißt die Karte für München. Das tut weh, denn die Arbeit dort ist gut. Die Stücke fallen in den Müll.",
 q("Die letzte Marke ist für dich."),
 q("Ich wohne unten im Haus!"),
 q("Egal. Du bekommst eine Karte."),
 "Jan klebt die Marke auf seine Karte. Die Luft ist kalt. Der gelbe Briefkasten steht an der Ecke.",
 "Anna steckt die Karten in den Briefkasten. Jan legt den Arm um ihre Schulter.",
])
out=[
 {"topic":"letters-and-invitations","slotIndex":0,"title":"Karten ohne Briefmarke","arcType":None,"synopsis":"","text":s0,"vocab":[]},
 {"topic":"letters-and-invitations","slotIndex":1,"title":"Zwölf alte Adressen","arcType":None,"synopsis":"","text":s1,"vocab":[]},
 {"topic":"letters-and-invitations","slotIndex":2,"title":"Fünf Marken am Sonntag","arcType":None,"synopsis":"","text":s2,"vocab":[]},
]
json.dump(out,open("scripts/_deA0Friends/t1-texts.json","w"),ensure_ascii=False,indent=1)
import re
for d in out:
    t=d["text"]; w=len(re.findall(r"\w+",t)); qw=sum(len(re.findall(r"\w+",m)) for m in re.findall(O+"([^"+C+"]*)"+C,t))
    narr=re.sub(O+"[^"+C+"]*"+C," ",t); sents=[x for x in re.split(r"(?<=[.!?])\s+",narr) if len(x.split())>1]
    L=sorted(len(x.split()) for x in sents)
    print(d["title"], "palabras",w,"citado %.0f%%"%(100*qw/w), "mediana",L[len(L)//2],"max",L[-1])
