import * as fs from "fs";
const DIR = __dirname;
const a0 = JSON.parse(fs.readFileSync(DIR + "/de-a0-v5.json","utf8"));
const V=(t:string,w:string,s:string,d:string)=>({type:t,word:w,surface:s,definition:d});
a0[9].text = fs.readFileSync(DIR + "/textos/h10.txt","utf8").trim();
a0[9].vocab=[
 V("noun","die Anlegestelle","Anlegestelle","A landing stage; the place where a ferry ties up."),
 V("noun","die Fähre","Fähre","A ferry; the boat that carries people across water on a fixed route."),
 V("noun","das Deck","Deck","A deck; the open floor of a boat where passengers stand."),
 V("noun","der See","See","A lake; a large body of still water inside the land."),
 V("noun","die Freundin","Freundin","A female friend; a woman you have known for a long time."),
 V("noun","das Hemd","Hemd","A shirt; the light garment worn on the upper body."),
 V("noun","die Gasse","Gassen","An alley; a very narrow street between old houses."),
 V("noun","der Fensterladen","Fensterläden","A shutter; the wooden panel that closes over a window."),
 V("noun","die Burg","Burg","A castle; the old fortified building above a town."),
 V("noun","die Möwe","Möwen","A gull; the white sea bird that follows boats."),
 V("noun","das Haar","Haare","Hair; what grows on a person's head."),
 V("noun","der Tag","Tag","A day; the twenty four hours from one midnight to the next."),
 V("verb","kreisen","kreisen","To circle; to fly round and round in the air."),
 V("verb","verstehen","versteht","To understand; to see clearly what a person means."),
 V("verb","führen","führt","To lead; to take someone along and show the way."),
 V("adjective","bunt","bunte","Colourful; painted in many bright colours."),
 V("adjective","kurz","kurz","Short; cut close to the head and not long."),
 V("noun","der Hund","Hund","A dog; the animal many people keep at home."),
 V("adverb","oben","oben","Up there; in or towards a higher place."),
 V("noun","die Mauer","Mauer","A wall; a thick old wall of stone in a town."),
];
a0[10].text = fs.readFileSync(DIR + "/textos/h11.txt","utf8").trim();
a0[10].vocab=[
 V("noun","der Motor","Motor","An engine; the machine that drives a boat."),
 V("noun","der Versuch","Versuche","An attempt; one try at doing something."),
 V("noun","die Insel","Insel","An island; land with water all around it."),
 V("noun","der Finger","Finger","A finger; one of the five parts at the end of the hand."),
 V("noun","die Haut","Haut","Skin; the outer covering of the body."),
 V("noun","der Februar","Februar","February; the second and shortest month of the year."),
 V("noun","das Handtuch","Handtuch","A towel; the cloth you dry yourself with."),
 V("noun","die Frau","Frauen","A woman; an adult female person."),
 V("noun","das Boot","Boot","A boat; a small craft that carries people over water."),
 V("noun","der Rand","Rand","The rim; the outer edge you can hold on to."),
 V("noun","der Schuh","Schuhe","A shoe; what you wear on your foot."),
 V("noun","der Oktober","Oktober","October; the tenth month of the year, when both things fall."),
 V("noun","der Tag","Tag","A day; the twenty four hours from one midnight to the next."),
 V("verb","schwimmen","schwimmen","To swim; to move through water with the body."),
 V("verb","springen","springt","To jump; to push off and leave the ground or the boat."),
 V("adjective","rot","rot","Red; the colour skin turns in very cold water."),
 V("noun","der Monat","Monat","A month; one of the twelve parts of a year."),
 V("adjective","eisig","eisig","Icy; painfully cold to the skin."),
 V("adjective","krank","krank","Ill; not healthy and in need of treatment."),
 V("noun","der See","See","A lake; a large body of still water inside the land."),
];
a0[11].text = fs.readFileSync(DIR + "/textos/h12.txt","utf8").trim();
a0[11].vocab=[
 V("noun","die Rebe","Reben","A vine; the plant that grapes grow on."),
 V("noun","der Hang","Hang","A slope; ground that rises at an angle."),
 V("noun","der Zweig","Zweige","A branch; a small woody arm of a plant."),
 V("noun","der Korb","Korb","A basket; the open container woven from thin strips of wood."),
 V("noun","der Zaun","Zaun","A fence; the low barrier along a path or a field."),
 V("noun","der Apfelbaum","Apfelbaum","An apple tree; the tree the table is laid under."),
 V("noun","der Most","Most","Cider; the cold drink pressed from apples."),
 V("noun","die Luft","Luft","Air; what you breathe."),
 V("noun","die Reihe","Reihen","A row; a line of things standing one behind the other."),
 V("noun","der Monat","Monat","A month; one of the twelve parts of a year."),
 V("noun","das Brot","Brot","Bread; the basic food baked from flour."),
 V("noun","der Fisch","Fisch","A fish; the animal that lives in water and is eaten."),
 V("noun","die Fähre","Fähre","A ferry; the boat that crosses the lake on a fixed route."),
 V("noun","das Glas","Gläser","A glass; the clear vessel you drink from."),
 V("verb","sammeln","sammelt","To gather; to pick things up and collect them together."),
 V("verb","reparieren","repariert","To mend; to make something whole again."),
 V("verb","schließen","schließt","To close; to shut a hand or a door."),
 V("adjective","süß","süß","Sweet; tasting of sugar."),
 V("adjective","sauer","sauer","Sour; sharp on the tongue, like a lemon."),
 V("verb","füllen","füllt","To fill; to put liquid into a glass until it is full."),
];
for (const i of [9,10,11]) { const s=a0[i];
  const f=s.vocab.filter((v:any)=>!s.text.includes(v.surface));
  console.log(`${i+1} ${s.title}: ${s.vocab.length}` + (f.length?`  FUERA: ${f.map((v:any)=>v.surface).join(", ")}`:"  ok")); }
fs.writeFileSync(DIR + "/de-a0-v6.json", JSON.stringify(a0,null,2));
