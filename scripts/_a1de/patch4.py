# -*- coding: utf-8 -*-
P = {}

P["verspatung-am-gleis-vier"] = dict(
arcType="late-reveal",
synopsis="Greta und ihr Bruder Bernd stehen pünktlich am Kölner Gleis vier, um zur Feier ihrer Nichte zu fahren. Auf der Tafel wächst die Verspätung Minute um Minute, der Anschluss ist längst verloren, und ein Taxi quer durch die Stadt kann sich keiner von beiden leisten. Bernd sagt lange nichts, geht zur Rolltreppe und nennt erst im letzten Moment den Weg, an den Greta nicht gedacht hat.",
text="""Die Zahlen auf der Tafel am Kölner Hauptbahnhof springen. Greta, eine Ärztin aus Köln, wartet am Gleis vier. Ihr Bruder Bernd hält das Gepäck. Die Nichte, eine Kollegin von Greta, feiert heute Geburtstag.

Greta: Aus zehn Minuten sind dreißig geworden.
Bernd: Unser Anschluss wartet nicht auf uns.
Greta: Der Fahrplan stimmt nicht. So fängt die Reise gut an.

Eine Stimme aus dem Lautsprecher sagt etwas, niemand versteht sie richtig.

Bernd: Ich habe nur das Wort Verspätung verstanden.
Greta: Ich habe nichts verstanden. Alle nehmen ihr Gepäck hoch.

Greta hält die Fahrkarte und schaut unruhig auf die Uhr.

Greta: Halb zwei. Die Feier der Nichte fängt um drei an.
Bernd: Mit dem Zug schaffen wir das nicht.
Greta: Ein Taxi quer durch Köln? Viel zu teuer.
Bernd: Und meine Geduld ist zu Ende.

Bernd geht nervös zur Rolltreppe.

Bernd: Komm mit. Das Ziel bleibt, der Weg ändert sich.
Greta: Was heißt das? Keine Sekunde übrig.
Bernd: Die Straßenbahn fährt in vier Minuten, ganz ohne Gleis.""",
vocab=[
 ("noun","Tafel",None,"A big board at a station that shows the times of the trains."),
 ("noun","Verspätung",None,"A delay; the train or bus comes later than the time on the plan."),
 ("noun","Anschluss",None,"A connection; the next train you must catch after this one."),
 ("noun","Fahrplan",None,"The timetable that says when each train leaves and arrives."),
 ("noun","Fahrkarte",None,"A ticket; the paper that lets you travel on a train or bus."),
 ("noun","Gepäck",None,"Luggage; all the bags and cases you take with you on a journey."),
 ("noun","Nichte",None,"A niece; the daughter of your brother or of your sister."),
 ("noun","Feier",None,"A party; the gathering the two of them are travelling to."),
 ("noun","Lautsprecher",None,"A loudspeaker; the box that says announcements out loud at a station."),
 ("noun","Stimme",None,"A voice; the sound a person makes when they speak or sing."),
 ("adverb","richtig",None,"Properly or correctly, in the way that a thing should be."),
 ("adverb","unruhig",None,"Restlessly; in a nervous way, unable to stand or wait calmly."),
 ("adverb","nervös",None,"Nervously; in a worried way because something may go wrong."),
 ("noun","Geduld",None,"Patience; the calm you need when you have to wait a long time."),
 ("noun","Wort",None,"A word; the only one they could catch from the loudspeaker."),
 ("noun","Ziel",None,"A goal, or the place you want to reach at the end."),
 ("noun","Reise",None,"A journey; going from one place to another, often far away."),
 ("noun","Taxi",None,"A car with a driver that takes you somewhere for money."),
 ("noun","Straßenbahn",None,"A tram; the city train that needs no railway platform."),
 ("adjective","halb","Halb","Half; here half past one, thirty minutes after the full hour."),
])

P["mit-der-stra-enbahn-durch-koln"] = dict(
arcType="juxtaposition-discovery",
synopsis="Statt auf den verspäteten Zug zu warten, fahren Greta und Bernd mit der Straßenbahn quer durch Köln. Bernd zählt die Ampeln und ärgert sich über jede Kreuzung, an der sie wieder hält. Draußen schiebt sich derweil die halbe Stadt am Fenster vorbei, und die beiden Dinge, die nichts miteinander zu tun haben, stoßen zusammen: die verlorene Zeit und der Blick, den man aus keinem Zug hat.",
text="""Ihre Straßenbahn wartet an der Haltestelle, und Greta und Bernd steigen mit dem Gepäck ein. Zwei Plätze am Fenster sind frei. Die Bahn rollt los, mitten durch die Stadt.

Bernd: Mit der Straßenbahn dauert die Reise ewig.
Greta: Der Zug stand still, Bernd. Diese Bahn fährt wenigstens.
Bernd: Und an jeder Kreuzung hält sie an der Ampel.
Greta: Dann schau aus dem Fenster, statt auf die Uhr.

Vor einem Zebrastreifen wartet die Bahn. Über den Dächern der Häuser steht der Dom, und das Wasser glänzt in der Sonne.

Bernd: Der Dom. So habe ich ihn lange nicht gesehen.
Greta: Im Zug säßen wir jetzt im dunklen Tunnel.
Bernd: Da ist die Kirche, dahinter das Rathaus.
Greta: Eben. Wir kommen zehn Minuten später, na und?

Bernd lehnt sich zurück. An der nächsten Station müssen sie umsteigen.

Bernd: Komisch. Vorhin war die Verspätung das Ende der Welt.
Greta: Und jetzt ist sie eine kleine Rundfahrt durch Köln.
Bernd: Stimmt. Auf die zehn Minuten kommt es nicht mehr an.""",
vocab=[
 ("noun","Haltestelle",None,"A stop; the place in the street where a tram or bus waits."),
 ("noun","Straßenbahn",None,"A tram; the train on rails that runs through city streets."),
 ("verb","umsteigen",None,"To change; to get off one tram or train and take another."),
 ("noun","Station",None,"A stop or station on the line of a tram, bus or train."),
 ("noun","Kreuzung",None,"A crossing; the place where two streets meet and cross."),
 ("noun","Ampel",None,"A traffic light with red, yellow and green for cars and trams."),
 ("verb","stimmen","Stimmt","To be right; you say it when you agree with the other person."),
 ("noun","Stadt",None,"A city; here Cologne, seen from a slow tram window."),
 ("noun","Häuser",None,"Houses; more than one building where people live."),
 ("noun","Fenster",None,"A window; the glass opening you look through from inside."),
 ("noun","Rathaus",None,"The town hall, the old building where a city is governed."),
 ("noun","Dom",None,"A cathedral; the huge old church that gives Cologne its skyline."),
 ("verb","glänzen","glänzt","To shine; to give back light like water or clean metal."),
 ("verb","lehnen","lehnt","To lean; to rest your back or side against something."),
 ("verb","rollen","rollt","To roll; to move forward smoothly on wheels."),
 ("adverb","ewig",None,"Forever; used to say that something takes far too long."),
 ("adverb","wenigstens",None,"At least; used to name the one good side of a bad thing."),
 ("noun","Verspätung",None,"A delay; the same one that made them miss their train."),
 ("noun","Gepäck",None,"Luggage; the bags they are still carrying with them."),
 ("noun","Reise",None,"A journey; the trip across the city they did not plan."),
])

P["punktlich-ist-anders"] = dict(
arcType="harmonic-close",
synopsis="Außer Atem und mit dem Gepäck in der Hand entschuldigen sich Greta und Bernd bei ihrer Nichte für die Verspätung. Im Haus ist es aber ganz ruhig, die Torte steht unangeschnitten da, und fast alle Stühle sind leer. Die Nichte erzählt, wo die anderen Gäste gerade sitzen, und die beiden Geschwister merken, dass sich ihre ganze Eile in etwas ziemlich Komisches verwandelt hat.",
text="""Eine Viertelstunde zu spät stehen Greta und Bernd vor dem Haus der Nichte und atmen durch. Dann klingeln sie.

Greta: Es tut uns leid, wir sind zu spät.
Nichte: Zu spät? Kommt erst einmal herein.
Bernd: Wir haben uns beeilt. Erst der Zug, dann die Straßenbahn.
Nichte: Setzt euch und trinkt etwas. Alles halb so wild.

Auf dem Tisch stehen eine Torte mit Sahne, eine Kaffeekanne und ein paar Blumen. Greta schaut erstaunt auf die leeren Stühle.

Greta: Wo sind die anderen? Wir dachten, wir sind die Letzten.
Nichte: Das ist eine lustige Geschichte. Ruf mal Onkel Theo an.
Bernd: Onkel Theo? Ist er noch nicht da?
Nichte: Er sitzt im selben Zug, den ihr nicht genommen habt.

Greta und Bernd schauen sich an und lächeln. Die Eile war umsonst.

Bernd: Dann sind wir heute die Ersten, mit unserer Verspätung.
Nichte: Manchmal kommt man früher an, wenn man nicht wartet.
Greta: Zum Geburtstag schneide ich jetzt den Kuchen an.""",
vocab=[
 ("verb","atmen",None,"To breathe; to take air into your body and let it out."),
 ("verb","beeilen","beeilt","To hurry; to do something faster because time is short."),
 ("verb","trinken","trinkt","To drink; to take water, coffee or juice into your mouth."),
 ("noun","Kuchen",None,"A cake; the sweet one served with coffee to guests."),
 ("noun","Torte",None,"A cake; the round sweet cake with cream that Germans serve to guests."),
 ("noun","Stuhl","Stühle","A chair; the seats standing empty around the table."),
 ("noun","Straßenbahn",None,"A tram; the slow way that got them there first."),
 ("noun","Blume","Blumen","A flower; the coloured plant people bring to a party as a gift."),
 ("adjective","leer","leeren","Empty; with nobody sitting there and nothing standing on it."),
 ("adjective","erstaunt",None,"Astonished; very surprised because you did not expect this at all."),
 ("adjective","lustig",None,"Funny; it makes people laugh when they hear about it."),
 ("noun","Geschichte",None,"A story; something that happened and is worth telling to others."),
 ("noun","Onkel",None,"An uncle; the brother of your mother or of your father."),
 ("adjective","selbe","selben","The same; exactly the one we spoke about before, not another."),
 ("noun","Verspätung",None,"A delay; the train arrives later than the timetable promised."),
 ("noun","Eile",None,"Hurry; the rushed feeling you have when there is too little time."),
 ("adverb","umsonst",None,"For nothing; you did the work but it brought no result."),
 ("adverb","manchmal",None,"Sometimes; on some days but not on all of them."),
 ("noun","Nichte",None,"A niece; the daughter of your brother or of your sister."),
 ("noun","Geburtstag",None,"A birthday; the yearly day when a person was born."),
])
