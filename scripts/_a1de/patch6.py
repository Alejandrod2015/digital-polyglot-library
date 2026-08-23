# -*- coding: utf-8 -*-
P = {}

P["der-pfad-in-den-wald"] = dict(
arcType="daily-encounter",
synopsis="An einem frischen Morgen im Schwarzwald schnüren Mia und Finn ihre Schuhe und gehen los. Kein Abenteuer, kein Ziel außer dem Tal von oben: nur ein schmaler Weg, eine Wurzel quer im Gras, ein Schmetterling auf einem Blatt und eine Ziege am Zaun. Die Wanderung selbst ist die ganze Geschichte, und beiden reicht das vollkommen.",
text="""Vor der Waldhütte schnürt Mia ihre Schuhe. Es ist ein frischer Morgen im Schwarzwald. Finn füllt zwei Flaschen und packt sie in den Rucksack.

Mia: Hast du genug Wasser? Der Wanderweg nach oben ist lang.
Finn: Alles drin. Wasser, Brot, zwei Äpfel.
Mia: Hörst du, wie ruhig es hier ist?
Finn: Nur die Vögel und der Wind in den Bäumen.

Die beiden folgen dem schmalen Pfad. Über eine dicke Wurzel wächst Gras, und die Erde riecht nach Holz.

Finn: Pass auf, hier liegt ein Ast quer über dem Weg.
Mia: Danke. Schau mal, ein Schmetterling auf dem Blatt da.
Finn: Und da vorne steht eine Ziege am Zaun.
Mia: Ein Hund bellt auch irgendwo. Wir sind also nicht allein.

Nach einer Weile machen sie an einem Baum eine kurze Pause. Eine Biene summt über dem Gras.

Mia: Von hier oben sieht man schon das ganze Tal.
Finn: Und kein Mensch außer uns. Genau dafür sind wir hier.
Mia: Der Rest geht bergauf. Aber wir haben den ganzen Tag.""",
vocab=[
 ("verb","schnüren","schnürt","To lace up; to tie the strings of a shoe or a boot."),
 ("noun","Waldhütte",None,"A wooden cabin at the edge of a forest, used by walkers."),
 ("noun","Flasche","Flaschen","A bottle; the plastic or glass one you carry water in."),
 ("noun","Rucksack",None,"A backpack; the bag you carry on your back when walking."),
 ("noun","Wanderweg",None,"A marked walking path through woods or hills, made for hikers."),
 ("noun","Brot",None,"Bread; the basic food made from flour that Germans eat daily."),
 ("noun","Vogel","Vögel","A bird; the small animal with wings that sings in the trees."),
 ("noun","Baum","Bäumen","A tree; the tall plant with a wooden trunk and green leaves."),
 ("noun","Wurzel",None,"A root; the part of a tree that grows under the ground."),
 ("noun","Gras",None,"Grass; the low green plant that covers meadows and paths."),
 ("noun","Erde",None,"The earth or soil, the brown ground under your feet."),
 ("noun","Ast",None,"A branch; the arm of a tree that grows out of the trunk."),
 ("noun","Blatt",None,"A leaf; the flat green part that grows on a branch."),
 ("noun","Schmetterling",None,"A butterfly; the insect with big coloured wings in summer."),
 ("noun","Ziege",None,"A goat; the small farm animal with horns that eats almost anything."),
 ("noun","Hund",None,"A dog; the animal that many families keep at home as a pet."),
 ("noun","Pause",None,"A break; a short rest in the middle of a walk or of work."),
 ("noun","Biene",None,"A bee; the small flying insect that makes honey and can sting."),
 ("noun","Tal",None,"A valley; the low land that lies between two hills or mountains."),
 ("adverb","bergauf",None,"Uphill; going up the side of a hill, which is hard work."),
])

P["nebel-uber-dem-berg"] = dict(
arcType="late-reveal",
synopsis="Oben auf dem Berg schlägt das Wetter in Minuten um, und eine dichte Nebelwand schiebt sich zwischen die Tannen. An einer Gabelung wissen Mia und Finn nicht mehr, aus welcher Richtung sie gekommen sind, und im Weiß sieht jeder Weg gleich aus. Dann hören sie Wasser rauschen, und die Karte in Mias Hand sagt plötzlich alles.",
text="""Oben auf dem Berg wird die Luft kühl. Mia und Finn merken, wie eine dichte Nebelwand zwischen die Tannen zieht. Innerhalb weniger Minuten ist alles um sie herum weiß.

Mia: Finn, wo bist du? Ich sehe dich kaum noch.
Finn: Direkt hinter dir. Ich komme langsam zu dir herüber.
Mia: Der Nebel kam schnell. Eben war der Himmel klar.
Finn: Im Gebirge geht das schnell. Kommt jetzt noch Regen?

An einer Stelle teilt sich der Weg. Finn stellt seinen Wanderstock in den Boden.

Finn: Hier geht es links und rechts weiter. Welcher Weg war unserer?
Mia: Ich bin nicht mehr sicher. Im Nebel sieht alles gleich aus.
Finn: Warte, hörst du das? Da unten rauscht Wasser.
Mia: Ein Bach. Auf der Landkarte ist nur auf einer Seite ein Bach.

Mia zieht die Karte heraus. Ihre Stiefel stehen im nassen Gras, und in der Stille hört man nur das Wasser.

Mia: Die blaue Linie läuft rechts vom Weg. Der Bach ist rechts.
Finn: Dann sind wir richtig und gehen nach unten.""",
vocab=[
 ("verb","merken",None,"To notice; to see or feel that something is happening."),
 ("adjective","dicht","dichte","Thick or dense, so that you cannot see or walk through it."),
 ("noun","Nebelwand",None,"Thick fog that stands in front of you like a solid wall."),
 ("adverb","innerhalb",None,"Within; used to say how short a time something needed."),
 ("adverb","kaum",None,"Hardly; almost not at all, only a very little bit."),
 ("adjective","klar",None,"Clear; with nothing in the way, so you can see far."),
 ("noun","Gebirge",None,"A mountain range; a large group of mountains together."),
 ("noun","Regen",None,"Rain; the water that falls from the clouds down to the ground."),
 ("noun","Stelle",None,"A spot; one certain place on a path or on a map."),
 ("adverb","links",None,"On the left; the side opposite to your right hand."),
 ("adverb","rechts",None,"On the right; the side opposite to your left hand."),
 ("noun","Wanderstock",None,"A walking stick that hikers push into the ground for balance."),
 ("adjective","sicher",None,"Sure; you know something and have no doubt about it."),
 ("verb","rauschen","rauscht","To rush; the soft loud sound that moving water or wind makes."),
 ("noun","Bach",None,"A stream; a small narrow river that runs down a hill."),
 ("noun","Landkarte",None,"A map; the paper that shows paths, rivers and hills of an area."),
 ("noun","Seite",None,"A side; the left or the right part of a path or a page."),
 ("noun","Stiefel",None,"Boots; the strong high shoes people wear for walking outside."),
 ("noun","Stille",None,"Silence; the state when there is no sound at all around you."),
 ("noun","Linie",None,"A line; the thin mark on a map that shows a river."),
])

P["ein-schild-im-nebel"] = dict(
arcType="reframe-turn",
synopsis="Dem Rauschen des Baches folgen Mia und Finn vorsichtig bergab, mit müden Knien und nassen Stiefeln. Aus dem Grau taucht ein alter Pfahl auf, und darauf sitzt ein Holzschild mit einem Pfeil. Was für Mia die ganze Zeit eine verlorene Wanderung war, sieht sie im Abendlicht am Waldrand auf einmal ganz anders.",
text="""Vorsichtig folgen Mia und Finn dem Bach bergab. Mit jedem Schritt wird der Boden feuchter, und das Wasser wird lauter. Ihre Knie zittern vom langen Abstieg.

Finn: Der Bach wird lauter. Wir gehen also richtig.
Mia: Warte, da vorne steht doch etwas im Nebel.
Finn: Wo? Ich sehe nur Grau zwischen den Bäumen.
Mia: Da, ein Pfahl. Komm näher, ich glaube, das ist ein Schild.

Am Wegrand steht ein altes Holzschild mit einem Pfeil.

Finn: Es zeigt genau dorthin, wo wir hinwollen.
Mia: Zur Hütte, nur noch zwanzig Minuten.
Finn: Und schau, der Nebel wird dünner. Da kommt die Sonne.
Mia: Endlich. Eben war alles grau, jetzt sehe ich wieder die Tannen.

Im Abendlicht gehen die beiden den letzten Waldweg hinunter. Vor ihnen liegt der Waldrand und das Tal.

Mia: Müde Beine, aber wir sind heil zurück.
Finn: Und morgen erzählen wir allen von unserem Rückweg im Nebel.
Mia: Ein Bach war klüger als jede Karte.""",
vocab=[
 ("adverb","bergab",None,"Downhill; going down the side of a hill towards the valley."),
 ("adjective","feucht","feuchter","Damp; a little wet, the way ground is after fog or rain."),
 ("noun","Knie",None,"The knee; the joint in the middle of your leg that bends."),
 ("noun","Pfahl",None,"A post; a thick wooden stick standing upright in the ground."),
 ("adverb","näher",None,"Closer; a shorter distance away than you were before."),
 ("noun","Wegrand",None,"The edge of a path, the narrow strip right beside it."),
 ("noun","Holzschild",None,"A wooden sign that tells walkers where a path leads."),
 ("noun","Pfeil",None,"An arrow; the sign that points in the direction you should go."),
 ("adverb","dorthin",None,"To that place; in the direction of the place you can see."),
 ("noun","Sonne",None,"The sun; the bright light in the sky that warms the day."),
 ("noun","Abendlicht",None,"Evening light; the soft warm light of the last hour of day."),
 ("noun","Waldweg",None,"A forest track; a wide path for walking through the trees."),
 ("noun","Waldrand",None,"The edge of the forest, where the trees stop and open land begins."),
 ("noun","Tal",None,"A valley; the low land between the hills, seen from above."),
 ("adjective","müde","Müde","Tired; you have used your strength and now need to rest."),
 ("noun","Bein","Beine","A leg; the part of your body you walk and stand on."),
 ("adjective","heil",None,"Safe and sound; back home without any harm or injury."),
 ("noun","Rückweg",None,"The way back; the path that takes you home again."),
 ("adjective","letzt","letzten","Last; the final one, with nothing coming after it."),
 ("adjective","klug","klüger","Clever; good at finding the right answer or the right way."),
])
