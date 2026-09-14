import json
T="birthdays-and-surprises"
def V(t,w,s,d,a=False):
    o={"type":t,"word":w,"surface":s,"definition":d}
    if a: o["anchor"]=True
    return o
s0=["Ein leises Klopfen kommt am Dienstagabend an Julias Tür. Draußen ist es schon kalt. Moritz ist heute noch mit seiner Straßenbahn unterwegs. Sein Kollege Philipp steht vor Julias Tür und ist ziemlich nervös.",
"“Moritz wird am Samstag fünfunddreißig, aber er feiert nie”, erklärt Philipp leise. “Machen wir eine Überraschungsparty? Hier bei dir, du wohnst ja gegenüber. Er merkt bestimmt nichts.”",
"“Ehrlich? Ja, sehr gern! Ich backe einen großen Kuchen”, antwortet Julia. Philipp gibt ihr eine Liste: Sekt, Apfelwein, Luftballons und Geschenkpapier.",
"Später schaut Julia in ihren Kalender. Am Samstag hat auch ihre beste Freundin Geburtstag, und um acht gibt es einen Videoanruf mit allen aus Rostock. Die Party für Moritz ist auch um acht.",
"“Oh nein, das auch noch”, murmelt Julia und beißt sich auf die Lippe. Sie schreibt nichts nach Rostock. “Beides ist unmöglich”, denkt sie. Der Samstag wird schwierig. Trotzdem backt sie am nächsten Tag."]
s1=["Ihr Wohnzimmer ist am Samstag voll mit Luftballons. Philipp hat Handkäse und grüne Soße mitgebracht, das Lieblingsessen von Moritz.",
"Um halb acht kommen die Gäste leise durch das Treppenhaus: Svenja, Florian und Theresa. “Pst! Er kommt um acht. Keiner sagt ein Wort”, flüstert Philipp und macht das Licht aus.",
"“Und wo sollen wir jetzt warten?”, will Svenja wissen. Alle sitzen heimlich im Dunkeln hinter dem Sofa.",
"Um fünf vor acht klopft es. Julia öffnet die Tür. Moritz steht barfuß und in Jogginghose im Flur. In der Wohnung ist es warm. “Hallo, Nachbarin. Hast du vielleicht Zucker? Ich backe mir heute selbst einen Kuchen”, sagt er ein wenig traurig.",
"“Nein, leider nicht”, lügt Julia. Hinter ihr kichert jemand. Moritz schaut sie komisch an. “Ist bei dir eigentlich alles in Ordnung?”, fragt er.",
"In diesem Moment klingelt ihr Handy in der Küche. Der Klingelton ist laut und lustig: Es ist der Videoanruf aus Rostock."]
s2=["Das Handy klingelt. Julia sieht das Gesicht ihrer besten Freundin auf dem kleinen Display. Sie will den Anruf nicht wegdrücken, aber sie muss.",
"“Wer ist denn da drinnen? Hast du Besuch?”, fragt Moritz. Julia macht die Tür ganz auf, und Philipp macht das Licht an. Alles ist hell. “Überraschung!”, rufen alle zusammen.",
"Moritz sagt lange nichts. Endlich lacht er herzlich, und seine Augen glänzen. “Meine letzte Party war vor zehn Jahren. Ihr seid echt verrückt”, erzählt er dankbar.",
"Sie essen gemeinsam grüne Soße und trinken Apfelwein. Dann singen alle ein Geburtstagslied.",
"Julia gibt Moritz eine Grußkarte mit einem Gutschein. “Für die Bäckerei, für deinen nächsten Kuchen”, sagt sie, und alle lachen.",
"Um Mitternacht sind die Gäste weg, nur Moritz hilft noch. Julia denkt an Rostock. “Morgen gibt es Ärger, das weiß ich”, sagt sie. “Ich hoffe, deine Freundin versteht es”, meint Moritz. “Aber es ist wahr: Heute gehöre ich nach Frankfurt”, antwortet sie."]
out=[{"topic":T,"slotIndex":i,"title":ti,"arcType":ar,"synopsis":"","text":"\n\n".join(tx),"vocab":[]} for i,(ti,tx,ar) in enumerate([("Philipps Geheimnis",s0,"late-reveal"),("Luftballons im Dunkeln",s1,"mini-cliffhanger"),("Überraschung um acht",s2,"reframe-turn")])]
out[0]["vocab"]=[
V("noun","der Dienstagabend","Dienstagabend","The evening of a Tuesday, after work on the second day of the week.",True),
V("adverb","heute","heute","Today; on this day, not yesterday and not tomorrow."),
V("adjective","nervös","nervös","Nervous; a little afraid and not calm about what will happen."),
V("noun","die Überraschungsparty","Überraschungsparty","A surprise party; friends plan it in secret for one person.",True),
V("verb","wohnen","wohnst","To live in a flat or a house at a certain place."),
V("verb","merken","merkt","To notice; to see or understand that something is going on."),
V("adverb","bestimmt","bestimmt","Surely; almost certainly, you are quite sure about it."),
V("adverb","ehrlich","Ehrlich","Really; you say it when you are surprised and want the truth."),
V("verb","backen","backe","To bake; to make a cake or bread in the oven."),
V("noun","der Sekt","Sekt","German sparkling wine; people often drink it at a party.",True),
V("noun","der Apfelwein","Apfelwein","Apple wine; a sour drink made from apples, famous in Frankfurt.",True),
V("noun","der Luftballon","Luftballons","A balloon; a coloured rubber bag full of air for parties."),
V("noun","das Geschenkpapier","Geschenkpapier","Wrapping paper; nice paper you put around a present.",True),
V("adverb","auch","auch","Also; too, in the same way as the other thing."),
V("verb","beißen","beißt","To bite; to press your teeth hard on something."),
V("noun","die Lippe","Lippe","A lip; one of the two soft edges of your mouth.",True),
V("adjective","unmöglich","unmöglich","Impossible; it cannot happen or cannot be done at all."),
V("adjective","schwierig","schwierig","Difficult; hard to do, with many problems on the way."),
V("adverb","trotzdem","Trotzdem","Still; even so, you do it although there is a problem."),
V("verb","murmeln","murmelt","To mumble; to say something very quietly, almost to yourself."),]
out[1]["vocab"]=[
V("noun","der Handkäse","Handkäse","A small, strong cheese from the Frankfurt area, often eaten with apple wine.",True),
V("adjective","grün","grüne","Green; the colour of grass and of many fresh herbs."),
V("noun","das Lieblingsessen","Lieblingsessen","Your favourite food; the dish you like best of all.",True),
V("adjective","halb","halb","Half; here, thirty minutes before the full hour."),
V("verb","sagen","sagt","To say; to speak words to someone who listens."),
V("verb","sollen","sollen","Should; here, to ask what you are supposed to do."),
V("verb","warten","warten","To wait; to stay in a place until something happens."),
V("adverb","heimlich","heimlich","Secretly; so that another person does not see or know it."),
V("adjective","dunkel","Dunkeln","Dark; with no light, so it is hard to see."),
V("adverb","selbst","selbst","Myself or himself; with no help from other people."),
V("adverb","wenig","wenig","A little; not much, only a small amount."),
V("verb","kichern","kichert","To giggle; to laugh quietly in a silly way."),
V("adjective","komisch","komisch","Strange or funny; a little odd, not normal."),
V("adverb","eigentlich","eigentlich","Actually or really; you use it to ask what is really true."),
V("noun","die Ordnung","Ordnung","Order; when everything is okay and nothing is wrong."),
V("noun","der Klingelton","Klingelton","A ringtone; the sound your phone makes when someone calls.",True),
V("adjective","lustig","lustig","Funny; it makes people laugh or smile a lot."),
V("adjective","barfuß","barfuß","Barefoot; with no shoes and no socks on your feet."),
V("noun","die Jogginghose","Jogginghose","Tracksuit bottoms; soft, loose trousers you wear at home or for sport.",True),
V("expression","hallo","Hallo","Hello; a friendly word to greet someone when you meet."),]
out[2]["vocab"]=[
V("verb","wegdrücken","wegdrücken","To reject a phone call by pressing the red button."),
V("adverb","drinnen","drinnen","Inside; in a room or a building, not outside."),
V("noun","das Display","Display","The screen of a phone, where you see pictures and names."),
V("adverb","endlich","Endlich","Finally; at last, after a long time of waiting."),
V("adverb","herzlich","herzlich","Warmly; in a very friendly way that comes from the heart."),
V("verb","glänzen","glänzen","To shine; here, the eyes look wet and bright."),
V("adjective","letzte","letzte","Last; the one before now, the most recent one."),
V("adjective","verrückt","verrückt","Crazy; a little mad, but here in a nice and happy way."),
V("adjective","dankbar","dankbar","Thankful; happy because someone did something good for you."),
V("adjective","hell","hell","Bright; full of light and not dark at all."),
V("adverb","echt","echt","Really; you use it to make a word stronger."),
V("verb","singen","singen","To sing; to make music with your voice."),
V("noun","das Geburtstagslied","Geburtstagslied","A birthday song; people sing it for a person on their birthday.",True),
V("noun","die Grußkarte","Grußkarte","A greeting card; a nice card with a short message for someone.",True),
V("verb","hoffen","hoffe","To hope; to want something to happen and think it can."),
V("noun","der Gutschein","Gutschein","A voucher; a paper you can use to get something for free.",True),
V("noun","die Bäckerei","Bäckerei","A bakery; a shop where people make and sell bread and cakes.",True),
V("adverb","morgen","morgen","Tomorrow; on the day that comes after today."),
V("adjective","klein","kleinen","Small; not big, taking only a little space."),
V("adjective","wahr","wahr","True; it is a fact and not a lie."),]
syn=["Philipp, a colleague of Moritz from the trams, knocks on Julia's door. Moritz never celebrates his birthday, so Philipp wants a surprise party in Julia's flat. Julia says yes at once. Later she sees that her best friend has a birthday on the same day, with a video call at the same time.",
"Julia's flat is full of balloons, apple wine and Moritz's favourite green sauce. The friends from the running group hide in the dark. Just before eight Moritz knocks and asks for sugar, and Julia has to lie. Then her phone starts to ring very loudly in the drawer.",
"Julia does not answer the call from her best friend, and the surprise works. Moritz is very moved: his last party was ten years ago. They eat, drink and sing, and Julia gives him a voucher for a bakery. Late at night she writes to her friend, but no answer comes."]
for o,sy in zip(out,syn): o["synopsis"]=sy
json.dump(out,open("scripts/_deA1Friends/t5-data.json","w"),ensure_ascii=False,indent=1)
