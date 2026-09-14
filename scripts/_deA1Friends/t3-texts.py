import json
T="pets-and-animal-care"
s0=["Nach dem Lauftreff steht Julia mit Moritz am Ufer. Die Sonne ist schon warm. Florian aus dem Lauftreff kommt mit einem großen braunen Hund. Florian ist Elektriker und muss am Wochenende weit weg arbeiten.",
"“Kannst du auf meinen Hund aufpassen? Von Freitag bis Sonntag. Er ist ganz lieb, wirklich”, fragt Florian. “Moritz kann leider nicht.” Der Hund legt seinen schweren Kopf auf Julias Schuh.",
"Julia hat Angst vor großen Hunden. Das sagt sie nicht. “Ja, klar, das mache ich gern”, antwortet sie. “Danke, wirklich!”, sagt Florian erleichtert.",
"Zu Hause öffnet Julia die App der Bahn. “Oh nein, mein Zug nach Rostock!”, murmelt sie. Er fährt am Samstag, ihre erste Reise nach Hause seit dem Umzug.",
"Julia storniert das Ticket und bekommt nur die Hälfte zurück. Sie legt die Leine auf den Tisch. “Rostock muss bis nächsten Monat warten”, sagt sie zu der Leine und lacht ein bisschen. Ihre Hand zittert."]
s1=["Ein Hundebett, eine Decke und ein Sack Futter: Florian bringt am Freitagabend den Hund und alles mit. “Zweimal am Tag füttern und dreimal raus. Er ist lieb, aber er bellt bei Katzen”, erklärt er.",
"Der Hund liegt nicht im Hundebett. Er liegt vor der Tür und jault leise. Julia sitzt auf dem Sofa und bewegt sich kaum.",
"Später klopft Moritz. “Ich höre ihn durch die Wand. Alles gut?”, fragt er.",
"“Ich habe Angst vor ihm”, gibt Julia leise zu. Moritz setzt sich gemütlich auf den Boden, und der Hund legt sich sofort neben ihn. “Setz dich einfach dazu. Er riecht zuerst an dir”, sagt Moritz.",
"Die Hundenase ist nass und warm. Nach einer Stunde streichelt Julia zum ersten Mal das weiche Fell.",
"Am Samstagmorgen geht Julia allein mit ihm in den Park. Plötzlich sieht der Hund eine Katze und rennt schnell los. Die Leine rutscht aus ihrer Hand."]
s2=["Zwei Minuten später ist der Hund weg. Julia ruft laut, aber im Park hört sie nur Vögel. Mit zitternden Fingern schreibt sie in den Chat vom Lauftreff.",
"“Der Hund ist weggelaufen! Bitte, ich brauche Hilfe!” Svenja und Moritz sind nach zehn Minuten da. Svenja kennt den Park genau. “Keine Panik. Hunde laufen oft zum Wasser. Wir suchen am Ufer”, erklärt Svenja.",
"Julia sucht zwischen den Bäumen.",
"Dann hört Julia ein Bellen. “Da ist er!”, ruft sie. Der Hund steht unter einem Baum. Oben auf einem Ast sitzt die Katze und schaut ganz ruhig nach unten.",
"Julia geht langsam zu ihm. Ihr Herz schlägt laut, aber ihre Stimme ist ruhig. “Komm, mein Großer. Wir gehen nach Hause”, sagt sie leise. Der Hund ist müde und leckt ihre Hand.",
"Am Sonntagabend holt Florian ihn ab. “Und? War er lieb?”, fragt er. “Meistens. Er hat mir den Park gezeigt”, antwortet Julia und lacht."]
out=[{"topic":T,"slotIndex":i,"title":ti,"arcType":None,"synopsis":"","text":"\n\n".join(tx),"vocab":[]} for i,(ti,tx) in enumerate([("Ein Hund fürs Wochenende",s0),("Nachts vor der Tür",s1),("Eine Katze im Park",s2)])]
json.dump(out,open("scripts/_deA1Friends/t3-data.json","w"),ensure_ascii=False,indent=1)

def V(t,w,s,d,a=False):
    o={"type":t,"word":w,"surface":s,"definition":d}
    if a: o["anchor"]=True
    return o
out[0]["vocab"]=[
V("noun","der Elektriker","Elektriker","A man whose job is to fix and put in electric wires and lights.",True),
V("noun","die Leine","Leine","A lead; the long strap you use to walk a dog.",True),
V("verb","müssen","muss","Must; to have to do something because there is no other way."),
V("adjective","braun","braunen","Brown; the colour of wood, coffee or chocolate."),
V("verb","arbeiten","arbeiten","To work; to do your job and earn money for it."),
V("adjective","weit","weit","Far; a long way away from here, not close at all."),
V("adjective","lieb","lieb","Sweet and kind; nice to people and easy to be with."),
V("adverb","leider","leider","Sadly; unfortunately, you are sorry that it is like this."),
V("verb","haben","hat","To have; here, to feel something, like fear or no time."),
V("verb","stehen","steht","To stand; to be on your feet and not sit down."),
V("adverb","gern","gern","Gladly; you are happy to do it and you like it."),
V("adverb","klar","klar","Sure; of course, you say it when you agree at once."),
V("verb","öffnen","öffnet","To open something, like a door, a box or an app."),
V("verb","fahren","fährt","To go by car, bus or train from one place to another."),
V("adverb","zurück","zurück","Back; to the place or the person where it was before."),
V("adjective","warm","warm","Warm; nice and a little hot, not cold at all."),
V("noun","das Ticket","Ticket","A ticket; the paper or code you need to ride a train."),
V("adjective","nächste","nächsten","Next; the one that comes right after this one."),
V("noun","das Bisschen","bisschen","A little bit; a small amount, not very much at all."),
V("verb","antworten","antwortet","To answer; to say something back when someone asks you."),]
out[1]["vocab"]=[
V("noun","das Hundebett","Hundebett","A soft bed for a dog to sleep in.",True),
V("noun","der Freitagabend","Freitagabend","The evening of a Friday, when the work week is over.",True),
V("verb","bringen","bringt","To bring; to carry something with you to a place."),
V("verb","erklären","erklärt","To explain; to tell someone clearly how something works."),
V("verb","bellen","bellt","To bark; the loud, short sound a dog makes."),
V("verb","liegen","liegt","To lie; to be flat on a bed, the floor or a sofa."),
V("verb","sitzen","sitzt","To sit; to be on a chair, a sofa or the floor."),
V("verb","bewegen","bewegt","To move; to change the place or position of your body."),
V("adverb","später","Später","Later; after some time has passed, not right now."),
V("verb","klopfen","klopft","To knock; to hit a door softly with your hand."),
V("adjective","leise","leise","Quiet; with a soft, low voice that is not loud."),
V("adjective","nass","nass","Wet; covered with water or another liquid, not dry."),
V("verb","rennen","rennt","To run very fast, usually for a short distance."),
V("adjective","gemütlich","gemütlich","Comfortable and relaxed; you feel easy and at home."),
V("adjective","weich","weiche","Soft; nice and not hard when you touch it."),

V("adverb","allein","allein","Alone; with nobody else there, only by yourself."),
V("adjective","gut","gut","Good or fine; you say it when everything is okay."),
V("noun","der Park","Park","A park; a big green place in a city with trees and grass."),
V("adverb","schnell","schnell","Fast; quickly, it happens in a very short time."),
V("verb","streicheln","streichelt","To stroke; to move your hand softly over an animal's fur."),]
out[2]["vocab"]=[
V("verb","laufen","laufen","To run; here, to go quickly on your feet."),
V("noun","die Vögel","Vögel","Birds; animals with wings and feathers that can often fly."),
V("verb","schreiben","schreibt","To write words, for example a message on a phone."),
V("verb","weglaufen","weggelaufen","To run away from a place or a person."),
V("verb","brauchen","brauche","To need; you must have it and cannot do it without it."),
V("adverb","genau","genau","Exactly; very well, with every small detail and every path."),
V("noun","die Bäume","Bäumen","Trees; tall plants with a trunk, branches and leaves."),
V("adverb","da","da","There; in that place, or here and ready now."),
V("noun","die Panik","Panik","Panic; a sudden, strong fear that stops you thinking clearly."),
V("verb","schauen","schaut","To look; to turn your eyes to something and watch it."),
V("adverb","unten","unten","Down; below, in a lower place than you are."),
V("noun","die Katze","Katze","A cat; a small animal with soft fur that people keep at home."),
V("verb","schlagen","schlägt","To beat; here, the heart moves hard and fast."),
V("adverb","oft","oft","Often; many times, again and again, not only once."),
V("noun","der Sonntagabend","Sonntagabend","The evening of a Sunday, at the end of the weekend.",True),
V("adjective","zitternd","zitternden","Shaking; moving a little, fast and without control, often from fear."),
V("verb","zeigen","gezeigt","To show; to let someone see a place or a thing."),
V("verb","lachen","lacht","To laugh; to make happy sounds because something is funny."),
V("adverb","ganz","ganz","Quite or very; completely, fully and not only a little."),
V("adverb","nur","nur","Only; just this and nothing more than this."),
V("adjective","müde","müde","Tired; you feel you need rest or sleep."),]
syn=["After the weekly run Florian, a friend from the running group, comes with his big brown dog. He has to work far away at the weekend and asks Julia to look after the dog. Julia is afraid of big dogs, but she says yes. Then she remembers her train ticket to Rostock for that same weekend.",
"At the start of the weekend Florian brings the dog, a bed and a big bag of food. The dog does not sleep and lies at the door all night. Moritz hears it through the wall and shows Julia how to be calm with the dog. The next morning in the park the dog sees a cat.",
"The dog has run away in the park, and Julia asks the running group for help. Svenja and Moritz come quickly and they all look for him. Julia finds the dog under a tree, where a cat sits high up on a branch. At the end of the weekend Florian comes back for his dog."]
for o,sy,ar in zip(out,syn,["late-reveal","mini-cliffhanger","juxtaposition-discovery"]): o["synopsis"]=sy; o["arcType"]=ar
json.dump(out,open("scripts/_deA1Friends/t3-data.json","w"),ensure_ascii=False,indent=1)
