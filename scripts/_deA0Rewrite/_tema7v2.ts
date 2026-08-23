import * as fs from "fs";
const DIR = __dirname;
const a0 = JSON.parse(fs.readFileSync(DIR + "/de-a0-v8.json","utf8"));
const V=(t:string,w:string,s:string,d:string)=>({type:t,word:w,surface:s,definition:d});
a0[18].text = fs.readFileSync(DIR + "/textos/h19.txt","utf8").trim();
a0[18].vocab=[
 V("noun","die Zahnradbahn","Zahnradbahn","A rack railway; the mountain train with a toothed centre rail."),
 V("noun","das Rad","Räder","A wheel; the round part a vehicle runs on."),
 V("noun","die Schiene","Schiene","A rail; the metal track a train runs along."),
 V("noun","der Tunnel","Tunnel","A tunnel; the passage cut straight through a mountain."),
 V("noun","die Felswand","Felswände","A rock face; the steep wall of stone beside the track."),
 V("noun","der Brief","Brief","A letter; a written message sent to someone."),
 V("noun","der Arzt","Ärzte","A doctor; a person who treats sick people."),
 V("noun","das Land","Land","A country; the whole land she has been travelling through."),
 V("noun","der Kalender","Kalender","A diary; the book that says where you must be."),
 V("noun","der Wald","Wald","A forest; a large area thickly covered with trees."),
 V("noun","der Monat","Monate","A month; one of the twelve parts of a year."),
 V("noun","der Januar","Januar","January; the first and coldest month of the year."),
 V("noun","der Advent","Advent","Advent; the four weeks before Christmas."),
 V("noun","der August","August","August; the eighth month of the year."),
 V("noun","die Leute","Leute","People; a group of persons taken together."),
 V("verb","klettern","klettert","To climb; to go up a steep slope slowly."),
 V("verb","reisen","reist","To travel; to go from place to place."),
 V("verb","falten","faltet","To fold; to bend paper over on itself."),
 V("noun","das Öl","Öl","Oil; the smell of a working machine."),
 V("adjective","zufrieden","zufrieden","Satisfied; content with how something has gone."),
];
a0[19].text = fs.readFileSync(DIR + "/textos/h20.txt","utf8").trim();
a0[19].vocab=[
 V("noun","der Schnee","Schnee","Snow; the white cover that stays on high peaks."),
 V("noun","die Seilbahn","Seilbahn","A cable car; the cabin that hangs from a steel rope."),
 V("noun","der Gipfel","Gipfel","A summit; the highest point of a mountain."),
 V("noun","die Sonnenbrille","Sonnenbrille","Sunglasses; dark glasses worn against bright light."),
 V("noun","die Wolke","Wolken","A cloud; the white mass that floats in the sky."),
 V("noun","das Feld","Feld","A field; a wide flat stretch of ground."),
 V("noun","die Grenze","Grenze","A border; the line where one country ends."),
 V("noun","der Stiefel","Stiefel","A boot; the heavy shoe that covers the ankle."),
 V("noun","der Handschuh","Handschuhe","A glove; what you wear on a cold hand."),
 V("noun","das Kreuz","Kreuz","A cross; the iron marker planted on a summit."),
 V("noun","die Nase","Nase","A nose; the part of the face you breathe through."),
 V("noun","der Herbst","Herbst","Autumn; the season between summer and winter."),
 V("noun","der Ernst","Ernst","Seriousness; meaning a thing for real."),
 V("adjective","hart","hart","Hard; firm and not soft under the boot."),
 V("verb","sinken","sinken","To sink; to go down into something soft."),
 V("verb","kündigen","kündige","To resign; to tell an employer you are leaving."),
 V("noun","der Juli","Juli","July; the seventh month, high summer down in the valley."),
 V("noun","der Berg","Berg","A mountain; a very high piece of land."),
 V("adjective","dumm","dumm","Stupid; a bad idea, badly thought out."),
 V("noun","die Ruhe","Ruhe","Quiet; the deep silence at the top of a mountain."),
];
a0[20].text = fs.readFileSync(DIR + "/textos/h21.txt","utf8").trim();
a0[20].vocab=[
 V("noun","die Kammer","Kammer","A small room; a bare little chamber in a hut."),
 V("noun","das Bord","Bord","A shelf; the narrow board fixed to a wall."),
 V("noun","der Umschlag","Umschlag","An envelope; the paper cover a letter goes in."),
 V("noun","der Stift","Stift","A pen; what you write a letter with."),
 V("noun","die Decke","Decke","A blanket; the thick cloth you put over your shoulders."),
 V("noun","der Tee","Tee","Tea; the hot drink made from leaves."),
 V("noun","die Lampe","Lampe","A lamp; the shade that holds a light."),
 V("noun","das Papier","Papier","Paper; the sheet a map or a letter is made of."),
 V("noun","der Brief","Briefe","A letter; a written message sent to someone."),
 V("noun","das Bett","Betten","A bed; where you sleep."),
 V("noun","der Ort","Orte","A place; a town or spot on the map."),
 V("noun","das Jahr","Jahr","A year; the twelve months from one January to the next."),
 V("noun","die Schulter","Schultern","The shoulder; the part of the body where the arm joins."),
 V("noun","der Oktober","Oktober","October; the tenth month of the year."),
 V("noun","die Ruhe","Ruhe","Quiet; the deep silence outside the hut."),
 V("noun","das Holz","Holz","Wood; what burns in the fire."),
 V("noun","der Stiefel","Stiefel","A boot; the heavy shoe left wet by the door."),
 V("verb","brennen","brennt","To burn; to be on fire."),
 V("verb","tippen","tippt","To tap; to touch a point quickly with a finger."),
 V("noun","die Kanne","Kanne","A pot; the vessel tea is made in."),
];
for (const i of [18,19,20]) { const s=a0[i];
  const f=s.vocab.filter((v:any)=>!s.text.includes(v.surface));
  console.log(`${i+1} ${s.title}: ${s.vocab.length}` + (f.length?`  FUERA: ${f.map((v:any)=>v.surface).join(", ")}`:"  ok")); }
fs.writeFileSync(DIR + "/de-a0-v9.json", JSON.stringify(a0,null,2));
