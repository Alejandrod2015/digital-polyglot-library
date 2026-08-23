# -*- coding: utf-8 -*-
P = {}

P["der-pfad-in-den-wald"] = dict(
arcType="daily-encounter",
synopsis="An einem frischen Morgen im Schwarzwald schnüren Mia und Finn ihre Schuhe und gehen los. Kein Abenteuer, kein Ziel außer dem Tal von oben: nur ein schmaler Weg, eine Wurzel quer im Gras, ein Schmetterling auf einem Blatt und eine Ziege am Zaun. Die Wanderung selbst ist die ganze Geschichte, und beiden reicht das vollkommen.",
text="""Ihre Schuhe schnürt Mia vor der Waldhütte im Schwarzwald. Mia ist eine Studentin aus Freiburg, und Finn, ein Freund aus dem Kurs, füllt die Flaschen für den Rucksack.

Mia: Hast du genug Wasser? Der Wanderweg ist lang.
Finn: Alles drin. Wasser, Brot und zwei Äpfel.
Mia: Hörst du, wie ruhig es hier ist?
Finn: Nur die Vögel und der Wind in den Bäumen.

Die beiden folgen dem Pfad. Die Erde riecht nach Holz.

Finn: Pass auf, hier liegt ein Ast über dem Weg. Richtig herum?
Mia: Danke. Schau, ein Schmetterling auf dem Blatt.
Finn: Vielleicht steht da vorne wieder die Ziege am Zaun.
Mia: Ein Hund bellt irgendwo. Wir sind also nicht allein.

Nach einer Weile machen sie am Baum Pause, bevor es hinunter ins Tal geht. Eine Biene summt über dem Gras.

Mia: Von hier sieht man schon das ganze Tal.
Finn: Kein Mensch außer uns. Genau dafür sind wir hier.
Mia: Stimmt, der Rest geht bergauf. Wir haben den ganzen Tag.""",
vocab=[
 ("verb","schnüren","schnürt","To lace up; to tie the strings of a shoe or a boot."),
 ("noun","Waldhütte",None,"A wooden cabin at the edge of a forest, used by walkers."),
 ("noun","Flasche","Flaschen","A bottle; the plastic or glass one you carry water in."),
 ("noun","Rucksack",None,"A backpack; the bag you carry on your back when walking."),
 ("noun","Wanderweg",None,"A marked walking path through woods or hills, made for hikers."),
 ("noun","Schuhe",None,"Shoes; what you lace up before a long walk in the woods."),
 ("noun","Vogel","Vögel","A bird; the small animal with wings that sings in the trees."),
 ("noun","Baum",None,"A tree; the tall plant with a wooden trunk and green leaves."),
 ("adjective","genug",None,"Enough; as much as you need and not less than that."),
 ("adverb","vielleicht",None,"Maybe; you are not sure, but you think it could be so."),
 ("verb","stimmen","Stimmt","To be right; you say it when the other person has a point."),
 ("noun","Ast",None,"A branch; the arm of a tree that grows out of the trunk."),
 ("noun","Blatt",None,"A leaf; the flat green part that grows on a branch."),
 ("noun","Schmetterling",None,"A butterfly; the insect with big coloured wings in summer."),
 ("adverb","richtig",None,"Right; the correct way round and not the other one."),
 ("adverb","hinunter",None,"Downwards; from up here down towards the valley."),
 ("noun","Pause",None,"A break; a short rest in the middle of a walk or of work."),
 ("noun","Weile",None,"A while; a stretch of time that passes on a long walk."),
 ("noun","Tal",None,"A valley; the low land that lies between two hills or mountains."),
 ("adverb","bergauf",None,"Uphill; going up the side of a hill, which is hard work."),
])

P["nebel-uber-dem-berg"] = dict(
arcType="late-reveal",
synopsis="Oben auf dem Berg schlägt das Wetter in Minuten um, und eine dichte Nebelwand schiebt sich zwischen die Tannen. An einer Gabelung wissen Mia und Finn nicht mehr, aus welcher Richtung sie gekommen sind, und im Weiß sieht jeder Weg gleich aus. Dann hören sie Wasser rauschen, und die Karte in Mias Hand sagt plötzlich alles.",
text="""Oben auf dem Berg wird die Luft kühl. Mia und Finn merken, wie eine dichte Nebelwand zwischen die Tannen zieht. Innerhalb weniger Minuten ist alles um sie herum weiß.

Mia: Finn, wo bist du? Ich sehe dich kaum noch.
Finn: Direkt hinter dir. Ich komme langsam zu dir herüber.
Mia: Der Nebel kam so schnell. Eben war der Himmel klar.
Finn: Im Gebirge geht das schnell. Bleiben wir auf dem Wanderweg.

An einer Stelle teilt sich der Weg. Finn stellt seinen Wanderstock in den Boden.

Finn: Hier geht es links und rechts weiter. Welcher Weg war unserer?
Mia: Ich bin mir nicht mehr sicher. Im Nebel sieht alles gleich aus.
Finn: Warte, hörst du das? Da unten rauscht Wasser.
Mia: Ein Bach. Auf der Landkarte ist nur auf einer Seite ein Bach.

Mia zieht die Landkarte aus dem Rucksack.

Mia: Die blaue Linie läuft rechts vom Weg. Der Bach ist also rechts.
Finn: Dann sind wir richtig. Von dort geht es hinunter ins Tal.""",
vocab=[
 ("verb","merken",None,"To notice; to see or feel that something is happening."),
 ("adjective","dicht","dichte","Thick or dense, so that you cannot see or walk through it."),
 ("noun","Nebelwand",None,"Thick fog that stands in front of you like a solid wall."),
 ("adverb","hinunter",None,"Downwards; from up here down towards the valley."),
 ("adverb","kaum",None,"Hardly; almost not at all, only a very little bit."),
 ("adjective","klar",None,"Clear; with nothing in the way, so you can see far."),
 ("noun","Gebirge",None,"A mountain range; a large group of mountains together."),
 ("noun","Stelle",None,"A spot; one certain place on a path or on a map."),
 ("adverb","links",None,"On the left; the side opposite to your right hand."),
 ("adverb","rechts",None,"On the right; the side opposite to your left hand."),
 ("adverb","richtig",None,"Right; going the correct way and not the wrong one."),
 ("adjective","sicher",None,"Sure; you know something and have no doubt about it."),
 ("verb","rauschen","rauscht","To rush; the soft loud sound that moving water or wind makes."),
 ("noun","Bach",None,"A stream; a small narrow river that runs down a hill."),
 ("noun","Landkarte",None,"A map; the paper that shows paths, rivers and hills of an area."),
 ("noun","Seite",None,"A side; the left or the right part of a path or a page."),
 ("noun","Linie",None,"A line; the thin mark on a map that shows a river."),
 ("noun","Himmel",None,"The sky; clear one moment and white with fog the next."),
 ("noun","Rucksack",None,"A backpack; the bag with the water and the map inside."),
 ("noun","Tal",None,"A valley; the low land they can see from up here."),
])

P["ein-schild-im-nebel"] = dict(
arcType="reframe-turn",
synopsis="Dem Rauschen des Baches folgen Mia und Finn vorsichtig bergab, mit müden Knien und nassen Stiefeln. Aus dem Grau taucht ein alter Pfahl auf, und darauf sitzt ein Holzschild mit einem Pfeil. Was für Mia die ganze Zeit eine verlorene Wanderung war, sieht sie im Abendlicht am Waldrand auf einmal ganz anders.",
text="""Ein schmaler Pfad führt Mia und Finn neben dem Bach bergab. Mit jedem Schritt wird der Boden feuchter, und das Wasser wird lauter. Ihre Knie zittern vom langen Abstieg.

Finn: Der Bach wird lauter. Wir gehen also richtig.
Mia: Warte, da vorne steht doch etwas im Nebel.
Finn: Wo? Ich sehe nur Grau zwischen den Bäumen.
Mia: Da, ein Pfahl. Komm näher, ich glaube, das ist ein Schild.

Am Wegrand steht ein altes Holzschild mit einem Pfeil.

Finn: Es zeigt genau dorthin, wo wir hinwollen.
Mia: Zur Waldhütte, nur noch zwanzig Minuten.
Finn: Und schau, der Nebel wird dünner. Da kommt die Sonne.
Mia: Endlich. Eben war alles grau, jetzt sehe ich wieder die Tannen.

Im Abendlicht gehen die beiden den letzten Waldweg hinunter. Vor ihnen liegen der Waldrand und die Waldhütte.

Mia: Müde Beine, aber wir sind heil zurück.
Finn: Und morgen erzählen wir allen von unserem Rückweg im Nebel.
Mia: Ein Bach war klüger als die Landkarte.""",
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
 ("adverb","richtig",None,"Right; the direction that turns out to be the correct one."),
 ("noun","Waldweg",None,"A forest track; a wide path for walking through the trees."),
 ("noun","Waldrand",None,"The edge of the forest, where the trees stop and open land begins."),
 ("adjective","müde","Müde","Tired; you have used your strength and now need to rest."),
 ("adjective","heil",None,"Safe and sound; back home without any harm or injury."),
 ("adverb","hinunter",None,"Downwards; from the ridge down to the forest edge."),
 ("adjective","klug","klüger","Clever; good at finding the right answer or the right way."),
 ("noun","Bach",None,"A stream; the small river they followed down the hill."),
 ("noun","Waldhütte",None,"The wooden cabin at the forest edge where they started."),
 ("noun","Landkarte",None,"A map; the paper that showed the stream on one side only."),
])
