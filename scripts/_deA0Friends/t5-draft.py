import json, re
O,C="“","”"
def q(s): return O+s+C
T="music-and-singing"
s0 = "\n\n".join([
 "Ihr altes Lied ist fünfzehn Jahre alt. Anna, die Sängerin von früher, singt es nie mehr. Sie trinkt heute Tee in Jans Küche. Der Tee ist warm.",
 "Jans Schulfreund Tim kommt mit zwei Trommelstöcken. Er ist Bankkaufmann, aber er spielt am Wochenende Schlagzeug. Er trägt eine rote Mütze und lacht oft. Jan ist gerade im Hof.",
 q("Jan hat am Samstag Geburtstag. Die Band spielt wieder, wie früher!")+", flüstert Tim.",
 q("Die Band? Wer spielt denn?"),
 q("Ich spiele Schlagzeug. Ein Freund spielt Klavier. Und du singst."),
 "Anna hat plötzlich Angst. Die Stimme von Anna ist seit Jahren still. Sie dreht nervös ihre Tasse.",
 q("Ich singe nicht mehr gern. Meine Stimme ist alt."),
 q("Deine Stimme ist nicht alt. Bitte, das ist wichtig. Für Jan."),
 "Die Tür öffnet sich. Jan kommt in die Küche. Tim versteckt die Stöcke hinter dem Rücken.",
 "Anna nickt schnell. Sie kann nicht mehr Nein sagen. Tim lacht leise.",
])
s1 = "\n\n".join([
 "Es regnet, und der Keller ist kalt. Tims Schlagzeug steht zwischen den Fahrrädern. Anna hält den Text von früher.",
 q("Eins, zwei, drei, vier!")+", ruft Tim.",
 "Tims Stöcke schlagen auf die Trommel.",
 "Anna singt die erste Strophe. Die tiefen Töne sind nicht schlecht. Die Stimme klingt warm.",
 "Der Refrain kommt. Der Refrain ist sehr hoch. Annas Stimme bricht. Der Ton ist falsch und laut.",
 "Anna schämt sich, denn Tim hört den falschen Ton. Sie hält die Hände vor den Mund.",
 q("Noch einmal. Ganz ruhig."),
 "Anna trinkt einen Schluck Wasser. Sie singt noch einmal. Die Stimme bricht wieder.",
 q("Das Lied ist zu hoch für mich. Es geht nicht")+", sagt Anna.",
 q("Kein Problem. Wir schreiben bis Samstag ein neues Lied. Ein Lied für Jan, tief und einfach."),
 q("Und das alte Lied?")+", fragt Anna.",
 q("Das alte Lied bleibt im Keller."),
 "Der alte Text kommt in ihre Tasche. Anna singt das alte Lied nie wieder.",
])
s2 = "\n\n".join([
 "Viele Kerzen brennen auf dem Kuchen. Die Küche ist voll, laut und warm. Jan hat heute Geburtstag. Er ist fünfunddreißig.",
 "Jemand macht das Licht dunkel. Die Musik beginnt. Tim sitzt am Schlagzeug. Ein Freund sitzt am Klavier. Anna steht vor dem Kühlschrank.",
 "Annas Knie zittern, denn alle schauen auf sie. Sie hält das Mikrofon mit beiden Händen.",
 q("Jan, dieses Lied ist neu. Es ist nur für dich")+", sagt Anna.",
 "Tim spielt leise. Anna singt tief und ruhig.",
 q("Eine Straße, ein Haus, eine Tür. Acht Jahre, und die Tür ist noch offen."),
 "Tim spielt den letzten Schlag. Niemand spricht. Jan wischt sich mit dem Ärmel über die Augen.",
 q("Danke. Aber was ist mit dem alten Lied?")+", fragt Jan.",
 q("Das alte Lied gehört zu früher. Das neue Lied gehört zu jetzt."),
 "Alle klatschen und pfeifen. Der Freund am Klavier spielt noch einmal die Melodie. Anna singt jetzt ohne Angst, und Jan umarmt sie vor dem Kühlschrank.",
])
out=[
 {"topic":T,"slotIndex":0,"title":"Tims Trommelstöcke","arcType":None,"synopsis":"","text":s0,"vocab":[]},
 {"topic":T,"slotIndex":1,"title":"Zu hoch für Anna","arcType":None,"synopsis":"","text":s1,"vocab":[]},
 {"topic":T,"slotIndex":2,"title":"Ein Lied für Jan","arcType":None,"synopsis":"","text":s2,"vocab":[]},
]
json.dump(out,open(f"scripts/_deA0Friends/t5-texts.json","w"),ensure_ascii=False,indent=1)
for d in out:
    t=d["text"]; w=len(re.findall(r"\w+",t)); qw=sum(len(re.findall(r"\w+",m)) for m in re.findall(O+"([^"+C+"]*)"+C,t))
    narr=re.sub(O+"[^"+C+"]*"+C," ",t); L=sorted(len(x.split()) for x in re.split(r"(?<=[.!?])\s+",narr) if len(x.split())>1)
    print(d["title"],"palabras",w,"citado %.0f%%"%(100*qw/w),"mediana",L[len(L)//2],"max",L[-1])
