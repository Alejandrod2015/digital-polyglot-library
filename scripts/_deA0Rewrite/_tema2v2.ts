import * as fs from "fs";
const a0 = JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-v3.json","utf8"));
const V=(t:string,w:string,s:string,d:string)=>({type:t,word:w,surface:s,definition:d});
a0[3].text = fs.readFileSync("" + __dirname + "/textos/h4.txt","utf8").trim();
a0[3].vocab=[
 V("noun","der Bus","Bus","A bus; the long road vehicle that carries many passengers."),
 V("noun","die Stunde","Stunden","An hour; the sixty minutes that make one part of a day."),
 V("noun","die Ärztin","Ärztin","A female doctor; a woman who treats sick people."),
 V("noun","das Krankenhaus","Krankenhaus","A hospital; the building where sick people are treated."),
 V("noun","das Haus","Haus","A house; the building a family lives in."),
 V("noun","das Essen","Essen","The food; a meal that has been cooked and is ready."),
 V("noun","die Soße","Soße","Sauce; the thick liquid poured over a dish."),
 V("noun","die Butter","Butter","Butter; the soft yellow fat made from milk."),
 V("noun","der Hunger","Hunger","Hunger; the feeling you have when you need to eat."),
 V("noun","der Apfelsaft","Apfelsaft","Apple juice; the cold drink pressed from apples."),
 V("noun","die Familie","Familie","A family; the people you are related to."),
 V("noun","der Käse","Käse","Cheese; the firm food made from milk."),
 V("noun","das Jahr","Jahren","A year; the twelve months from one January to the next."),
 V("noun","die Kusine","Kusine","A female cousin; the daughter of an uncle or an aunt."),
 V("noun","die Hand","Hand","A hand; the part of the body at the end of the arm."),
 V("noun","die Antwort","Antwort","An answer; what a person says in reply to a question."),
 V("adjective","spät","spät","Late; after the time that was agreed."),
 V("verb","arbeiten","arbeitet","To work; to do a job for a living."),
 V("verb","sehen","sieht","To see; to notice something with your eyes."),
 V("adverb","endlich","endlich","At last; after a long wait, finally."),
];
a0[4].text = fs.readFileSync("" + __dirname + "/textos/h5.txt","utf8").trim();
a0[4].vocab=[
 V("noun","der Meter","Meter","A metre; the unit used to measure length or distance."),
 V("noun","die Mauer","Mauern","A wall; a thick outer wall of stone around a building."),
 V("noun","der Krieg","Krieg","War; a long armed fight between countries."),
 V("noun","der Keller","Keller","A cellar; the room under a building, below the ground."),
 V("noun","das Holz","Holz","Wood; the hard material that trees are made of."),
 V("noun","der Direktor","Direktor","A headmaster; the man who runs a school."),
 V("noun","die Terrasse","Terrasse","A terrace; a flat open place outside with a view."),
 V("noun","das Modell","Modell","A model; a small copy of something much bigger."),
 V("noun","der Turm","Turm","A tower; a tall narrow building that stands above the rest."),
 V("noun","das Zimmer","Zimmer","A room; one of the separate spaces inside a building."),
 V("noun","die Schule","Schule","A school; the place where children are taught."),
 V("noun","die Lehrerin","Lehrerin","A female teacher; a woman whose work is teaching at a school."),
 V("noun","der Name","Namen","A name; the word by which a person is called."),
 V("noun","der August","August","August; the eighth month of the year, in late summer."),
 V("verb","liegen","liegt","To lie; to rest flat on a surface without moving."),
 V("verb","pfeifen","pfeift","To whistle; to make a high sound by blowing through the lips."),
 V("adjective","kaputt","kaputt","Broken; damaged and no longer whole."),
 V("adjective","zerbrochen","zerbrochen","Broken in pieces; fallen apart into separate parts."),
 V("adjective","groß","groß","Big; large in size."),
 V("pronoun","nichts","nichts","Nothing; not a single thing at all."),
];
a0[5].text = fs.readFileSync("" + __dirname + "/textos/h6.txt","utf8").trim();
a0[5].vocab=[
 V("noun","der Affe","Affe","A monkey; here the bronze figure that stands by the bridge gate."),
 V("noun","die Bronze","Bronze","Bronze; the brown metal that statues are cast in."),
 V("noun","der Besucher","Besucher","A visitor; a person who comes to see a place."),
 V("noun","das Glück","Glück","Luck; the good fortune people hope a charm will bring."),
 V("noun","das Ruderboot","Ruderboot","A rowing boat; a small boat moved with oars."),
 V("noun","der Kopf","Kopf","A head; the top part of the body, above the neck."),
 V("noun","der Anfang","Anfang","The beginning; the first part or the near end of something."),
 V("noun","der August","August","August; the eighth month of the year, in late summer."),
 V("noun","der Bus","Bus","A bus; the long road vehicle that carries many passengers."),
 V("noun","das Krankenhaus","Krankenhaus","A hospital; the building where sick people are treated."),
 V("noun","die Minute","Minuten","A minute; one of the sixty short parts of an hour."),
 V("noun","die Kusine","Kusinen","A female cousin; the daughter of an uncle or an aunt."),
 V("verb","umarmen","umarmt","To hug; to hold a person close with both arms."),
 V("verb","gleiten","gleitet","To glide; to move smoothly and without noise."),
 V("verb","beginnen","beginnt","To begin; to start at a given moment."),
 V("verb","berühren","berühren","To touch; to put a hand on something."),
 V("verb","wünschen","wünschst","To wish; to want something to happen."),
 V("verb","antworten","antwortet","To answer; to reply to what someone has asked."),
 V("adjective","glatt","glatt","Smooth; even to the touch, with no rough places."),
 V("adverb","bald","bald","Soon; in a short time from now."),
];
for (const i of [3,4,5]) { const s=a0[i];
  const f=s.vocab.filter((v:any)=>!s.text.includes(v.surface));
  console.log(`${i+1} ${s.title}: ${s.vocab.length} plazas` + (f.length?`  FUERA: ${f.map((v:any)=>v.surface+"/"+v.word).join(", ")}`:"  surfaces ok")); }
fs.writeFileSync("" + __dirname + "/de-a0-v4.json", JSON.stringify(a0,null,2));
