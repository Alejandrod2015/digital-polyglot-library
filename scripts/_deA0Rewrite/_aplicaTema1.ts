/** Rehace el vocab del tema 1 del DE A0. Escribe un JSON; no toca la base. */
import * as fs from "fs";
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
const a1=JSON.parse(fs.readFileSync("/tmp/de-a1-all.json","utf8"));
const ext=new Set<string>(); for(const s of a1) for(const v of (s.vocab??[])) ext.add(lema(v.word));
const first=new Map<string,number>();
a0.forEach((s:any,i:number)=>{for(const v of (s.vocab??[])){const k=lema(v.word); if(!first.has(k)) first.set(k,i);}});

const NUEVAS: Record<number, Array<[string,string,string,string]>> = {
0: [
 ["noun","der Freund","Freund","A friend; someone you have known and trusted for a long time."],
 ["noun","die Kirche","Kirche","A church; the building where a Christian service is held."],
 ["noun","die Musik","Musik","Music; the sound a person plays or sings."],
 ["noun","der Mann","Mann","A man; an adult male person."],
 ["noun","der Sommer","Sommer","Summer; the warm season of the year."],
 ["noun","die Glocke","Glocken","A bell; the metal object in a tower that rings the hour."],
 ["noun","der Sonntag","Sonntag","Sunday; the last day of the week."],
 ["verb","winken","winkt","To wave; to move a hand in greeting from a distance."],
 ["adjective","breit","breit","Wide; measuring a lot from one side to the other."],
 ["adverb","langsam","langsam","Slowly; at a low speed."],
],
1: [
 ["noun","die Mitte","Mitte","The middle; the point at equal distance from both ends."],
 ["noun","die Schulter","Schulter","The shoulder; the part of the body where the arm joins."],
 ["noun","das Papier","Papier","Paper; the thin material a map or a letter is made of."],
 ["noun","der Student","Student","A student; a man who studies at a university."],
 ["noun","die Antwort","Antwort","An answer; what a person says in reply to a question."],
 ["verb","unterschreiben","unterschreibe","To sign; to write your name to agree to something."],
 ["noun","der Oktober","Oktober","October; the tenth month of the year, when the deadline falls."],
 ["verb","fließen","fließt","To flow; to move along the way a river does."],
 ["noun","das Semester","Semester","A semester; half a study year at a university."],
 ["noun","der Mensch","Menschen","A person; a human being."],
],
2: [
 ["noun","die Gitarre","Gitarre","A guitar; the string instrument a person plays."],
 ["noun","der Schüler","Schülern","A pupil; a young person who is taught at school."],
 ["noun","der Urlaub","Urlaub","Time off work; the days you do not have to work."],
 ["adverb","selten","selten","Rarely; only a few times and not often at all."],
 ["noun","die Leute","Leuten","People; a group of persons."],
 ["verb","sehen","sehen","To see; to meet someone or to notice something with your eyes."],
 ["adverb","genau","Genau","Exactly; precisely that and nothing else."],
 ["adverb","gern","gern","Gladly; willingly and with pleasure."],
 ["adverb","warum","Warum","Why; the word you use to ask for the reason for something."],
],
};

for (const i of [0,1,2]) {
  const s = a0[i];
  const quedan = s.vocab.filter((v:any)=> first.get(lema(v.word))===i && !ext.has(lema(v.word)));
  const nuevas = NUEVAS[i].map(([type,word,surface,definition])=>({type,word,surface,definition}));
  s.vocab = [...quedan, ...nuevas];
  const faltan = nuevas.filter(v=>!s.text.includes(v.surface));
  console.log(`${i+1} ${s.title}: quedan ${quedan.length} + nuevas ${nuevas.length} = ${s.vocab.length}` +
    (faltan.length ? `  ¡SURFACE FUERA DEL TEXTO: ${faltan.map(v=>v.surface).join(", ")}!` : ""));
}
fs.writeFileSync("" + __dirname + "/de-a0-v2.json", JSON.stringify(a0,null,2));
