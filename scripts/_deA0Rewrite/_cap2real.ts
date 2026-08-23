/** Igual que _cap2 pero con candidatos REALES:
 *  - fuera nombres propios, numerales, pronombres y auxiliares
 *  - la limpieza se comprueba sobre la FORMA BASE, no sobre el token suelto.
 *    Sin esto proponia `kennt` como palabra nueva cuando el A1 ya ensena
 *    `kennen`, y el choque volvia por la puerta de atras. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const J="cmt0a8vb1000m32p1x7r5ba28";
const PROPIOS=new Set("hannah elias sophie noah emilia leon marie dresden leipzig heidelberg neckar elbe triberg freiburg schwarzwald meersburg konstanz mainau bodensee sassnitz rügen königsstuhl arkona nürnberg pegnitz garmisch grainau zugspitze eibsee hamburg dänemark deutschland österreich kleeblatt kettensteg hauptmarkt spätzle lebkuchen kuckucksuhren dorsche hühnergötter hühnergott".split(" "));
const FUNC=new Set(("null eins zwei drei vier fünf sechs sieben acht neun zehn zwanzig dreißig vierzig hundert erste ersten erster zweite zweiten beide beiden meine meinen mein deine dein seine seinen ihre ihren ihrem unser euer bist sind seid warst wart hast habt hatte hatten wird wirst werden wurde etwas nichts jemand niemand alles alle jeder jede jedes andere anderen ander dieser diese dieses jener solche welche wessen dessen deren neben zwischen überall irgendwo dorthin hierher daneben darüber darunter dabei dazu davon damit deshalb trotzdem außerdem später früher fast eben gerade schon noch immer wieder sehr ziemlich genug kaum bald gleich ganz halb").split(/\s+/));
const STOP=new Set(("der die das ein eine einen einem einer eines und oder aber denn sondern nicht kein keine ist sind war waren sein hat habe haben hatte ich du er sie es wir ihr mich dich sich uns euch von zu mit nach bei aus vor über unter auf an in im am zum zur als wie wenn dass weil dann man wer was wo hier dort jetzt heute nie oft doch ja nein bis durch für gegen ohne um seit dem den des kann können muss müssen will wollen soll sollen darf dürfen mag mögen").split(/\s+/));
const IRREG: Record<string,string> = { sieht:"sehen", nimmt:"nehmen", trägt:"tragen", gibt:"geben", hält:"halten", fährt:"fahren", läuft:"laufen", spricht:"sprechen", liest:"lesen", steht:"stehen", geht:"gehen", kommt:"kommen", sagt:"sagen", macht:"machen", legt:"legen", zeigt:"zeigen", liegt:"liegen", bleibt:"bleiben", wartet:"warten", kennt:"kennen", fragt:"fragen", antwortet:"antworten", ruft:"rufen", lacht:"lachen", nickt:"nicken", führt:"führen", hängt:"hängen", riecht:"riechen", springt:"springen", schneidet:"schneiden", faltet:"falten", zählt:"zählen", sucht:"suchen", bringt:"bringen", glaubt:"glauben", zieht:"ziehen", schaut:"schauen", sitzt:"sitzen", schläft:"schlafen", hebt:"heben", deckt:"decken", kocht:"kochen", dauert:"dauern", pfeift:"pfeifen", passt:"passen", winkt:"winken", fließt:"fließen", gleitet:"gleiten", umarmt:"umarmen", beginnt:"beginnen", berührt:"berühren", verspricht:"versprechen", kündigt:"kündigen", tippt:"tippen", klettert:"klettern", rutscht:"rutschen", erreicht:"erreichen", schnitzt:"schnitzen", feilt:"feilen", gießt:"gießen", füllt:"füllen", verkauft:"verkaufen", kaut:"kauen", packt:"packen", schließt:"schließen", wächst:"wachsen", startet:"starten", mietet:"mieten", stoppt:"stoppen", schwimmt:"schwimmen", bindet:"binden", streiten:"streiten", rollen:"rollen", knackt:"knacken", zittert:"zittern", drückt:"drücken", steckt:"stecken", dreht:"drehen", schweigt:"schweigen", friert:"frieren", bläst:"blasen", sinkt:"sinken", kreisen:"kreisen" };
const base=(t:string)=>{ const l=t.toLowerCase(); if(IRREG[l]) return IRREG[l];
  if(/[^aeiou]t$/.test(l)&&l.length>4) return l.slice(0,-1)+"en"; return l; };
const TOPE=Number(process.env.TOPE ?? 2);
(async()=>{
  const mio = await p.journey.findUnique({ where:{id:J}, select:{language:true, typeSlug:true}});
  const otras = await p.journeyStory.findMany({
    where:{ journey:{ language:mio!.language, status:{not:"archived"} }, journeyId:{not:J} },
    select:{ vocab:true, journey:{select:{typeSlug:true}} }});
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){ const d = r.journey?.typeSlug===mio!.typeSlug ? duro : blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word))); }
  if (process.env.SIN_A1) duro.clear();
  const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
  const cuerpos=a0.map((s:any)=>new Set(tok(String(s.text))));
  const clave=(x:string)=>x.toLowerCase().replace(/^(der|die|das)\s+/,"");
  const enc=(x:string)=>cuerpos.filter((c:Set<string>)=>c.has(clave(x))).length;
  const usos=new Map<string,number>();
  const nuevo: Array<Array<{word:string;surface:string;nueva:boolean}>>=a0.map(()=>[]);
  a0.forEach((s:any,i:number)=>{ for(const v of (s.vocab??[])){ const k=lema(v.word);
    if(duro.has(k)) continue; if((usos.get(k)??0)>=TOPE) continue;
    usos.set(k,(usos.get(k)??0)+1); nuevo[i].push({word:v.word,surface:String(v.surface??v.word),nueva:false}); } });
  a0.forEach((s:any,i:number)=>{
    const cands=[...new Set(tok(String(s.text)))]
      .filter(t=>t.length>=4 && !STOP.has(t) && !FUNC.has(t) && !PROPIOS.has(t))
      .map(t=>({t, b:base(t)}))
      .filter(({b})=>!duro.has(lema(b)) && !blando.has(lema(b)))
      .sort((a,b)=>enc(b.t)-enc(a.t));
    for(const {t,b} of cands){ if(nuevo[i].length>=20) break; const k=lema(b);
      if((usos.get(k)??0)>=TOPE) continue; usos.set(k,(usos.get(k)??0)+1);
      nuevo[i].push({word:b,surface:t,nueva:true}); } });
  const todas:number[]=[]; let cortas=0,nuevas=0; const cortasList:string[]=[];
  a0.forEach((s:any,i:number)=>{ if(nuevo[i].length<20){cortas++;cortasList.push(`${i+1} ${s.title}: ${nuevo[i].length}`);}
    for(const v of nuevo[i]){ todas.push(enc(v.surface)); if(v.nueva) nuevas++; } });
  fs.writeFileSync("" + __dirname + "/de-a0-plan2.json", JSON.stringify(nuevo,null,1));
  console.log(`tope ${TOPE} · plazas ${todas.length} · palabras distintas ${usos.size} · nuevas a glosar ${nuevas}`);
  console.log("historias por debajo de 20:", cortas, cortasList.join(" | "));
  console.log(`ESCALERA media ${(todas.reduce((a,b)=>a+b,0)/todas.length).toFixed(2)} (suelo 3.00) · ${todas.filter(n=>n<=1).length} salen una sola vez`);
  await p.$disconnect();
})();
