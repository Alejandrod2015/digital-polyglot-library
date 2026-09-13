import json
T="clothes-and-style"
def V(t,w,s,d,a=False):
    o={"type":t,"word":w,"surface":s,"definition":d}
    if a: o["anchor"]=True
    return o
s0=["Überall auf dem Flohmarkt am Museumsufer hängen Blusen und Röcke, und es riecht nach altem Stoff. Julia, die Physiotherapeutin aus Rostock, sucht ein Kleid, denn Svenja heiratet in drei Wochen. Ihre Sachen sind noch in Rostock.",
"Theresa ist Schneiderin und verkauft alte Kleider an einem kleinen Stand.",
"Julia findet ein dunkelblaues Kleid aus weichem Stoff. Es ist wunderschön, aber viel zu weit. “Wie viel kostet es?”, fragt Julia.",
"“Vierzig Euro. Und ich nähe es enger, dann passt es genau”, antwortet Theresa. “Ich habe bloß fünfundzwanzig Euro dabei”, sagt Julia. Traurig hängt sie das Kleid zurück.",
"Theresa schaut auf Julias alte Jeansjacke. Sie ist ein bisschen schmutzig und voll mit bunten Knöpfen. “Die Jacke ist toll. Wollen wir tauschen? Deine Jacke gegen das Kleid”, schlägt Theresa vor.",
"Julia hält die Jacke fest. Ihre beste Freundin hat sie ihr vor zehn Jahren geschenkt. “Ich brauche das Kleid wirklich, aber ich muss erst nachdenken”, sagt Julia leise."]
s1=["Zwei Tage später steht Julia wieder am Stand. In der Nacht hat sie kaum geschlafen und war lange wach. Jetzt ist sie sicher.",
"“Ich tausche”, sagt Julia. Ihre Stimme ist fest, aber ihre Augen sind nass. Die Jacke ist weich und warm. Theresa nimmt sie vorsichtig und legt sie über ihren Stuhl. “Danke. Ich passe gut auf sie auf”, antwortet sie.",
"Hinter dem Stand hängt ein dünner Vorhang. Dort darf Julia das Kleid anziehen, und Theresa steckt Nadeln in den Stoff. “Bitte ganz still stehen, ja?”, sagt sie.",
"Dann ist Theresa fertig. Julia dreht sich vor dem Spiegel. Das Kleid passt jetzt, und sie fühlt sich plötzlich groß. “Du siehst toll aus. Und deine Jacke bekommt bei mir einen guten Platz”, verspricht Theresa.",
"Am Abend schreibt Julia ihrer besten Freundin: “Ich habe deine Jacke getauscht, gegen ein Kleid für eine Hochzeit hier.” Die Antwort kommt spät, und sie ist sehr kurz: “Okay.”"]
s2=["Der Tag ist sonnig und warm, und Julias neues Kleid ist dunkelblau. Auf einem Schiff feiern fünfzig Gäste Svenjas Hochzeit. Theresa ist auch da, denn sie hat Svenjas Kleid genäht.",
"Moritz trägt einen Anzug und eine schiefe Krawatte. “Ein Rotwein für dich. Prost!”, sagt er. Dann schaukelt das Schiff wild im starken Wind, und der Wein landet auf Julias Kleid.",
"“Oh nein, das tut mir so leid!”, ruft Moritz. Julia starrt auf den roten Fleck. “Das Kleid, die Jacke, und jetzt das”, flüstert sie.",
"Theresa kommt sofort mit kaltem Wasser. “Keine Angst, das ist kein Problem. Ich nähe dir eine Blume darüber”, sagt sie. Aus ihrer Handtasche holt sie Nadel, Faden und ein Stück Stoff.",
"Zehn Minuten später hat das Kleid eine kleine blaue Blume. “Du hast das schönste Kleid auf dem Schiff”, lacht Svenja fröhlich. Julia ist glücklich. Sie tanzt den ganzen Abend mit Moritz, und die Blume hält. “Danke, Theresa!”, ruft Julia."]
out=[{"topic":T,"slotIndex":i,"title":ti,"arcType":ar,"synopsis":"","text":"\n\n".join(tx),"vocab":[]} for i,(ti,tx,ar) in enumerate([("Nichts zum Anziehen",s0,"reframe-turn"),("Die Jacke aus Rostock",s1,"recurring-character-callback"),("Ein Fleck auf dem Schiff",s2,"harmonic-close")])]
out[0]["vocab"]=[
V("noun","der Flohmarkt","Flohmarkt","A flea market; people sell old things there at small tables.",True),
V("noun","das Kleid","Kleid","A dress; a piece of clothing for women that covers body and legs.",True),
V("noun","die Schneiderin","Schneiderin","A woman whose job is making and changing clothes.",True),
V("verb","verkaufen","verkauft","To sell; to give something to a person for money."),
V("adverb","überall","Überall","Everywhere; in every place you look around you."),
V("verb","finden","findet","To find; to see something you were looking for."),
V("adjective","dunkelblau","dunkelblaues","Dark blue; a deep blue colour like the sky at night."),
V("verb","kosten","kostet","To cost; to have a price that you must pay."),
V("verb","hängen","hängt","To hang something up, for example a dress on a rail."),
V("noun","die Jeansjacke","Jeansjacke","A jacket made of blue denim, the cloth of jeans.",True),
V("adjective","schmutzig","schmutzig","Dirty; not clean, with marks or dust on it."),
V("adjective","voll","voll","Full; with a lot of things on it or in it."),
V("verb","schenken","geschenkt","To give something as a present, for free."),
V("adjective","fest","fest","Tight; strongly, so that it does not move or fall."),
V("adjective","alt","altem","Old; not new, used by other people for many years."),
V("adverb","viel","viel","Much; a lot, a big amount of something."),
V("verb","nachdenken","nachdenken","To think carefully about something before you decide."),
V("verb","wollen","Wollen","To want; here, to ask if the other person wants to do it."),
V("adverb","noch","noch","Still; it is like that now, as it was before."),
V("adjective","beste","beste","Best; the closest and most important friend of all."),]
out[1]["vocab"]=[
V("adverb","wieder","wieder","Again; one more time, like it was before."),
V("verb","schlafen","geschlafen","To sleep; to rest at night with your eyes closed."),
V("adjective","wach","wach","Awake; not sleeping, with your eyes still open."),
V("adjective","sicher","sicher","Sure; you know what you want and have no doubt."),

V("verb","tauschen","tausche","To swap; to give one thing and get another thing back."),
V("verb","nehmen","nimmt","To take; to get something into your hands."),
V("adjective","vorsichtig","vorsichtig","Careful; slowly and gently, so nothing breaks or gets hurt."),
V("adjective","dünn","dünner","Thin; not thick, you can almost see through it."),
V("noun","der Vorhang","Vorhang","A curtain; a long piece of cloth that hides a small space.",True),
V("verb","dürfen","darf","To be allowed; someone says it is okay to do it."),
V("adjective","spät","spät","Late; after the normal time, or later than you hoped."),
V("adverb","sehr","sehr","Very; much more than just a little bit."),
V("adjective","still","still","Still; without moving at all, quiet and calm."),
V("adjective","fertig","fertig","Finished; ready, with nothing more left to do."),
V("verb","drehen","dreht","To turn; to move your body round in a circle."),
V("adjective","toll","toll","Great; really good and very nice to see."),
V("verb","fühlen","fühlt","To feel; to have a feeling about yourself or your body."),
V("verb","versprechen","verspricht","To promise; to say that you will surely do something."),
V("adverb","hier","hier","Here; in this place, where you are now."),
V("adverb","jetzt","jetzt","Now; at this moment, not before and not later."),]
out[2]["vocab"]=[
V("adjective","neu","neues","New; you have not had it for a long time."),
V("noun","die Gäste","Gäste","Guests; people who come to a party or a wedding."),
V("verb","feiern","feiern","To celebrate; to have a party for a happy event."),
V("noun","die Hochzeit","Hochzeit","A wedding; the day two people get married with friends and family.",True),
V("verb","nähen","genäht","To sew; to make or fix clothes with a needle and thread."),
V("noun","der Anzug","Anzug","A suit; a jacket and trousers of the same cloth for men.",True),
V("noun","die Krawatte","Krawatte","A tie; a long piece of cloth men wear around the neck.",True),
V("noun","der Rotwein","Rotwein","Red wine; a dark red drink for adults, made from grapes.",True),
V("adjective","wild","wild","Wild; strong and without control, moving a lot."),
V("adjective","stark","starken","Strong; with a lot of power or force."),
V("verb","landen","landet","To land; to fall and end up on a place."),
V("adjective","rot","roten","Red; the colour of blood or of red wine."),
V("verb","holen","holt","To get; to take something out and bring it."),
V("adjective","kalt","kaltem","Cold; with a low temperature, not warm at all."),
V("noun","der Stoff","Stoff","Cloth; the material that clothes are made of."),
V("adverb","darüber","darüber","Over it; on top of something, so it covers it."),
V("adjective","blau","blaue","Blue; the colour of the sky on a sunny day."),
V("adjective","fröhlich","fröhlich","Cheerful; happy, smiling and full of good mood."),
V("adjective","glücklich","glücklich","Happy; very pleased and in a good mood."),
V("verb","tanzen","tanzt","To dance; to move your body to music."),]
syn=["Julia needs a dress for Svenja's wedding, but her nice clothes are still in boxes in Rostock. At the flea market by the river she meets Theresa, a dressmaker. Julia finds a beautiful blue dress, but she does not have enough money. Theresa wants to swap the dress for Julia's old denim jacket.",
"Two days later Julia goes back to the flea market. The denim jacket is a present from her best friend back home, but she swaps it for the dress. Theresa makes the dress fit, and Julia feels good in it. In the evening her best friend answers her message with only one short word.",
"At the wedding on a boat on the river, Moritz brings Julia a glass of red wine. The boat moves in the wind, and the wine lands on her new dress. Theresa is also a guest, and she has an idea. Julia dances all evening with Moritz in her dress with a small blue flower."]
for o,sy in zip(out,syn): o["synopsis"]=sy
json.dump(out,open("scripts/_deA1Friends/t4-data.json","w"),ensure_ascii=False,indent=1)
