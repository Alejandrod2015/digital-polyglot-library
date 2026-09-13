import json
T="quarrels-and-making-up"
def V(t,w,s,d,a=False):
    o={"type":t,"word":w,"surface":s,"definition":d}
    if a: o["anchor"]=True
    return o
s0=["Ihr erster Lauftreff nach der schweren Woche ist komisch. Der Himmel ist grau und voller Wolken, und am Main ist es windig und kalt. Julia, die Physiotherapeutin aus Rostock, wartet am Ufer. Moritz ist Straßenbahnfahrer und hat heute frei. Er bringt Carolin mit. Carolin ist seine Schwester und arbeitet als Hebamme in einer Klinik.",
"Alle sind pünktlich, höflich und plötzlich sehr lieb zu Julia. “Heimweh ist ganz normal”, meint Theresa. “Wir sind doch alle für dich da”, meint auch Florian.",
"Da versteht Julia alles. Nur Moritz weiß von ihrem Geheimnis. Sie wird rot, aber diesmal nicht vor Scham: Sie ist wütend.",
"“Du hast es allen erzählt, stimmt's? Die Nachricht war nur für dich! Das war unhöflich und dumm”, ruft Julia.",
"“Ich wollte dir nur helfen, ehrlich. Ich hatte Angst um dich”, antwortet Moritz. Aber Julia will unbedingt keinen Streit vor der Gruppe. Sie entscheidet schnell und läuft allein nach Hause, links am Ufer entlang."]
s1=["Moritz klopft zweimal am Tag, aber Julia öffnet nicht. Am Dienstag schreibt sie in den Chat vom Lauftreff: Sie ist krank. Das ist eine Ausrede, und Julia weiß es.",
"Am Mittwochabend klingelt es. Vor der Tür steht nicht Moritz, sondern Carolin, mit einem Apfelkuchen. “Darf ich reinkommen? Ich will nicht streiten”, sagt sie vorsichtig.",
"Der Kuchen ist noch warm. Sie teilen ihn am Küchentisch. “Mein Bruder weint selten”, erzählt Carolin. “Aber letztes Jahr ist sein bester Freund nach Berlin umgezogen. Moritz war monatelang allein.”",
"Bald ist der Teller leer.",
"Julia sagt lange nichts. “Er hat Angst, dass du Frankfurt verlässt. Deshalb hat er die Gruppe um Hilfe gebeten. Das war dumm, aber nicht böse. Du bist doch klug”, erklärt Carolin. Julia und Moritz sind sich ziemlich ähnlich.",
"Nach dem Besuch sitzt Julia lange in der Küche. Ihr Ärger ist kleiner geworden. Sie will Moritz nicht verlieren. Vielleicht gibt es eine Lösung."]
s2=["Die Kaffeemaschine zischt am Donnerstagmorgen. Julia füllt zwei Becher mit Kaffee und Milch. Dann geht sie über den Flur und klopft an Moritz' Tür.",
"Moritz öffnet im Morgenmantel. Er sieht nicht gesund aus und reibt sich das Kinn. “Es tut mir so leid”, sagt er sofort. “Ich erzähle nie wieder ein Geheimnis.”",
"“Mir tut es auch leid”, antwortet Julia. “Ich war nicht krank. Das war eine Lüge.” Sie stellt die Becher auf die glatte, kalte Treppe, und sie setzen sich nebeneinander.",
"Sie wohnen im selben Haus, aber heute rutscht Moritz ein bisschen näher. “Kommst du Sonntag wieder zum Lauftreff?”, fragt er leise. “Ja. Ich will zurückkommen”, antwortet Julia. “Ich wünsche mir nur eins: Nächstes Mal fragst du mich vorher.”",
"Moritz hebt seinen Becher, und seine Augen leuchten. Sie genießen den Kaffee. Er ist warm und mild. Hinter ihnen stehen beide Türen weit offen."]
out=[{"topic":T,"slotIndex":i,"title":ti,"arcType":ar,"synopsis":"","text":"\n\n".join(tx),"vocab":[]} for i,(ti,tx,ar) in enumerate([("Alle wissen es",s0,"reframe-turn"),("Kuchen von Carolin",s1,"recurring-character-callback"),("Zwei Becher auf der Treppe",s2,"harmonic-close")])]
out[0]["vocab"]=[
V("adjective","grau","grau","Grey; the colour of clouds on a day with no sun."),
V("noun","die Wolken","Wolken","Clouds; white or grey shapes in the sky that bring rain."),
V("adjective","windig","windig","Windy; there is a lot of wind and the air moves fast."),
V("adjective","frei","frei","Free; not at work, with a day off."),
V("noun","die Hebamme","Hebamme","A midwife; a woman whose job is to help mothers when babies come.",True),
V("noun","die Klinik","Klinik","A clinic or hospital; a place where sick people get care.",True),
V("adjective","pünktlich","pünktlich","On time; not late, at exactly the right time."),
V("adjective","höflich","höflich","Polite; with good manners, kind and careful with others."),
V("verb","meinen","meint","To say or think; to give your opinion about something."),
V("verb","wissen","weiß","To know; to have the facts about something in your head."),
V("noun","das Geheimnis","Geheimnis","A secret; something you tell only one person and nobody else.",True),
V("noun","die Scham","Scham","Shame; the bad feeling when you think you did something wrong.",True),
V("adjective","wütend","wütend","Angry; very cross because someone did something bad to you."),
V("verb","stimmen","stimmt","To be true; you use it to ask if something is right."),
V("adjective","unhöflich","unhöflich","Rude; not polite, not kind to other people."),
V("adjective","dumm","dumm","Stupid; not clever, not a good idea at all."),
V("adverb","unbedingt","unbedingt","Really; you want it very much and it must be so."),
V("noun","der Streit","Streit","A fight or argument; two people are angry and say hard words.",True),
V("verb","entscheiden","entscheidet","To decide; to choose what you will do."),
V("adverb","links","links","On the left; on the left side, not the right."),
]
out[1]["vocab"]=[
V("adverb","zweimal","zweimal","Two times; once and then one more time."),
V("adjective","krank","krank","Ill; not healthy, your body does not feel well."),
V("noun","die Ausrede","Ausrede","An excuse; a reason you give that is not the real one.",True),
V("noun","der Mittwochabend","Mittwochabend","The evening of a Wednesday, in the middle of the week.",True),
V("noun","der Apfelkuchen","Apfelkuchen","Apple cake; a sweet cake made with fresh apples.",True),
V("verb","reinkommen","reinkommen","To come in; to go into a room or a flat."),
V("verb","streiten","streiten","To argue; to have a fight with angry words."),
V("verb","teilen","teilen","To share; to give a part of something to another person."),
V("noun","der Bruder","Bruder","A brother; a boy or man with the same parents as you."),
V("noun","der Küchentisch","Küchentisch","The kitchen table; the table in the kitchen where people eat.",True),
V("adverb","selten","selten","Rarely; not often, only a few times in a long while."),
V("verb","umziehen","umgezogen","To move house; to go and live in a new flat or city."),
V("adverb","monatelang","monatelang","For months; for a long time of many months."),
V("verb","verlassen","verlässt","To leave; to go away from a place and not stay."),
V("verb","werden","geworden","To become; to change and be different than before."),
V("adjective","ähnlich","ähnlich","Similar; almost the same, like each other in many ways."),
V("adjective","klug","klug","Clever; smart, you understand things well and quickly."),
V("verb","verlieren","verlieren","To lose; to not have a person or a thing any more."),
V("noun","die Lösung","Lösung","A solution; a way to fix a problem."),
V("adjective","leer","leer","Empty; with nothing left in it or on it."),]
out[2]["vocab"]=[
V("noun","die Kaffeemaschine","Kaffeemaschine","A coffee machine; it makes hot coffee in the kitchen.",True),
V("noun","der Donnerstagmorgen","Donnerstagmorgen","The morning of a Thursday, before work starts.",True),
V("verb","füllen","füllt","To fill; to put a drink into a cup until it is full."),
V("noun","die Milch","Milch","Milk; a white drink from cows that people put in coffee."),
V("noun","der Morgenmantel","Morgenmantel","A dressing gown; a soft coat you wear at home in the morning.",True),
V("adjective","gesund","gesund","Healthy; well and not ill, with a body that feels good."),
V("noun","das Kinn","Kinn","The chin; the bottom part of your face, under your mouth."),
V("adverb","nie","nie","Never; not one time, not at any time."),
V("verb","stellen","stellt","To put something down so it stands on a place."),
V("adjective","glatt","glatte","Smooth; flat and even, with no rough parts."),
V("adjective","selbe","selben","Same; not a different one, but exactly this one."),
V("adjective","näher","näher","Closer; a little nearer to someone than before."),
V("verb","zurückkommen","zurückkommen","To come back; to return to a place or a group."),
V("verb","wünschen","wünsche","To wish; to want something and hope it will happen."),
V("adverb","vorher","vorher","Before; at an earlier time, first, before you do it."),
V("verb","heben","hebt","To lift or raise something up into the air."),
V("verb","leuchten","leuchten","To shine or glow; here, the eyes look very happy."),
V("verb","genießen","genießen","To enjoy; to like something very much while you do it."),
V("adjective","mild","mild","Mild; soft in taste, not strong or bitter."),
V("adverb","nebeneinander","nebeneinander","Next to each other; side by side, very close together."),]
syn=["At the first run after a hard week everyone is very kind to Julia. Moritz brings his sister Carolin, a midwife. Julia soon understands that Moritz has told the whole group about her homesickness. She is angry, tells Moritz it was rude and stupid, and runs home alone.",
"For two days Julia does not open the door for Moritz, and she tells the group she is ill. Then Carolin comes with an apple cake. She tells Julia that Moritz was alone for months when his best friend moved away. He was afraid to lose Julia, too.",
"Early the next morning Julia takes two mugs of coffee across the hall and knocks on Moritz's door. They both say sorry and sit together on the stairs between their flats. Julia will come back to the running group, and Moritz promises to ask her first next time."]
for o,sy in zip(out,syn): o["synopsis"]=sy
json.dump(out,open("scripts/_deA1Friends/t7-data.json","w"),ensure_ascii=False,indent=1)
