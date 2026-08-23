import * as fs from "fs";
const DIR = __dirname;
const a0 = JSON.parse(fs.readFileSync(DIR + "/de-a0-v7.json","utf8"));
const V=(t:string,w:string,s:string,d:string)=>({type:t,word:w,surface:s,definition:d});
a0[15].text = fs.readFileSync(DIR + "/textos/h16.txt","utf8").trim();
a0[15].vocab=[
 V("noun","die Tante","Tante","An aunt; the sister of your father or your mother."),
 V("noun","der Lebkuchen","Lebkuchen","Gingerbread; the spiced cake Nuremberg is known for."),
 V("noun","der Markt","Markt","A market; the square where stalls sell food and goods."),
 V("noun","der Stand","Stand","A stall; the small stand a trader sells from."),
 V("noun","die Dose","Dosen","A tin; the metal box that keeps biscuits fresh."),
 V("noun","das Blech","Blech","Tin plate; the thin metal a box is made of."),
 V("noun","der Zucker","Zucker","Sugar; the sweet white grains used in baking."),
 V("noun","der Honig","Honig","Honey; the thick sweet food made by bees."),
 V("noun","die Schwester","Schwester","A sister; a female child of the same parents."),
 V("noun","das Geld","Geld","Money; what you pay with."),
 V("noun","die Mandel","Mandeln","An almond; the pale nut baked into the cake."),
 V("noun","der Tod","Tod","Death; the end of a person's life."),
 V("noun","der Tresen","Tresen","A counter; the long table a shop sells across."),
 V("noun","die Backstube","Backstube","A bakehouse; the back room where the baking is done."),
 V("noun","der Freitag","Freitag","Friday; the fifth day of the week, when the market is full."),
 V("noun","der Mai","Mai","May; the fifth month of the year."),
 V("noun","die Familie","Familie","A family; the people you are related to."),
 V("noun","die Frau","Frau","A woman; an adult female person."),
 V("verb","helfen","helfe","To help; to do part of the work for someone."),
 V("adjective","bunt","Bunte","Colourful; painted in many bright colours."),
];
a0[16].text = fs.readFileSync(DIR + "/textos/h17.txt","utf8").trim();
a0[16].vocab=[
 V("noun","das Kleeblatt","Kleeblatt","A clover leaf; the green sign hanging over the door."),
 V("noun","der Handwerker","Handwerker","A craftsman; a man who makes things by hand."),
 V("noun","die Zinnfigur","Zinnfiguren","A pewter figure; a small cast metal model."),
 V("noun","das Metall","Metall","Metal; the hard material that melts in the pan."),
 V("noun","die Form","Form","A mould; the hollow shape hot metal is poured into."),
 V("noun","die Ritterfigur","Ritterfigur","A knight figure; the tiny armoured man from the mould."),
 V("noun","der Frühling","Frühling","Spring; the season when the year starts to warm."),
 V("noun","die Sachen","Sachen","Things; skills and objects taken together."),
 V("noun","die Kante","Kanten","An edge; the rim left rough after casting."),
 V("noun","der Markt","Markt","A market; the square where stalls sell food and goods."),
 V("verb","feilen","feilt","To file; to smooth metal with a rough tool."),
 V("verb","malen","malt","To paint; to put colour on with a brush."),
 V("verb","vergessen","Vergiss","To forget; to let something go out of your mind."),
 V("verb","gießen","gießt","To cast; to pour hot metal into a mould."),
 V("verb","füllen","füllt","To fill; to pour something in until it is full."),
 V("verb","öffnen","öffnet","To open; to take the two halves apart."),
 V("adjective","winzig","winzige","Tiny; very small indeed."),
 V("adjective","flüssig","flüssig","Liquid; melted and able to flow."),
 V("adjective","grün","grünen","Green; the colour of grass and leaves."),
 V("adjective","heiß","heiß","Hot; at a very high temperature."),
];
a0[17].text = fs.readFileSync(DIR + "/textos/h18.txt","utf8").trim();
a0[17].vocab=[
 V("noun","der Rauch","Rauch","Smoke; the grey cloud that rises from a grill."),
 V("noun","der Kettensteg","Kettensteg","A chain footbridge; the old iron bridge over the river."),
 V("noun","die Bratwurst","Bratwürste","A grilled sausage; the street food of Nuremberg."),
 V("noun","das Brötchen","Brötchen","A bread roll; the small round bread a sausage goes in."),
 V("noun","das Fett","Fett","Fat; the grease that drips from grilled meat."),
 V("noun","die Ente","Enten","A duck; the water bird that sleeps under the bridge."),
 V("noun","der Advent","Advent","Advent; the four weeks before Christmas."),
 V("noun","Weihnachten","Weihnachten","Christmas; the feast at the end of December."),
 V("noun","die Träne","Tränen","A tear; the drop that comes from a crying eye."),
 V("noun","die Dose","Dosen","A tin; the metal box that keeps biscuits fresh."),
 V("verb","schlafen","schlafen","To sleep; to rest with your eyes closed."),
 V("noun","die Hilfe","Hilfe","Help; the work another person does for you."),
 V("noun","das Papier","Papier","Paper; the sheet the food is wrapped in."),
 V("noun","das Eisen","Eisen","Iron; the hard grey metal the bridge is made of."),
 V("noun","die Gasse","Gasse","An alley; a very narrow street between old houses."),
 V("noun","der Steg","Steg","A footbridge; the narrow walkway over the water."),
 V("noun","der Rost","Rost","A grill; the metal grid meat is cooked on."),
 V("verb","kauen","kaut","To chew; to work food with the teeth."),
 V("verb","tropfen","tropft","To drip; to fall in single drops."),
 V("verb","falten","faltet","To fold; to bend paper over on itself."),
];
a0[15].title = "Katrins Lebkuchen am Hauptmarkt";
a0[15].slug = "katrins-lebkuchen-am-hauptmarkt";
for (const i of [15,16,17]) {
  a0[i].synopsis = String(a0[i].synopsis ?? "").replace(/\bMaries\b/g,"Katrins").replace(/\bMarie\b/g,"Katrin");
}
for (const i of [15,16,17]) { const s=a0[i];
  const f=s.vocab.filter((v:any)=>!s.text.includes(v.surface));
  console.log(`${i+1} ${s.title}: ${s.vocab.length}` + (f.length?`  FUERA: ${f.map((v:any)=>v.surface).join(", ")}`:"  ok")); }
fs.writeFileSync(DIR + "/de-a0-v8.json", JSON.stringify(a0,null,2));
