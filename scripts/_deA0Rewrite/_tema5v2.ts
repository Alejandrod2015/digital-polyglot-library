import * as fs from "fs";
const DIR = __dirname;
const a0 = JSON.parse(fs.readFileSync(DIR + "/de-a0-v6.json","utf8"));
const V=(t:string,w:string,s:string,d:string)=>({type:t,word:w,surface:s,definition:d});
a0[12].text = fs.readFileSync(DIR + "/textos/h13.txt","utf8").trim();
a0[12].vocab=[
 V("noun","das Salz","Salz","Salt; what the sea air tastes and smells of."),
 V("noun","der Kutter","Kutter","A cutter; the small wooden boat a fisherman works from."),
 V("noun","das Seil","Seil","A rope; the thick cord that ties a boat to the jetty."),
 V("noun","der Fischer","Fischer","A fisherman; a man whose work is catching fish."),
 V("noun","die Schuppe","Schuppen","A scale; one of the small plates on the skin of a fish."),
 V("noun","der Fang","Fang","The catch; all the fish brought in on one trip."),
 V("noun","der Dorsch","Dorsche","A cod; the fish caught in the Baltic Sea."),
 V("noun","der Mai","Mai","May; the fifth month of the year, in late spring."),
 V("noun","das Gummi","Gummi","Rubber; the material a waterproof jacket is made of."),
 V("noun","der Rest","Reste","The leftovers; the small parts nobody wants."),
 V("noun","die Insel","Insel","An island; land with water all around it."),
 V("noun","der Mann","Männer","A man; an adult male person."),
 V("noun","das Leben","Leben","A life; all the years a person lives."),
 V("adjective","schlecht","schlecht","Bad; of poor quality or done badly."),
 V("verb","binden","bindet","To tie; to fasten a rope so a boat cannot drift."),
 V("adjective","groß","groß","Big; large in size."),
 V("adjective","klein","klein","Small; little in size or amount."),
 V("adjective","scharf","scharf","Sharp; strong and biting to the nose."),
 V("noun","der Steg","Steg","A jetty; the narrow wooden walkway out over the water."),
 V("verb","sehen","sieht","To see; to notice something with your eyes."),
];
a0[13].text = fs.readFileSync(DIR + "/textos/h14.txt","utf8").trim();
a0[13].vocab=[
 V("noun","der Kreidefelsen","Kreidefelsen","A chalk cliff; the white rock wall above the Baltic Sea."),
 V("noun","der Fels","Fels","Rock; the hard stone of a cliff."),
 V("noun","der Kalk","Kalk","Chalk; the soft white stone that marks your hands."),
 V("noun","die Buche","Buchen","A beech; the tall tree that grows to the cliff edge."),
 V("noun","die Wurzel","Wurzeln","A root; the part of a plant that holds it in the ground."),
 V("noun","die Kante","Kante","The edge; the line where the cliff drops away."),
 V("noun","der Strand","Strand","A beach; the stony shore at the foot of the cliff."),
 V("noun","der Feuerstein","Feuersteine","A flint; the hard stone people look for on this beach."),
 V("noun","das Loch","Loch","A hole; an opening right through something."),
 V("noun","die Ehefrau","Ehefrau","A wife; the woman a man is married to."),
 V("noun","die Hosentasche","Hosentasche","A trouser pocket; where a small keepsake goes."),
 V("noun","das Meer","Meer","The sea; the great salt water."),
 V("noun","das Glück","Glück","Luck; the good fortune a charm is meant to bring."),
 V("noun","die Stufe","Stufen","A step; one of the flat parts of a stair you tread on."),
 V("noun","die Mutter","Mutter","A mother; the female parent of a person."),
 V("verb","wandern","wandern","To hike; to walk a long way on foot."),
 V("verb","nennen","nennt","To call; to give a thing a particular name."),
 V("verb","brechen","bricht","To break; to come apart under its own weight."),
 V("adverb","plötzlich","plötzlich","Suddenly; all at once and without warning."),
 V("noun","die Luft","Luft","Air; what you breathe, here the empty space under the roots."),
];
a0[14].text = fs.readFileSync(DIR + "/textos/h15.txt","utf8").trim();
a0[14].vocab=[
 V("noun","der Leuchtturm","Leuchtturm","A lighthouse; the tower whose light warns ships."),
 V("noun","das Gitter","Gitter","A grille; the metal bars across an opening."),
 V("noun","der Regen","Regen","Rain; the water that falls from the clouds."),
 V("noun","das Eisen","Eisen","Iron; the hard grey metal the steps are made of."),
 V("noun","der Blick","Blick","A gaze; where a person is looking."),
 V("noun","die Gummijacke","Gummijacke","A rubber jacket; the oilskin a fisherman wears."),
 V("noun","der Januar","Januar","January; the first and coldest month of the year."),
 V("noun","der Winter","Winter","Winter; the cold season at the end of the year."),
 V("noun","der Finger","Finger","A finger; one of the five parts at the end of the hand."),
 V("noun","die Mutter","Mutter","A mother; the female parent of a person."),
 V("noun","das Meer","Meer","The sea; the great salt water."),
 V("noun","die Schuld","Schuld","Fault; the blame for something that went wrong."),
 V("noun","das Ende","Ende","An end; the point where something stops."),
 V("adjective","nass","nass","Wet; covered with water."),
 V("verb","schweigen","schweigt","To keep silent; to say nothing on purpose."),
 V("verb","schreiben","schreibe","To write; to put words on paper and send them."),
 V("verb","stecken","stecken","To be tucked; to sit deep inside something."),
 V("noun","der Ärmel","Ärmeln","A sleeve; the part of a jacket that covers the arm."),
 V("adjective","klein","klein","Small; little in size."),
 V("adverb","oben","oben","Up there; in or towards a higher place."),
];
for (const i of [12,13,14]) { const s=a0[i];
  const f=s.vocab.filter((v:any)=>!s.text.includes(v.surface));
  console.log(`${i+1} ${s.title}: ${s.vocab.length}` + (f.length?`  FUERA: ${f.map((v:any)=>v.surface).join(", ")}`:"  ok")); }
fs.writeFileSync(DIR + "/de-a0-v7.json", JSON.stringify(a0,null,2));
