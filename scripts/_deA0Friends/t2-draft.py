import json, re
O,C="“","”"
def q(s): return O+s+C
T="looks-and-memories"
s0 = "\n\n".join([
 "Jans Kühlschrank ist voll mit Fotos. Anna wohnt jetzt oben im Haus. Jan kocht heute für die Freunde.",
 "Anna sucht ihr Gesicht auf den Fotos. Jan ist auf jedem Foto. Eine Frau mit Brille steht immer neben ihm. Anna ist auf keinem Foto.",
 "Ihr Bauch ist hart, denn diese Frau hat ihren Platz. Sie nimmt ein Foto vom Kühlschrank. Sie drückt das Foto an die Brust.",
 "Die Tür öffnet sich. Jans Nachbarin Nele steht dort. Sie ist Fotografin und trägt eine runde Brille.",
 q("Hallo! Wer bist du?")+", ruft Nele.",
 q("Ich bin Anna. Ich wohne oben."),
 q("Anna aus München? Endlich!"),
 "Nele umarmt Anna. Anna hält noch das Foto.",
 q("Das bin ich, mit Jan im Park. Du fehlst auf dem Foto."),
 q("Acht Jahre fehle ich")+", antwortet Anna leise.",
 q("Aber jetzt bist du hier. Ich mache gern ein Foto von dir."),
 "Anna hängt das Foto wieder an den Kühlschrank. Sie lächelt. Ihr Bauch ist noch ein bisschen hart.",
])
s1 = "\n\n".join([
 "Ein altes Foto liegt auf Jans Tisch. Nele findet es in einer Kiste. Anna und Jan sind darauf zwanzig Jahre alt.",
 "Anna trägt auf dem Foto eine große Brille. Ihre Haare sind lang und blond. Jan hat noch keinen Bart.",
 q("Das bist du? Die Brille ist so groß!")+", ruft Nele.",
 q("Ich weiß. Ich bin da zwanzig")+", antwortet Anna.",
 "Nele holt ihre Kamera.",
 q("Ich brauche ein Foto von dir. Für den Kühlschrank."),
 "Ihr Gesicht ist heiß, denn die Anna auf dem Foto ist so jung. Sie hat jetzt Falten um die Augen.",
 q("Nein, bitte nicht. Ich bin nicht mehr zwanzig."),
 q("Egal. Du bist schön."),
 "Nele macht zehn Fotos. Anna schließt jedes Mal die Augen.",
 "Jan steht in der Tür. Er trägt Annas alte Brille. Er macht ein ernstes Gesicht.",
 "Anna lacht laut. Nele macht schnell ein Foto.",
 q("Das Foto ist wunderbar."),
 "Das neue Foto hängt jetzt am Kühlschrank. Das alte Foto liegt in der Kiste.",
])
s2 = "\n\n".join([
 "Der Rahmen ist aus Holz. Anna kauft ihn für Jan. Sie hat zwei Fotos in der Jacke.",
 "Das erste Foto ist alt. Anna und Jan sind allein am Strand. Das zweite Foto ist neu. Nele steht zwischen Anna und Jan.",
 "Anna sitzt auf der Treppe vor Jans Tür. Die Treppe ist kalt.",
 "Ihr Herz ist schwer, denn das alte Foto ist nur für zwei. Sie legt es auf ihr Knie.",
 "Jan öffnet die Tür.",
 q("Anna? Warum sitzt du hier?"),
 q("Der Rahmen ist für dich. Aber ich habe zwei Fotos und nur einen Rahmen."),
 "Jan schaut lange auf das alte Foto.",
 q("Wir sind allein am Strand. Und so jung und dünn!"),
 q("Welches Foto willst du?"),
 q("Ich? Du entscheidest")+", sagt Jan.",
 "Anna steckt das neue Foto in den Rahmen. Das alte Foto kommt in ihre Jacke.",
 q("Jetzt sind wir drei")+", sagt Anna.",
 "Jan hängt den Rahmen neben den Kühlschrank. Die beiden stehen lange davor.",
])
out=[
 {"topic":T,"slotIndex":0,"title":"Fotos am Kühlschrank","arcType":None,"synopsis":"","text":s0,"vocab":[]},
 {"topic":T,"slotIndex":1,"title":"Die Brille von früher","arcType":None,"synopsis":"","text":s1,"vocab":[]},
 {"topic":T,"slotIndex":2,"title":"Ein Rahmen für drei","arcType":None,"synopsis":"","text":s2,"vocab":[]},
]
json.dump(out,open("scripts/_deA0Friends/t2-texts.json","w"),ensure_ascii=False,indent=1)
for d in out:
    t=d["text"]; w=len(re.findall(r"\w+",t)); qw=sum(len(re.findall(r"\w+",m)) for m in re.findall(O+"([^"+C+"]*)"+C,t))
    narr=re.sub(O+"[^"+C+"]*"+C," ",t); L=sorted(len(x.split()) for x in re.split(r"(?<=[.!?])\s+",narr) if len(x.split())>1)
    print(d["title"],"palabras",w,"citado %.0f%%"%(100*qw/w),"mediana",L[len(L)//2],"max",L[-1])
