import * as fs from "fs";
const DIR = __dirname;
const a0 = JSON.parse(fs.readFileSync(DIR + "/de-a0-v4.json","utf8"));
const V=(t:string,w:string,s:string,d:string)=>({type:t,word:w,surface:s,definition:d});
a0[6].text = fs.readFileSync(DIR + "/textos/h7.txt","utf8").trim();
a0[6].vocab=[
 V("noun","die Weste","Weste","A waistcoat; a sleeveless jacket worn over a shirt."),
 V("noun","der Förster","Förster","A forester; the man whose work is looking after a forest."),
 V("noun","der Ort","Ort","A village; a small place where people live."),
 V("noun","der Rand","Rand","The edge; the outer line where something stops."),
 V("noun","der Wald","Wald","A forest; a large area thickly covered with trees."),
 V("noun","das Harz","Harz","Resin; the sticky liquid that comes out of pine trees."),
 V("noun","der Ofen","Ofen","A stove; the iron box that burns wood and heats a room."),
 V("noun","das Sofa","Sofa","A sofa; the long soft seat you can also sleep on."),
 V("noun","der Anruf","Anruf","A phone call; the act of ringing someone up."),
 V("noun","die Schokolade","Schokolade","Chocolate; the sweet brown food made from cocoa."),
 V("noun","das Brot","Brot","Bread; the basic food baked from flour."),
 V("noun","die Wurst","Wurst","Sausage; the meat food cut in slices for bread."),
 V("noun","die Universität","Universität","A university; where the two of them first met as students."),
 V("noun","der Bahnsteig","Bahnsteig","A platform; the long strip beside the rails where you wait."),
 V("noun","der Zug","Zug","A train; the long vehicle that runs on rails between towns."),
 V("noun","das Haus","Haus","A house; the building a person lives in."),
 V("noun","der Freund","Freunde","A friend; a person you have known and trusted for a long time."),
 V("noun","der Schuh","Schuhe","A shoe; what you wear on your foot."),
 V("verb","öffnen","öffnet","To open; to move a door so a person can go through."),
 V("adjective","sauber","sauber","Clean; with no dirt on it."),
];
a0[7].text = fs.readFileSync(DIR + "/textos/h8.txt","utf8").trim();
a0[7].vocab=[
 V("noun","die Reihe","Reihen","A row; a line of things standing one behind the other."),
 V("noun","die Nadel","Nadeln","A needle; here the thin pointed leaf of a pine tree."),
 V("noun","das Reh","Reh","A deer; the shy wild animal of the forest."),
 V("noun","die Erde","Erde","Soil; the brown ground under your feet."),
 V("noun","der Knöchel","Knöchel","An ankle; the joint between the leg and the foot."),
 V("noun","die Kurve","Kurven","A bend; a place where a path turns."),
 V("noun","das Gras","Gras","Grass; the green plants that cover a meadow."),
 V("noun","die Stunde","Stunden","An hour; the sixty minutes that make one part of a day."),
 V("noun","der Arm","Arm","An arm; the long part of the body between shoulder and hand."),
 V("noun","der Kopf","Kopf","A head; the top part of the body, above the neck."),
 V("noun","die Woche","Woche","A week; the seven days from Monday to Sunday."),
 V("verb","rutschen","rutscht","To slip; to slide suddenly and lose your footing."),
 V("verb","brauchen","brauchen","To need; to require something in order to manage."),
 V("verb","wandern","wanderst","To hike; to walk a long way in the countryside."),
 V("verb","verlieren","verliert","To lose; to no longer have or find something."),
 V("adjective","nass","nassen","Wet; covered with water."),
 V("adjective","eng","eng","Narrow; with little space between the sides."),
 V("adjective","weich","weich","Soft; easy to press, not hard."),
 V("adjective","braun","braune","Brown; the colour of earth or of tree bark."),
 V("adverb","sofort","sofort","At once; in the very same moment, without waiting."),
];
a0[8].text = fs.readFileSync(DIR + "/textos/h9.txt","utf8").trim();
a0[8].vocab=[
 V("noun","die Kuckucksuhr","Kuckucksuhren","A cuckoo clock; the carved wooden clock of the Black Forest."),
 V("noun","die Werkstatt","Werkstatt","A workshop; the room where a craftsman works with his hands."),
 V("noun","der Vater","Vater","A father; the male parent of a person."),
 V("noun","das Werkzeug","Werkzeug","Tools; the things a person works with."),
 V("noun","der Hocker","Hocker","A stool; a low seat with no back."),
 V("noun","das Öl","Öl","Oil; the thick liquid used on wood and on machines."),
 V("noun","der Griff","Griff","A grip; the practised way a hand takes hold of a tool."),
 V("noun","der Winter","Winter","Winter; the cold season at the end of the year."),
 V("noun","das Messer","Messer","A knife; the blade used for cutting or carving."),
 V("noun","der Span","Späne","A shaving; the thin curl of wood a knife cuts away."),
 V("noun","das Holzstück","Holzstücke","A piece of wood; a block waiting to be carved."),
 V("noun","das Holz","Holz","Wood; the hard material that trees are made of."),
 V("noun","die Woche","Wochen","A week; the seven days from Monday to Sunday."),
 V("noun","der Förster","Förster","A forester; the man whose work is looking after a forest."),
 V("verb","schnitzen","schnitzt","To carve; to cut a shape out of wood with a knife."),
 V("verb","schließen","schließt","To close; to stop working or to shut for good."),
 V("verb","stecken","steckt","To put; to slide a small thing into a pocket or a bag."),
 V("verb","brauchen","braucht","To need; to require something in order to manage."),
 V("verb","zittern","zittern","To tremble; to shake slightly without meaning to."),
 V("adjective","scharf","scharf","Sharp; with an edge that cuts easily."),
];
for (const i of [6,7,8]) { const s=a0[i];
  const f=s.vocab.filter((v:any)=>!s.text.includes(v.surface));
  console.log(`${i+1} ${s.title}: ${s.vocab.length}` + (f.length?`  FUERA: ${f.map((v:any)=>v.surface).join(", ")}`:"  ok")); }
fs.writeFileSync(DIR + "/de-a0-v5.json", JSON.stringify(a0,null,2));
