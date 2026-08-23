/** Aplica el tema 1 reescrito (cuerpos nuevos + 60 plazas) sobre el volcado
 *  de las 21. Escribe un JSON; no toca la base. */
import * as fs from "fs";
const a0 = JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
const V = (type:string, word:string, surface:string, definition:string)=>({type,word,surface,definition});

a0[0].text = fs.readFileSync("" + __dirname + "/textos/h1.txt","utf8").trim();
a0[0].vocab = [
 V("noun","die Lehrerin","Lehrerin","A female teacher; a woman whose work is teaching at a school."),
 V("noun","der Bahnsteig","Bahnsteig","A platform; the long strip beside the rails where you wait for a train."),
 V("noun","die Minute","Minuten","A minute; one of the sixty short parts of an hour."),
 V("noun","die Tasche","Tasche","A bag; the soft thing you carry your belongings in."),
 V("noun","der Freund","Freund","A friend; a person you have known and trusted for a long time."),
 V("noun","die Schule","Schule","A school; the place where children are taught."),
 V("noun","der Mann","Mann","A man; an adult male person."),
 V("noun","der Kaffee","Kaffee","Coffee; the hot dark drink many people take in the morning."),
 V("noun","die Arbeit","Arbeit","Work; the job a person does to earn a living."),
 V("noun","das Museum","Museum","A museum; the building where old or valuable things are shown."),
 V("noun","die Altstadt","Altstadt","The old town; the oldest part of a city, with its narrow streets."),
 V("noun","die Musik","Musik","Music; the sound a person makes by playing or singing."),
 V("noun","die Kirche","Kirche","A church; the building where a Christian service is held."),
 V("noun","der Hut","Hut","A hat; the thing you wear on your head, here left out for coins."),
 V("noun","der Sommer","Sommer","Summer; the warm season between spring and autumn."),
 V("noun","das Schiff","Schiff","A ship; a large boat that carries people or goods on water."),
 V("verb","winken","winkt","To wave; to move a hand in greeting so someone sees you."),
 V("verb","liegen","liegt","To lie; to rest flat on a surface without moving."),
 V("adjective","breit","breit","Wide; measuring a lot from one side to the other."),
 V("adjective","braun","braun","Brown; the colour of earth or of muddy river water."),
];

a0[1].text = fs.readFileSync("" + __dirname + "/textos/h2.txt","utf8").trim();
a0[1].vocab = [
 V("noun","die Mitte","Mitte","The middle; the point at equal distance from both ends."),
 V("noun","die Schulter","Schulter","The shoulder; the part of the body where the arm joins."),
 V("noun","das Papier","Papier","Paper; the thin material a map or a letter is made of."),
 V("noun","der Student","Student","A student; a young man who studies at a university."),
 V("noun","die Antwort","Antwort","An answer; what a person says in reply to a question."),
 V("noun","das Semester","Semester","A semester; one half of a study year at a university."),
 V("noun","der Oktober","Oktober","October; the tenth month of the year, when her deadline falls."),
 V("noun","der Turm","Türme","A tower; a tall narrow building that stands above the roofs."),
 V("noun","der Morgen","Morgen","The morning; the first hours of the day, before midday."),
 V("noun","das Schiff","Schiff","A ship; a large boat that carries people or goods on water."),
 V("noun","der Stein","Stein","Stone; the hard grey material a bridge or a wall is built of."),
 V("noun","die Hand","Hand","A hand; the part of the body at the end of the arm."),
 V("noun","der Arm","Arm","An arm; the long part of the body between shoulder and hand."),
 V("noun","das Zimmer","Zimmer","A room; one of the separate spaces inside a house."),
 V("noun","die Tasche","Tasche","A bag; the soft thing you carry your belongings in."),
 V("noun","der Kaffee","Kaffee","Coffee; the hot dark drink that goes cold when you forget it."),
 V("verb","falten","faltet","To fold; to bend paper over on itself so it becomes smaller."),
 V("verb","unterschreiben","unterschreibe","To sign; to write your name to agree to something."),
 V("adjective","weich","weich","Soft; easy to bend or press, not hard."),
 V("adjective","kaputt","kaputt","Broken; damaged and no longer whole."),
];

a0[2].text = fs.readFileSync("" + __dirname + "/textos/h3.txt","utf8").trim();
a0[2].vocab = [
 V("noun","die Gitarre","Gitarre","A guitar; the wooden string instrument a person plays with the fingers."),
 V("noun","der Schüler","Schülern","A pupil; a young person who is taught at a school."),
 V("noun","der Urlaub","Urlaub","Time off work; the days when you do not have to work."),
 V("noun","die Leute","Leute","People; a group of persons taken together."),
 V("noun","das Boot","Boot","A boat; a small craft that carries people over water."),
 V("noun","der Zug","Zug","A train; the long vehicle that runs on rails between cities."),
 V("noun","das Museum","Museum","A museum; the building where old or valuable things are shown."),
 V("noun","die Arbeit","Arbeit","Work; the job a person does to earn a living."),
 V("noun","der Juni","Juni","June; the sixth month of the year, in early summer."),
 V("noun","die Kusine","Kusine","A female cousin; the daughter of an uncle or an aunt."),
 V("noun","der Name","Namen","A name; the word by which a person is called."),
 V("noun","der Morgen","Morgen","The morning; the first hours of the day, before midday."),
 V("noun","der Stein","Stein","Stone; the hard grey material the old steps are built of."),
 V("noun","das Jahr","Jahre","A year; the twelve months from one January to the next."),
 V("noun","die Stufe","Stufen","A step; one of the flat parts of a stair you tread on."),
 V("verb","verstehen","versteht","To understand; to see clearly what a person means."),
 V("adverb","selten","selten","Rarely; only a few times and not often at all."),
 V("adverb","sofort","sofort","At once; in the very same moment, without waiting."),
 V("adverb","genau","Genau","Exactly; precisely that and nothing else."),
 V("pronoun","nichts","nichts","Nothing; not a single thing at all."),
];

for (const i of [0,1,2]) {
  const s = a0[i];
  const faltan = s.vocab.filter((v:any)=>!s.text.includes(v.surface));
  console.log(`${i+1} ${s.title}: ${s.vocab.length} plazas` + (faltan.length?`  SURFACE FUERA: ${faltan.map((v:any)=>v.surface).join(", ")}`:"  surfaces ok"));
}
fs.writeFileSync("" + __dirname + "/de-a0-v3.json", JSON.stringify(a0,null,2));
