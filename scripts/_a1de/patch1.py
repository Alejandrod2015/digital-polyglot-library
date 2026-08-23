# -*- coding: utf-8 -*-
P = {}

P["kabeljau-vom-fischmarkt"] = dict(
arcType="reframe-turn",
synopsis="Zwei Mitbewohner stehen im Morgengrauen zwischen den Kisten am Hamburger Fischmarkt. Jonas greift nach dem teuersten Fisch, weil teuer für ihn immer gut heißt. Lena hält ihm den billigen Kabeljau hin und lässt ihn selbst entscheiden. Was Jonas am Ende überzeugt, ist kein Preis, sondern eine Nase voll Meer.",
text="""Es riecht nach Salz und Meer auf dem Fischmarkt von Hamburg. Um fünf Uhr morgens steht Lena schon zwischen den Kisten. Ihr Mitbewohner Jonas hält müde einen Becher.

Jonas: So früh, Lena. Ich habe noch nicht einmal Hunger.
Lena: Sonntag ist Markttag. Später ist der frische Fisch weg.
Jonas: Na gut. Dann nehmen wir den großen Lachs. Der ist teuer, aber bestimmt gut.
Lena: Der kostet viel. Brauchen wir das heute wirklich?

Vor einem Verkäufer liegt Kabeljau auf dem Eis.

Verkäufer: Kabeljau aus der Nordsee! Drei Stück, ein guter Preis!
Jonas: Kabeljau? Den kenne ich gar nicht.
Lena: Er ist viel billiger als der Lachs. Schau dir die Augen an, ganz klar.

Jonas hält ein Stück Kabeljau unter die Nase.

Jonas: Du hast recht. Der riecht nach Meer, nicht nach Fisch.
Lena: Siehst du? Frisch ist besser als teuer.
Jonas: Einverstanden. Zum Mittagessen gibt es Kabeljau mit Zitrone.
Lena: Und morgen eine Suppe aus dem Rest. Abgemacht?
Jonas: Abgemacht. Aber den Tee danach zahlst du.""",
vocab=[
 ("adverb","morgens",None,"In the morning, in the first early hours of the day."),
 ("noun","Kiste","Kisten","A big wooden or plastic box used to carry or store things."),
 ("noun","Mitbewohner",None,"A person who shares the same flat with you and pays rent too."),
 ("adjective","müde",None,"Tired; you need sleep or rest and cannot think well."),
 ("noun","Becher",None,"A cup without a handle, for tea, coffee or a hot drink."),
 ("noun","Markttag","Markttag","The day of the week when the open street market is working."),
 ("adjective","frisch","frische","Fresh; made or caught a very short time ago, not old."),
 ("adjective","teuer",None,"Expensive; it costs a lot of money, more than you want to pay."),
 ("verb","kosten","kostet","To cost; to have a price that the buyer has to pay."),
 ("noun","Verkäufer",None,"A man who sells things at a shop, a stand or a market."),
 ("noun","Kabeljau",None,"Cod; a white sea fish that people in north Germany often eat."),
 ("noun","Eis",None,"Ice; frozen water, here used to keep the fish cold and fresh."),
 ("noun","Preis",None,"The amount of money you must pay to buy something in a shop."),
 ("adjective","billig","billiger","Cheap; it costs little money, less than other things of the same kind."),
 ("noun","Auge","Augen","The eye; here the fish eyes show the buyer how fresh it is."),
 ("expression","einverstanden",None,"Agreed; you say this when you accept what the other person suggests."),
 ("noun","Mittagessen",None,"Lunch; the meal that people eat in the middle of the day."),
 ("noun","Zitrone",None,"Lemon; a yellow sour fruit whose juice people put on fish."),
 ("noun","Suppe",None,"Soup; a hot liquid meal that you eat with a spoon from a bowl."),
 ("expression","abgemacht",None,"It is a deal; you say this when both people accept a plan."),
])

P["sonntags-ist-alles-zu"] = dict(
arcType="mini-cliffhanger",
synopsis="Der Fisch liegt schon in der Pfanne, als den beiden Mitbewohnern das Wichtigste fehlt. In Deutschland ist am Sonntag jeder Laden zu, und die nächste Tankstelle liegt zwanzig Minuten weg. Jonas will aufgeben und ohne essen. Lena zieht sich die Schuhe an, ohne zu sagen, wohin sie läuft.",
text="""Am späten Vormittag schneidet Lena in der Küche eine Zwiebel. Der Kabeljau liegt in der Pfanne, und die Wohnung riecht warm nach Essen.

Lena: Jonas, wo ist die Zitrone? Salz und Pfeffer habe ich.
Jonas: Die Zitrone? Ich denke, die hast du gekauft.
Lena: Nein, das warst du. Wir haben beide keine gekauft.
Jonas: Kein Problem, ich hole schnell eine im Geschäft.

Lena dreht das Feuer kleiner.

Lena: Jonas, heute ist Sonntag. In Deutschland hat sonntags alles zu.
Jonas: Stimmt. Der Supermarkt, der Bäcker, der Laden an der Ecke.
Lena: Ohne Zitrone schmeckt der Kabeljau nur halb so gut.
Jonas: Die Tankstelle hat immer offen, auch sonntags.
Lena: Die ist zwanzig Minuten weg. Der Fisch braucht fünf.

Jonas deckt den Tisch und legt zwei Teller hin.

Jonas: Dann essen wir ihn eben ohne. So schlimm ist das nicht.
Lena: Warte mal, ich habe eine Idee. Kannst du kurz auf den Fisch aufpassen?
Jonas: Was für eine Idee denn?

Aber Lena steht schon an der Wohnungstür und zieht ihre Schuhe an.""",
vocab=[
 ("noun","Vormittag",None,"The late morning, the hours between breakfast and lunch time."),
 ("noun","Küche",None,"The room in a home where people cook and prepare their meals."),
 ("noun","Zwiebel",None,"Onion; a round white vegetable with a strong smell and taste."),
 ("noun","Pfanne",None,"A flat metal pan that you use to fry meat, fish or eggs."),
 ("adjective","warm",None,"Warm; a little hot, in a way that feels good and friendly."),
 ("noun","Pfeffer",None,"Pepper; the dark spice that people put on food with salt."),
 ("noun","Geschäft",None,"A shop; a place in town where you go to buy things."),
 ("noun","Feuer",None,"Fire; here the flame of the cooker under the frying pan."),
 ("noun","Sonntag","Sonntag","Sunday; in Germany the day when almost every shop stays closed."),
 ("noun","Supermarkt",None,"A big self service shop that sells food and things for the home."),
 ("noun","Bäcker",None,"A baker, or the small shop where you buy fresh bread and rolls."),
 ("verb","schmecken","schmeckt","To taste; to have a certain taste in the mouth of the eater."),
 ("noun","Tankstelle",None,"A petrol station, which in Germany also sells food late and on Sunday."),
 ("adjective","offen",None,"Open; a shop is open when customers may go inside and buy."),
 ("verb","decken","deckt","To set the table, putting plates and forks in place before a meal."),
 ("noun","Teller",None,"A plate; the flat round dish from which one person eats."),
 ("noun","Idee",None,"An idea; a new thought about how to solve a small problem."),
 ("verb","aufpassen",None,"To watch over something for a short time so nothing goes wrong."),
 ("noun","Wohnungstür",None,"The front door of a flat, between the flat and the stairs."),
 ("noun","Schuhe",None,"Shoes; what you put on your feet before you go outside."),
])

P["eine-zitrone-von-nebenan"] = dict(
arcType="harmonic-close",
synopsis="Lenas Idee wohnt im Haus gegenüber und heißt Pia. Aus einer geliehenen Zitrone werden ein paar Zweige Minze, aus den Kräutern wird eine Einladung, und aus zwei Mitbewohnern werden drei Leute an einem viel zu kleinen Tisch. Am Ende steht kein Rezept auf dem Papier, sondern eine Verabredung für den nächsten Sonntag, diesmal mit vertauschten Rollen.",
text="""Im Haus gegenüber drückt Lena die Klingel. Eine junge Frau öffnet, in der Hand eine Tasse. Es ist Pia, die Lena erst zweimal gesehen hat.

Lena: Hallo, Pia. Entschuldige die Störung am Sonntag. Hast du vielleicht eine Zitrone?
Pia: Warte kurz, ich schaue nach. Sonntags fehlt mir auch immer etwas.
Lena: Wir kochen Fisch, und alle Läden haben zu.
Pia: Das kenne ich gut. Mir geht das oft genauso.

Pia kommt mit einer Zitrone und etwas Minze zurück.

Pia: Hier. Nimm die Kräuter dazu, die passen gut zu Fisch.
Lena: Das ist nett. Komm mit, die Mahlzeit reicht für drei.
Pia: Gern. Ich freue mich und bringe eine Flasche Limonade mit.

Kurz darauf sitzen drei Leute am Tisch. Jonas legt einen dritten Teller, einen Löffel und eine Serviette dazu.

Jonas: Mit Zitrone schmeckt der Fisch fantastisch. Lena hatte recht.
Pia: Und zu dritt essen ist schöner als jeder für sich.
Lena: Nächsten Sonntag kochst du, und wir bringen den Fisch mit.
Pia: Gut. Aber kommt bitte früher vom Markt zurück.""",
vocab=[
 ("adverb","gegenüber",None,"On the other side of the street, right across from where you are."),
 ("noun","Klingel",None,"The bell at a front door that you press to call the people inside."),
 ("noun","Frau",None,"A woman; an adult female person, here a young neighbour."),
 ("noun","Tasse",None,"A cup with a handle, used for coffee or for hot tea."),
 ("noun","Störung",None,"A disturbance; when you take somebody's quiet time away for a moment."),
 ("adverb","vielleicht",None,"Maybe; you are not sure whether something is true or possible."),
 ("verb","fehlen","fehlt","To be missing; the thing you need is not there right now."),
 ("noun","Minze",None,"Mint; a green plant with a fresh smell that people cook with."),
 ("noun","Kräuter",None,"Herbs; small green plants that give food a stronger, better taste."),
 ("verb","passen",None,"To go well together; two things fit each other nicely."),
 ("adjective","nett",None,"Nice and friendly, in a way that makes other people feel good."),
 ("noun","Mahlzeit",None,"A meal; the food that people sit down and eat together."),
 ("noun","Flasche",None,"A bottle; the tall glass or plastic thing you pour a drink from."),
 ("noun","Limonade",None,"A sweet cold drink with bubbles, often made from lemon or orange."),
 ("noun","Leute",None,"People; a small group of persons, here the three at the table."),
 ("adjective","dritte","dritten","Third; the one that comes after the first and the second."),
 ("noun","Löffel",None,"A spoon; you eat soup with it and stir sugar into coffee."),
 ("noun","Serviette",None,"A napkin; the small cloth or paper you clean your mouth with."),
 ("verb","freuen","freue","To be glad about something; to feel happy that it is happening."),
 ("adjective","nächste","Nächsten","Next; the one that comes directly after this day or week."),
])
