# -*- coding: utf-8 -*-
P = {}

P["verspatung-am-gleis-vier"] = dict(
arcType="late-reveal",
synopsis="Greta und ihr Bruder Bernd stehen pünktlich am Kölner Gleis vier, um zur Feier ihrer Nichte zu fahren. Auf der Tafel wächst die Verspätung Minute um Minute, der Anschluss ist längst verloren, und ein Taxi quer durch die Stadt kann sich keiner von beiden leisten. Bernd sagt lange nichts, geht zur Rolltreppe und nennt erst im letzten Moment den Weg, an den Greta nicht gedacht hat.",
text="""Auf der Tafel am Kölner Hauptbahnhof springen die Zahlen. Greta und Bernd warten am Gleis vier. Heute feiert ihre Nichte, und beide haben Gepäck dabei.

Greta: Aus zehn Minuten sind dreißig geworden.
Bernd: Unser Anschluss wartet nicht auf uns.
Greta: Der Fahrplan stimmt nicht. Die Reise fängt ja gut an.

Eine Stimme aus dem Lautsprecher sagt etwas, niemand versteht sie richtig.

Bernd: Ich habe nur das Wort Verspätung verstanden.
Greta: Ich auch nicht. Alle nehmen ihr Gepäck hoch.
Bernd: Dann fährt der Zug so schnell nicht.

Greta hält die Fahrkarte fest und schaut unruhig auf die Uhr.

Greta: Halb zwei, und die Feier fängt um drei an.
Bernd: Mit dem Zug schaffen wir das nicht.
Greta: Ein Taxi quer durch Köln? Viel zu teuer.
Bernd: Und ich habe keine Geduld mehr.

Bernd geht nervös zur Rolltreppe und dreht sich um.

Bernd: Komm mit. Das Ziel bleibt, nur der Weg ändert sich.
Greta: Was heißt das? Keine Sekunde ist übrig.
Bernd: Die Straßenbahn. Sie fährt in vier Minuten, ganz ohne Gleis.""",
vocab=[
 ("noun","Tafel",None,"A big board at a station that shows the times of the trains."),
 ("noun","Verspätung",None,"A delay; the train or bus comes later than the time on the plan."),
 ("noun","Anschluss",None,"A connection; the next train you must catch after this one."),
 ("noun","Fahrplan",None,"The timetable that says when each train leaves and arrives."),
 ("noun","Fahrkarte",None,"A ticket; the paper that lets you travel on a train or bus."),
 ("noun","Gepäck",None,"Luggage; all the bags and cases you take with you on a journey."),
 ("noun","Nichte",None,"A niece; the daughter of your brother or of your sister."),
 ("verb","feiern","feiert","To celebrate; to have a party for a special day or event."),
 ("noun","Lautsprecher",None,"A loudspeaker; the box that says announcements out loud at a station."),
 ("noun","Stimme",None,"A voice; the sound a person makes when they speak or sing."),
 ("adverb","richtig",None,"Properly or correctly, in the way that a thing should be."),
 ("adverb","unruhig",None,"Restlessly; in a nervous way, unable to stand or wait calmly."),
 ("adverb","nervös",None,"Nervously; in a worried way because something may go wrong."),
 ("noun","Geduld",None,"Patience; the calm you need when you have to wait a long time."),
 ("noun","Sekunde",None,"A second; the very short unit of time, sixty of them make a minute."),
 ("noun","Ziel",None,"A goal, or the place you want to reach at the end."),
 ("noun","Reise",None,"A journey; going from one place to another, often far away."),
 ("noun","Taxi",None,"A car with a driver that takes you somewhere for money."),
 ("noun","Rolltreppe",None,"An escalator; the moving stairs that carry people up or down."),
 ("adjective","halb","Halb","Half; here half past one, thirty minutes after the full hour."),
])

P["mit-der-stra-enbahn-durch-koln"] = dict(
arcType="juxtaposition-discovery",
synopsis="Statt auf den verspäteten Zug zu warten, fahren Greta und Bernd mit der Straßenbahn quer durch Köln. Bernd zählt die Ampeln und ärgert sich über jede Kreuzung, an der sie wieder hält. Draußen schiebt sich derweil die halbe Stadt am Fenster vorbei, und die beiden Dinge, die nichts miteinander zu tun haben, stoßen zusammen: die verlorene Zeit und der Blick, den man aus keinem Zug hat.",
text="""An der Haltestelle steigen Greta und Bernd in die Straßenbahn. Zwei Plätze am Fenster sind frei. Die Bahn rollt los, mitten durch die Stadt.

Bernd: Mit der Straßenbahn dauert das ewig.
Greta: Der Zug stand still, Bernd. Diese Bahn fährt wenigstens.
Bernd: An jeder Kreuzung hält sie an der Ampel.
Greta: Dann schau aus dem Fenster, statt auf die Uhr.

Vor einem Zebrastreifen wartet die Bahn. Über den Dächern der Häuser steht der Dom, und das Wasser glänzt in der Sonne.

Bernd: Der Dom. So habe ich ihn lange nicht gesehen.
Greta: Im Zug säßen wir jetzt im dunklen Tunnel.
Bernd: Da ist die Kirche, dahinter das Rathaus.
Greta: Eben. Wir kommen zehn Minuten später, na und?

Bernd lehnt sich zurück und schaut auf sein Ticket. An der nächsten Station müssen sie umsteigen.

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
 ("noun","Zebrastreifen",None,"A crossing of white stripes where people may walk over the street."),
 ("noun","Dach","Dächern","A roof; the top of a house that keeps the rain outside."),
 ("noun","Häuser",None,"Houses; more than one building where people live."),
 ("noun","Kirche",None,"A church; the building where Christians meet to pray and sing."),
 ("noun","Rathaus",None,"The town hall, the old building where a city is governed."),
 ("noun","Dom",None,"A cathedral; the huge old church that gives Cologne its skyline."),
 ("verb","glänzen","glänzt","To shine; to give back light like water or clean metal."),
 ("verb","lehnen","lehnt","To lean; to rest your back or side against something."),
 ("verb","rollen","rollt","To roll; to move forward smoothly on wheels."),
 ("adverb","ewig",None,"Forever; used to say that something takes far too long."),
 ("adverb","wenigstens",None,"At least; used to name the one good side of a bad thing."),
 ("adverb","vorhin","Vorhin","A short time ago; earlier today, only a few minutes back."),
 ("noun","Ticket",None,"A ticket; the small card or paper that pays for your ride."),
 ("noun","Sonne",None,"The sun; the bright light in the sky that warms the day."),
])

P["punktlich-ist-anders"] = dict(
arcType="harmonic-close",
synopsis="Außer Atem und mit dem Gepäck in der Hand entschuldigen sich Greta und Bernd bei ihrer Nichte für die Verspätung. Im Haus ist es aber ganz ruhig, die Torte steht unangeschnitten da, und fast alle Stühle sind leer. Die Nichte erzählt, wo die anderen Gäste gerade sitzen, und die beiden Geschwister merken, dass sich ihre ganze Eile in etwas ziemlich Komisches verwandelt hat.",
text="""Vor dem Haus der Nichte bleiben Greta und Bernd stehen und atmen durch. Es ist Viertel nach drei. Dann klingeln sie.

Greta: Es tut uns leid, wir sind zu spät.
Nichte: Zu spät? Kommt erst einmal herein.
Bernd: Wir haben uns beeilt. Erst der Zug, dann die Straßenbahn.
Nichte: Setzt euch und trinkt etwas. Alles halb so wild.

Auf dem Tisch stehen eine Torte mit Sahne, eine Kaffeekanne und ein paar Blumen. Greta schaut erstaunt auf die vielen leeren Stühle.

Greta: Wo sind die anderen? Wir dachten, wir sind die Letzten.
Nichte: Das ist eine lustige Geschichte. Ruf mal Onkel Theo an.
Bernd: Onkel Theo? Ist er nicht da?
Nichte: Er sitzt mit seinem Enkel im selben Zug, den ihr nicht genommen habt.

Greta und Bernd schauen sich an und müssen beide lächeln. Die ganze Eile war umsonst.

Bernd: Dann sind wir heute die Ersten, mit unserer Verspätung.
Nichte: Manchmal kommt man früher an, wenn man nicht wartet.
Greta: Und zum Geburtstag schneide ich dir jetzt den ersten Kuchen an.""",
vocab=[
 ("verb","atmen",None,"To breathe; to take air into your body and let it out."),
 ("verb","beeilen","beeilt","To hurry; to do something faster because time is short."),
 ("verb","trinken","trinkt","To drink; to take water, coffee or juice into your mouth."),
 ("adjective","wild",None,"Wild; here in the phrase that says a problem is not serious."),
 ("noun","Torte",None,"A cake; the round sweet cake with cream that Germans serve to guests."),
 ("noun","Sahne",None,"Cream; the thick white topping that people put on cake and coffee."),
 ("noun","Kaffeekanne",None,"A coffee pot; the tall jug you pour coffee from at the table."),
 ("noun","Blume","Blumen","A flower; the coloured plant people bring to a party as a gift."),
 ("adjective","leer","leeren","Empty; with nobody sitting there and nothing standing on it."),
 ("adjective","erstaunt",None,"Astonished; very surprised because you did not expect this at all."),
 ("adjective","lustig",None,"Funny; it makes people laugh when they hear about it."),
 ("noun","Geschichte",None,"A story; something that happened and is worth telling to others."),
 ("noun","Onkel",None,"An uncle; the brother of your mother or of your father."),
 ("adjective","selbe","selben","The same; exactly the one we spoke about before, not another."),
 ("noun","Enkel",None,"A grandson; the son of your own son or of your daughter."),
 ("noun","Eile",None,"Hurry; the rushed feeling you have when there is too little time."),
 ("adverb","umsonst",None,"For nothing; you did the work but it brought no result."),
 ("adverb","manchmal",None,"Sometimes; on some days but not on all of them."),
 ("adverb","früher",None,"Earlier; before the time you had planned or expected."),
 ("noun","Geburtstag",None,"A birthday; the yearly day when a person was born."),
])
