# -*- coding: utf-8 -*-
P = {}

P["ein-freier-platz-am-tisch"] = dict(
arcType="daily-encounter",
synopsis="Sofie wohnt seit zwei Wochen in München und kennt dort keinen einzigen Menschen. Im vollen Biergarten fragt sie am Nachbartisch nach einem freien Stuhl und bekommt sehr viel mehr als nur einen Sitzplatz. Max und seine Freunde rücken einfach zusammen, als wäre das die normalste Sache der Welt, und genau das ist für Sofie neu.",
text="""Es ist ein warmer Sommerabend in München. Über den Tischen im Biergarten stehen alte Kastanien und werfen Schatten. Sofie ist neu in der Stadt und sucht einen Sitzplatz.

Sofie: Entschuldigung, ist der Stuhl hier noch frei?
Max: Klar, setz dich zu uns. Drinnen ist heute sowieso kein Platz.
Sofie: Danke. Am Nachbartisch war schon alles voll.
Max: Auf der Sitzbank ist immer Platz. Hier sitzt man zusammen.

Der Kellner stellt zwei Bier hin. Die Gruppe lacht und redet weiter.

Max: Ich heiße Max. Das sind Ben und Clara, alte Freunde.
Sofie: Ich bin Sofie, seit zwei Wochen in München.
Max: Zwei Wochen? Und schon allein im Biergarten? Mutig.
Sofie: Allein oder einsam. Zu Hause sitzen ist nicht besser.

Max legt ihr eine Brezel hin und lacht freundlich.

Max: Dann iss eine Brezel. Hier braucht man kein großes Wort.
Sofie: Das ist nett. In der neuen Stadt ist alles noch so fremd.
Max: Kenne ich. Ich war auch mal neu hier.
Sofie: Ich hoffe. Heute fühlt sich München schon wärmer an.""",
vocab=[
 ("noun","Sommerabend",None,"A summer evening, warm enough to sit outside until late."),
 ("noun","Biergarten",None,"A garden with long tables where people drink beer under trees."),
 ("noun","Kastanie","Kastanien","A chestnut tree, the big shady tree above Bavarian beer gardens."),
 ("noun","Schatten",None,"Shade; the cooler dark place under a tree or a roof."),
 ("noun","Stadt",None,"A city or town, the place where many people live and work."),
 ("noun","Stuhl",None,"A chair; the seat with a back for one person at a table."),
 ("adverb","drinnen",None,"Inside; in the closed part of a building, not out in the open."),
 ("noun","Nachbartisch",None,"The table next to yours, close enough to speak to the people there."),
 ("noun","Sitzbank",None,"A bench; a long wooden seat that several people share."),
 ("noun","Sitzplatz",None,"A seat; a free place where one person can sit down."),
 ("noun","Bier",None,"Beer; the cold drink that gives the Bavarian beer garden its name."),
 ("noun","Brezel",None,"A pretzel; a salty knot of bread eaten in southern Germany."),
 ("adverb","zusammen",None,"Together; with other people and not each one on their own."),
 ("verb","heißen","heiße","To be called; to have a certain name that people use for you."),
 ("noun","Gruppe",None,"A group; several people who belong together and do things together."),
 ("adjective","einsam",None,"Lonely; alone in a way that feels sad and not chosen."),
 ("adverb","freundlich",None,"In a kind, friendly way that makes other people feel welcome."),
 ("adjective","fremd",None,"Strange and unknown to you, because you are new in the place."),
 ("verb","hoffen","hoffe","To hope; to wish that something good will really happen."),
 ("noun","Wort",None,"A word; here the idea that no big speech is needed."),
])

P["der-stammtisch-am-donnerstag"] = dict(
arcType="reframe-turn",
synopsis="Max holt Sofie zum Stammtisch, doch an der Tür bleibt sie stehen: eine feste Gruppe, ein festes Wort auf dem Schild, und sie mittendrin als Zaungast. Clara erzählt ihr, wie sie selbst vor zwei Jahren an derselben Tür stand. Der Tisch, versteht Sofie am Ende, ist nicht trotz der Neuen da, sondern genau für sie.",
text="""Auf dem Holztisch im Wirtshaus steht ein kleines Schild mit dem Wort Stammtisch. Es ist Donnerstagabend, und die Gruppe sitzt schon zusammen. Sofie bleibt an der Tür stehen und zögert.

Max: Sofie, komm her! Wir haben einen Stuhl frei gehalten.
Sofie: Ich will wirklich nicht stören. Ihr kennt euch lange.
Max: Genau deshalb bist du eingeladen.

Auf dem Tisch stehen Kartoffelsuppe, Wurst und Salat. Daneben liegt ein altes Kartenspiel. Sofie setzt sich langsam.

Sofie: In der Firma kenne ich Kollegen, sonst niemanden in der Umgebung.
Clara: Du denkst sicher, wir sind nur höflich. Das dachte ich auch.
Sofie: Ein bisschen. Ihr seid eine feste Gruppe, ich bin neu.
Clara: Vor zwei Jahren stand ich genauso an dieser Tür.

Clara schiebt ihr den Teller mit dem Salat hin.

Clara: Der Donnerstag ist eine alte Gewohnheit. Jede Gewohnheit fing einmal an.
Max: Ben kam aus Hamburg, Clara aus Leipzig, ohne Beruf und ohne Leute.
Sofie: Dann ist dieses Gespräch kein Zufall.
Max: Nein. So fängt eine Freundschaft eben an.""",
vocab=[
 ("noun","Holztisch",None,"A wooden table, the heavy kind you find in an old inn."),
 ("noun","Wirtshaus",None,"A traditional German pub where people eat, drink and meet."),
 ("noun","Schild",None,"A small sign with writing on it that tells you something."),
 ("noun","Donnerstag","Donnerstagabend","Thursday; here the fixed evening when the same group always meets."),
 ("verb","zögern","zögert","To hesitate; to wait a moment because you are not sure."),
 ("noun","Kartoffelsuppe",None,"Potato soup, a simple warm dish served in German pubs."),
 ("noun","Wurst",None,"Sausage; a common German food made of meat in a thin skin."),
 ("noun","Salat",None,"Salad; cold raw vegetables eaten as a side dish or a meal."),
 ("noun","Kartenspiel",None,"A card game, or the pack of cards that people play with."),
 ("noun","Firma",None,"A company; the business where a person goes to work."),
 ("noun","Kollege","Kollegen","A colleague; a person who works in the same company as you."),
 ("noun","Umgebung",None,"The area around a place, the streets and houses close to you."),
 ("adjective","neu",None,"New; only here for a short time and still without friends."),
 ("adverb","wirklich",None,"Really; used to say that you truly mean what you say."),
 ("noun","Gewohnheit",None,"A habit; something people do again and again without thinking."),
 ("noun","Beruf",None,"A job or profession, the work a person is trained to do."),
 ("noun","Leute",None,"People; here the persons you know in a town."),
 ("noun","Gespräch",None,"A conversation; two or more people talking with each other."),
 ("noun","Freundschaft",None,"Friendship; the warm bond between people who like each other."),
 ("noun","Gruppe",None,"A group; the same people who always meet together."),
])

P["eine-welle-im-eisbach"] = dict(
arcType="mini-cliffhanger",
synopsis="Auf der Wiese im Englischen Garten wartet Sofie eine halbe Stunde umsonst, bis ein Anruf sie zum Stadtfluss schickt. Dort steht eine Menschenmenge auf der Ufermauer, und mitten in München surft jemand auf einer echten Welle. Dann dreht Ben ein Stück Pappe zu ihr um, und darauf steht mit Kreide ein einziges Wort.",
text="""Sofie wartet im Englischen Garten auf der Wiese. Es ist Samstagnachmittag, und nach zwanzig Minuten ist keiner da. Dann kommt ein Anruf auf ihr Handy.

Sofie: Max, wo seid ihr? Ich stehe schon eine Weile.
Max: Tut mir leid! Komm zum Eisbach, du verpasst etwas.
Sofie: Was macht ihr denn unten am Stadtfluss?
Max: Das musst du selbst sehen. Lauf los, du findest uns sofort.

Sofie läuft in ihren Sportschuhen den Fußweg entlang. Bald hört sie eine Menschenmenge rufen.

Clara: Sofie, hier oben auf der Ufermauer!
Sofie: So viele Leute. Was ist hier los?
Clara: Schau ins Wasser. Mitten in der Stadt ist eine echte Welle.
Sofie: Mitten in der Stadt surft jemand? Der ist ja ganz nass.
Ben: Jeden Tag fährt hier wer. Die Welle ist für dich.

Ben legt sein Handtuch weg und dreht ein Stück Pappe um.

Sofie: Da stehen Buchstaben mit Kreide drauf. Ich lese sie.
Ben: Lies ruhig laut. Es ist nur ein Wort.
Sofie: Da steht mein Name. Warum steht mein Name hier?""",
vocab=[
 ("noun","Wiese",None,"A meadow; a big open field of grass in a park or the country."),
 ("noun","Nachmittag","Samstagnachmittag","The afternoon, the hours between lunch and the early evening."),
 ("noun","Weile",None,"A while; a period of time that feels quite long while you wait."),
 ("noun","Anruf",None,"A phone call; when somebody rings you on the telephone."),
 ("noun","Handy",None,"A mobile phone; the small phone that people carry with them."),
 ("noun","Stadtfluss",None,"A river that runs right through the middle of a city."),
 ("verb","laufen","läuft","To run or to walk fast, moving quickly on your own feet."),
 ("noun","Fußweg",None,"A footpath; the narrow way through a park made for walking."),
 ("noun","Sportschuh","Sportschuhen","A trainer; the soft light shoe you wear for sport or walking."),
 ("noun","Menschenmenge",None,"A crowd; a lot of people standing close together in one place."),
 ("verb","rufen",None,"To call out loudly so that other people can hear you."),
 ("noun","Ufermauer",None,"The stone wall along a river, where people stand and watch."),
 ("adjective","echt","echte","Real; not a copy and not a trick, but the true thing."),
 ("adjective","nass",None,"Wet; covered with water, the way you are after a swim."),
 ("noun","Handtuch",None,"A towel; the cloth you use to dry your body after water."),
 ("noun","Buchstabe","Buchstaben","A letter of the alphabet, one of the signs that build a word."),
 ("noun","Kreide",None,"Chalk; the soft white stick you write on a board or wall with."),
 ("verb","lesen","lese","To read; to look at written words and understand them."),
 ("noun","Leute",None,"People; a lot of persons together in the same place."),
 ("noun","Wort",None,"A word; here a single written word that explains everything."),
])
