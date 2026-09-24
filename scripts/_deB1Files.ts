/** Clasifica las 21 primeras oraciones de los ficheros con criterio propio.
 *  Una preposicion inicial (Beim, Vor, Hinter, Am...) es CIRCUNSTANCIAL, no accion:
 *  "Beim Ausrollen" es un sintagma preposicional con verbo sustantivado. */
import * as fs from "fs";
const DIR = "/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/de-b1-friends-texto/scripts/_deB1Friends";
const PERS = ["Lena","Bastian","Miriam","Tobias","Verena"];
const PREP = /^(Beim|Bei|Vor|Hinter|Neben|Zwischen|Unter|Über|Auf|An|Am|Im|In|Nach|Seit|Mit|Ohne|Gegen|Durch|Um|Aus|Von|Zu|Zum|Zur|Während|Trotz|Wegen|Statt|Ab)$/;
const SUBORD = /^(Als|Wenn|Weil|Bevor|Nachdem|Obwohl|Sobald|Während|Bis|Damit|Seit)$/;
const ADV = /^(Heute|Gestern|Morgen|Morgens|Abends|Nachts|Sonntags|Dann|Danach|Später|Draußen|Drinnen|Oben|Unten|Hier|Dort|Jetzt|Endlich|Plötzlich|Kurz|Leise|Laut|Sofort|Zuerst|Diesmal|Wieder|Immer)$/;
const DET = /^(Der|Die|Das|Den|Dem|Des|Ein|Eine|Einen|Einem|Einer|Zwei|Drei|Vier|Fünf|Sechs|Sieben|Kein|Keine|Keinen|Mein|Meine|Meinen|Sein|Seine|Ihr|Ihre|Unser|Unsere|Dieser|Diese|Dieses)$/;
const HUM = /\b(Mitbewohnerin|Mitbewohner|Kollege|Kollegin|Freund|Freundin|Bedienung|Mann|Frau|Gruppe|Leute|Nachbar|Nachbarin|Wirt|Wirtin|Makler|Maklerin)\b/;
const first = (t:string) => { const p=t.split(/\n{2,}/)[0]??""; return (p.split(/(?<=[.!?])\s/)[0]??p).trim(); };
const last  = (t:string) => { const p=t.trim().split(/\n{2,}/).pop()??""; const s=p.split(/(?<=[.!?])\s/); return (s[s.length-1]??p).trim(); };

function forma(f: string): string {
  const w = f.split(/\s+/); const w0 = (w[0]??"").replace(/[:,]$/,"");
  if (/^[“"„]/.test(f)) return "dialogo";
  if (PERS.includes(w0) && /^[A-ZÄÖÜ][a-zäöüß]+:/.test(f)) return "dialogo";
  if (PERS.includes(w0) || /^(Ich|Wir|Er|Sie|Man)$/.test(w0)) return "persona";
  if (PREP.test(w0) || SUBORD.test(w0)) return "circunstancial";
  if (ADV.test(w0)) return "circunstancial";
  if (DET.test(w0)) return HUM.test(w.slice(0,4).join(" ")) ? "persona" : "objeto";
  if (/^[a-zäöüß]/.test(w0)) return "accion (verbo inicial)";
  return `otra (${w0})`;
}

const rows: any[] = [];
for (let i=1;i<=7;i++) for (const s of JSON.parse(fs.readFileSync(`${DIR}/t${i}.json`,"utf8"))) rows.push({...s,t:i});
const cf = new Map<string,number>(), porSlot = new Map<number,string[]>(), prim = new Map<string,number>();
rows.forEach((s,i)=>{
  const f = first(s.text), fo = forma(f);
  cf.set(fo,(cf.get(fo)||0)+1);
  porSlot.set(s.slotIndex,[...(porSlot.get(s.slotIndex)??[]),fo]);
  const w0=(f.split(/\s+/)[0]??"").replace(/[:,]$/,""); prim.set(w0,(prim.get(w0)||0)+1);
  console.log(`${String(i+1).padStart(2)} t${s.t}#${s.slotIndex} [${fo.padEnd(20)}] ${f.slice(0,88)}`);
});
console.log("\n=== FORMA DE APERTURA (mi criterio) ===");
for (const [k,v] of [...cf].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
console.log("=== PRIMERA PALABRA repetida 3+ ===");
for (const [k,v] of [...prim].sort((a,b)=>b[1]-a[1])) if(v>=3) console.log(`  ${String(v).padStart(2)}/21  "${k}"`);
console.log("=== CICLO POR SLOT ===");
for (const [k,v] of [...porSlot].sort()) console.log(`  slot ${k}: ${v.join(", ")}`);
const cie = new Map<string,number>(); let decir=0;
for (const s of rows) {
  const l = last(s.text), w0=(l.split(/\s+/)[0]??"").replace(/[:,]$/,"");
  cie.set(PERS.includes(w0)?"empieza por nombre del reparto":"otra",(cie.get(PERS.includes(w0)?"empieza por nombre del reparto":"otra")||0)+1);
  if (/\b(sagt|meint|nennt)\b/.test(l)) decir++;
  console.log(`    ult t${s.t}#${s.slotIndex}: ${l.slice(0,90)}`);
}
console.log("=== ULTIMA ORACION ===");
for (const [k,v] of cie) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
console.log(`  ${String(decir).padStart(2)}/21  con sagt/meint/nennt`);
const vs=rows.map(r=>(r.vocab??[]).length), ps=rows.map(r=>r.text.split(/\s+/).filter(Boolean).length);
console.log(`\nvocab min=${Math.min(...vs)} max=${Math.max(...vs)}; fuera de 20: ${rows.filter(r=>(r.vocab??[]).length!==20).map(r=>`t${r.t}#${r.slotIndex}`).join(", ")||"ninguna"}`);
console.log(`palabras min=${Math.min(...ps)} max=${Math.max(...ps)}; fuera de 140-154: ${rows.filter(r=>{const n=r.text.split(/\s+/).filter(Boolean).length;return n<140||n>154;}).map(r=>`t${r.t}#${r.slotIndex}`).join(", ")||"ninguna"}`);
