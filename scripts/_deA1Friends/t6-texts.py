import json
T="moods-and-feelings"
def V(t,w,s,d,a=False):
    o={"type":t,"word":w,"surface":s,"definition":d}
    if a: o["anchor"]=True
    return o
s0=["Seit drei Tagen antwortet Julias beste Freundin nicht. Julia hat deshalb schlechte Laune. Miriam, die Chefin der Praxis, merkt es schon am Montagmorgen. “Alles in Ordnung bei dir?”, fragt sie. Julia nickt nur.",
"Im Behandlungsraum ist es warm. Der erste Patient hat Schmerzen im Rücken. Julia arbeitet schnell und viel zu hart. “Au! Das ist falsch, nicht so fest, bitte!”, ruft der Mann sauer.",
"Julia nimmt gleich die Hände weg.",
"“Entschuldigung. Heute ist kein guter Arbeitstag für mich”, sagt sie leise. Ihre Hände sind unruhig.",
"Miriam kommt in den Raum und schaut sie ruhig an. “Ich mache hier weiter. Du gehst in den Pausenraum und trinkst einen Tee”, sagt sie freundlich, aber bestimmt. Julia kann nichts sagen.",
"Im Flur bleibt sie stehen und sieht auf ihre Hände. “Diese Hände helfen täglich Menschen. Heute haben sie einem Menschen wehgetan”, denkt sie."]
s1=["Der Pausenraum ist klein und warm, und draußen regnet es. Miriam bringt zwei Becher Tee und setzt sich neben Julia ans Fenster. Der Tee riecht nach Pfefferminze. “Willst du reden?”, fragt sie.",
"Julia sagt zuerst nichts. Dann kommen die Tränen, und Julia kann sie nicht stoppen. Julia fühlt sich schwach. Miriam ist nett und geduldig. Sie gibt ihr ein Taschentuch. “Ganz ruhig, ich bin da”, sagt sie.",
"“Ich habe Heimweh”, sagt Julia endlich. Sie hat hier neue Freunde, aber die Stadt ist noch fremd. Abends ist sie oft einsam, und dieses Gefühl ist schrecklich.",
"Miriam trinkt einen Schluck Tee. “Weißt du, ich glaube, das kenne ich. Es ist nicht leicht”, antwortet sie. Das Gespräch erinnert sie an ihr erstes Jahr hier.",
"Julia schaut sie erstaunt an. “Woher kommst du denn?”, fragt sie. Miriam lächelt. “Aus Kiel. Früher war Frankfurt auch für mich ein fremder Ort.”"]
s2=["Julia zögert lange auf dem Sofa. Der Gedanke an Rostock tut weh. “Genug gelogen”, denkt sie. Heute will sie mutig sein, wenigstens einmal.",
"Zuerst nimmt sie eine Sprachnachricht für Moritz auf. “Ich habe Heimweh, und manchmal will ich zurück nach Rostock. Bitte sag das niemandem”, spricht sie leise. Dann schreibt sie ihrer besten Freundin: “Das war gemein von mir. Ich habe deinen Geburtstag nicht vergessen, und ich habe ein schlechtes Gewissen.” Danach ist überall Stille. Das Fenster ist offen, und die Luft ist feucht.",
"Um zehn klingelt das Handy. Julia spürt ihr Herz bis in den Hals. “Hallo?”, fragt sie ängstlich.",
"“Du fehlst mir, du Idiotin. Komm bald mal wieder”, antwortet die Freundin. Beide lachen und weinen. Sie reden lange. Danach schläft Julia tief. Draußen hört der Regen auf, und ihre Brust ist endlich leicht."]
out=[{"topic":T,"slotIndex":i,"title":ti,"arcType":ar,"synopsis":"","text":"\n\n".join(tx),"vocab":[]} for i,(ti,tx,ar) in enumerate([("Zu feste Hände",s0,"juxtaposition-discovery"),("Tee im Pausenraum",s1,"late-reveal"),("Genug gelogen",s2,"harmonic-close")])]
out[0]["vocab"]=[
V("adverb","deshalb","deshalb","That is why; because of this reason, and so."),
V("adjective","schlecht","schlechte","Bad; not good, it makes you feel unhappy."),
V("noun","die Laune","Laune","Mood; how you feel at a certain time, good or bad.",True),
V("noun","der Montagmorgen","Montagmorgen","The morning of a Monday, at the start of the work week.",True),
V("noun","der Schmerz","Schmerzen","Pain; the feeling when a part of your body hurts."),
V("adjective","hart","hart","Hard; with a lot of force, not soft or gentle."),
V("adjective","falsch","falsch","Wrong; not right, not the way it should be."),
V("noun","der Behandlungsraum","Behandlungsraum","A treatment room; the room where a therapist works with patients.",True),
V("adverb","gleich","gleich","Right away; at once, without waiting even a moment."),
V("noun","der Arbeitstag","Arbeitstag","A working day; a day when you go to your job.",True),
V("adjective","unruhig","unruhig","Restless; not calm, moving a little all the time."),
V("verb","machen","mache","To do or make; here, to go on with the work."),
V("verb","trinken","trinkst","To drink; to take tea, water or another liquid."),
V("adjective","freundlich","freundlich","Friendly; kind, warm and nice to other people."),
V("adjective","sauer","sauer","Angry; a little cross because something went wrong."),
V("verb","können","kann","Can; to be able to do something right now."),
V("verb","bleiben","bleibt","To stay; to not move away from a place."),
V("verb","helfen","helfen","To help; to do something good for another person."),
V("adverb","täglich","täglich","Every day; each and every day, again and again."),
V("noun","der Patient","Patient","A patient; a person who gets help from a doctor or a therapist."),]
out[1]["vocab"]=[
V("verb","regnen","regnet","To rain; water falls down from the clouds in the sky."),
V("noun","der Becher","Becher","A mug; a big cup without a small plate under it.",True),
V("noun","die Pfefferminze","Pfefferminze","Peppermint; a green plant with a fresh smell, used for tea.",True),
V("adjective","nett","nett","Nice; kind and friendly to other people around you."),
V("noun","der Pausenraum","Pausenraum","A break room; a room at work where people rest and drink tea.",True),
V("adjective","schwach","schwach","Weak; with no power, you feel you cannot do much."),
V("adverb","zuerst","zuerst","At first; before anything else happens or is said."),
V("noun","das Heimweh","Heimweh","Homesickness; you feel sad because you miss your home.",True),
V("adjective","fremd","fremd","Strange and new; you do not know it well yet."),
V("adjective","einsam","einsam","Lonely; sad because you are alone and have no one close."),
V("noun","das Gefühl","Gefühl","A feeling; what you feel inside, like fear or joy.",True),
V("adjective","schrecklich","schrecklich","Terrible; very bad and very hard to live with."),

V("verb","glauben","glaube","To believe or think that something is true."),
V("verb","kennen","kenne","To know; to have felt or seen something before."),
V("adjective","leicht","leicht","Easy; not hard, you can do it without problems."),
V("verb","erinnern","erinnert","To remind; to make you think of a thing from before."),
V("adjective","erstaunt","erstaunt","Surprised; you did not expect it and you look up."),
V("adverb","woher","Woher","From where; you ask it to know where someone comes from."),
V("verb","lächeln","lächelt","To smile; to make a happy face with your mouth."),
V("adverb","früher","Früher","Before; in the past, at an earlier time in your life."),]
out[2]["vocab"]=[
V("verb","zögern","zögert","To hesitate; to wait because you are not sure what to do."),
V("noun","der Gedanke","Gedanke","A thought; an idea or picture in your head."),
V("adjective","genug","Genug","Enough; as much as you need, so no more is necessary."),
V("adjective","mutig","mutig","Brave; you do something hard even if you are afraid."),
V("adverb","wenigstens","wenigstens","At least; not a lot, but this one small thing."),
V("adverb","manchmal","manchmal","Sometimes; not always, but at some times or on some days."),
V("adjective","gemein","gemein","Mean; not kind, it hurts other people's feelings."),
V("verb","vergessen","vergessen","To forget; to not remember something you should remember."),
V("adverb","tief","tief","Deeply; very well and for a long time, without waking up."),
V("adverb","danach","Danach","After that; later, when the first thing is over."),
V("noun","die Stille","Stille","Silence; a moment with no sound at all.",True),
V("adjective","offen","offen","Open; not closed, so air can come in."),
V("adjective","feucht","feucht","Damp; a little wet, like the air after rain."),
V("verb","klingeln","klingelt","To ring; a phone makes a sound when someone calls."),
V("verb","spüren","spürt","To feel something in your body, like your heart beating."),
V("adjective","ängstlich","ängstlich","Anxious; a little afraid and not sure what will happen."),
V("verb","fehlen","fehlst","To miss; you say someone is missing from your life."),
V("adverb","bald","bald","Soon; in a short time, not much later."),
V("noun","die Idiotin","Idiotin","A silly woman; friends can say it in a warm, joking way."),
V("noun","die Brust","Brust","The chest; the front part of your body above the stomach.",True),]
syn=["For three days Julia's best friend back home has not answered, and Julia is in a bad mood. At work her first patient has back pain, and she works much too hard. Miriam, the head of the practice, sees the problem at once and sends Julia to the break room.",
"In the warm break room Miriam brings tea and waits. Julia cries and says the truth: she is homesick and often lonely in the evenings. Miriam listens and understands her very well. At the end Julia learns that Miriam also came to Frankfurt from another city many years ago.",
"In the evening Julia wants to be brave and honest. She sends Moritz a voice message about her homesickness and asks him to keep it secret. Then she writes to her best friend and says sorry. Later her phone rings, and the two friends laugh and cry together."]
for o,sy in zip(out,syn): o["synopsis"]=sy
json.dump(out,open("scripts/_deA1Friends/t6-data.json","w"),ensure_ascii=False,indent=1)
