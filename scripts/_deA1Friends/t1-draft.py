import json
T="chats-and-phone-calls"
def V(t,w,s,d): return {"type":t,"word":w,"surface":s,"definition":d}
s0=["Julia, eine Physiotherapeutin aus Rostock, sitzt am Abend auf der Treppe in Frankfurt. Moritz ist Straßenbahnfahrer und wohnt gegenüber, aber Julia kennt ihn nicht. Sie nimmt eine Sprachnachricht für ihre Freundinnen auf. “Hallo, ihr Lieben! Frankfurt ist wunderschön, und ich habe schon viele Leute kennengelernt”, sagt sie.",
"Das ist nicht die Wahrheit. Sie kennt hier noch niemanden. Die Nachricht ist weg, und bloß zwei Haken stehen darunter. Unten knarrt die Haustür. Es ist kalt, und keine Freundin antwortet.",
"Da geht die Nachbarwohnung auf. Moritz trägt einen dunkelgrünen Kapuzenpullover. “Die Wände hier sind ziemlich dünn”, meint Moritz. “Ich habe alles gehört, auch die vielen Leute.”",
"Julia wird rot. Die Lüge ist ihr peinlich. Sie hält das Smartphone fest und versteckt es in der Jacke.",
"“Ich kenne hier wirklich niemanden”, gibt Julia zu. Moritz lacht nicht. “Natürlich nicht, du bist ja neu. Jetzt kennst du mich, Moritz von gegenüber”, antwortet er und trägt seinen Mülleimer nach unten."]
v0=[V("noun","die Physiotherapeutin","Physiotherapeutin","A woman whose job is helping people move well again after pain."),
V("noun","die Sprachnachricht","Sprachnachricht","A voice message that you record and send on your phone."),
V("adjective","wunderschön","wunderschön","Very beautiful; really lovely to look at or to be in."),
V("verb","kennenlernen","kennengelernt","To meet a person for the first time and start to know them."),
V("noun","die Wahrheit","Wahrheit","The truth; what is really true, not a story you make up."),
V("adverb","weg","weg","Gone; it has left and it is not here any more."),
V("adverb","bloß","bloß","Only; just that and nothing more than that."),
V("verb","knarren","knarrt","To creak; an old door or floor makes a long, low noise."),
V("noun","die Nachbarwohnung","Nachbarwohnung","The flat next to yours or across the hall from yours."),
V("noun","der Straßenbahnfahrer","Straßenbahnfahrer","A man whose job is driving a tram through the city streets."),
V("adjective","dunkelgrün","dunkelgrünen","Dark green; a deep green colour like the leaves of a tree."),
V("noun","der Kapuzenpullover","Kapuzenpullover","A hoodie; a warm, soft top with a hood for your head."),
V("adverb","ziemlich","ziemlich","Quite; more than a little, but not very much."),
V("noun","die Lüge","Lüge","A lie; something you say that you know is not true."),
V("adjective","peinlich","peinlich","Embarrassing; it makes you feel awkward in front of other people."),
V("verb","halten","hält","To hold something in your hand and not let it go."),
V("verb","verstecken","versteckt","To hide something so that other people cannot see it."),
V("adverb","wirklich","wirklich","Really; you say it when something is truly the case."),
V("adverb","natürlich","Natürlich","Of course; you say it when something is clear and normal."),
V("noun","der Mülleimer","Mülleimer","A rubbish bin; you put old food and paper in it."),]
s1=["Am Samstagmorgen klopft Moritz an Julias Tür. Er gibt ihr einen Zettel mit seiner Handynummer. “Ich treffe heute Abend Freunde. Schreib mir, dann hole ich dich ab”, sagt er. “Super, mein erstes Wochenende hier!”, lacht Julia und speichert die Nummer.",
"Am Abend beginnt der Videoanruf mit Rostock. Fünf Freundinnen reden auf einmal, der Laptop rauscht, und das Bild wackelt ständig. Julia stellt ihr Handy auf stumm. Nach zwanzig Minuten gehen zwei. “Wir telefonieren nächste Woche wieder, ja?”, ruft eine.",
"Kurz vor Mitternacht sieht Julia zwei Nachrichten. Moritz hat sie vorhin geschrieben. Die erste kommt um acht: “Wir sitzen draußen, der Abend ist herrlich. Kommst du?” Die zweite kommt um neun: “Pech. Vielleicht nächstes Mal.”",
"Im Zimmer ist es kalt, und Julia ist unglücklich. Der Abend in Frankfurt ist vorbei, und die anderen sitzen wahrscheinlich zusammen. Sie drückt das Handy an die Wange. “Tut mir leid, ich habe es verpasst”, schreibt sie. Moritz antwortet nicht mehr."]
v1=[V("noun","der Samstagmorgen","Samstagmorgen","The morning of a Saturday, before lunch time at the weekend."),
V("noun","die Handynummer","Handynummer","The number you call or text to reach someone's mobile phone."),
V("verb","treffen","treffe","To meet people you know at a place and spend time together."),
V("verb","speichern","speichert","To save a number or a file on your phone or computer."),
V("noun","das Wochenende","Wochenende","The weekend; Saturday and Sunday, when many people do not work."),
V("noun","der Videoanruf","Videoanruf","A video call; you talk and see the other people on a screen."),
V("verb","reden","reden","To talk; to speak with other people about something."),
V("verb","rauschen","rauscht","To make a soft, steady noise like wind or a bad speaker."),
V("verb","wackeln","wackelt","To wobble; to move a little from side to side."),
V("adjective","stumm","stumm","Silent; the phone makes no sound when a message comes."),
V("noun","die Mitternacht","Mitternacht","Midnight; twelve o'clock at night, when one day ends."),
V("adverb","vorhin","vorhin","A short time ago; earlier today, not long before now."),
V("adverb","draußen","draußen","Outside; out in the open air and not inside a building."),
V("adjective","herrlich","herrlich","Wonderful; really lovely and very nice to enjoy."),
V("noun","das Pech","Pech","Bad luck; when something does not work out the way you want."),
V("adjective","unglücklich","unglücklich","Unhappy; sad and not pleased about what has happened."),
V("adverb","vorbei","vorbei","Over; the time for it has already ended."),
V("adverb","wahrscheinlich","wahrscheinlich","Probably; you think it is very likely, but you do not know."),
V("noun","die Wange","Wange","The cheek; the soft side of your face under the eye."),
V("verb","verpassen","verpasst","To miss something, like a message, a train or a party."),]
s2=["Am Sonntagmorgen sitzt Julia im Schlafanzug mit einer Kaffeetasse an der Fensterbank. Die Sonne ist schon warm. Sie schreibt eine Antwort an Moritz, löscht sie und schreibt nochmal.",
"“Das ist doch lächerlich”, murmelt Julia und versucht es anders. Sie holt tief Luft und wählt seine Nummer. Erst ist besetzt, dann kommt die Mailbox.",
"“Hallo Moritz, hier ist Julia. Mein Handy war gestern aus Versehen auf stumm. Schließlich bin ich neu hier und möchte Leute kennen”, spricht sie nach dem Ton.",
"Zehn Minuten später klingelt ihr Handy. Moritz ruft zurück, und im Hintergrund quietscht eine Straßenbahn voller Fahrgäste. “Wir laufen jeden Sonntag um neun am Main. Willst du nächsten Sonntag mitkommen?”, fragt er. “Gern. Das ist ein guter Plan”, antwortet Julia.",
"Am Abend kommt eine neue Sprachnachricht aus Rostock. Julia hört sie heute nicht an. Sie stellt ihre Laufschuhe schon an die Tür, eine ganze Woche zu früh."]
v2=[V("noun","die Antwort","Antwort","An answer; what you write or say back to someone."),
V("noun","der Schlafanzug","Schlafanzug","Pyjamas; the soft clothes that you wear in bed at night."),
V("noun","die Kaffeetasse","Kaffeetasse","A cup that you drink hot coffee from in the morning."),
V("noun","die Fensterbank","Fensterbank","A windowsill; the flat shelf at the bottom of a window."),
V("adverb","nochmal","nochmal","Again; one more time, after you have already done it once."),
V("adjective","lächerlich","lächerlich","Silly or ridiculous; it is so small that people could laugh."),
V("verb","versuchen","versucht","To try to do something, even if it is not easy."),
V("verb","wählen","wählt","To dial; to put in a phone number to call someone."),
V("adjective","besetzt","besetzt","Busy; the phone line is already in use by someone else."),
V("noun","die Mailbox","Mailbox","Voicemail; a place on the phone where people leave a spoken message."),
V("adverb","gestern","gestern","Yesterday; the day that came just before today."),
V("noun","das Versehen","Versehen","A mistake you make without wanting to, by accident."),
V("adverb","schließlich","Schließlich","After all; you say it to give the main reason for something."),
V("noun","der Hintergrund","Hintergrund","The background; sounds or things behind the main thing you notice."),
V("noun","der Fahrgast","Fahrgäste","A passenger; a person who rides on a bus or a tram."),
V("verb","mitkommen","mitkommen","To come along with someone when they go somewhere."),
V("noun","der Plan","Plan","A plan; something that you decide to do at a certain time."),
V("noun","die Laufschuhe","Laufschuhe","Light shoes that you wear when you go running or jogging."),
V("adverb","schon","schon","Already; earlier than you think, before the usual time."),
V("adverb","früh","früh","Early; at the start of the day, before most people are up."),]
syn=["Julia is new in Frankfurt. On the stairs she records a happy voice message for her friends back in Rostock and says she already knows many people. It is not true. Her neighbour Moritz opens his door, and he has heard every word through the thin walls of the building.",
"Moritz gives Julia his number and invites her to meet his friends that evening. The same evening she has a long video call with her friends in Rostock and puts her phone on silent. When she looks again, it is almost midnight and she has missed the whole evening.",
"The next morning Julia writes answers to Moritz and deletes them again. In the end she calls him and leaves a message. Moritz calls back from his tram with a plan for the next week, and that evening Julia does not listen to the new voice message from Rostock."]
arcs=["reframe-turn","late-reveal","harmonic-close"]
out=[{"topic":T,"slotIndex":i,"title":ti,"arcType":arcs[i],"synopsis":syn[i],"text":"\n\n".join(tx),"vocab":vv} for i,(ti,tx,vv) in enumerate([("Alles super in Frankfurt",s0,v0),("Ein Abend auf stumm",s1,v1),("Lieber einmal anrufen",s2,v2)])]
ANC={"Physiotherapeutin","Sprachnachricht","Nachbarwohnung","Straßenbahnfahrer","Kapuzenpullover","Mülleimer","Samstagmorgen","Handynummer","Videoanruf","Mitternacht","Wange","Wochenende","Sonntagmorgen","Schlafanzug","Kaffeetasse","Fensterbank","Morgensonne","Mailbox"}
for o in out:
    for v in o["vocab"]:
        if v["surface"] in ANC: v["anchor"]=True
json.dump(out,open("scripts/_deA1Friends/t1-data.json","w"),ensure_ascii=False,indent=1)
