/** Clasifica las 21 primeras oraciones de los ficheros de Codex con criterio propio. Sin escritura. */
import * as fs from "fs";
const DIR = "/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/de-b1-friends-texto/scripts/_deB1Friends";
const PERS = ["Lena","Bastian","Miriam","Tobias","Verena"];
const first = (t:string) => { const p=t.split(/\n{2,}/)[0]??""; return (p.split(/(?<=[.!?])\s/)[0]??p).trim(); };
const last  = (t:string) => { const p=t.trim().split(/\n{2,}/).pop()??""; const s=p.split(/(?<=[.!?])\s/); return (s[s.length-1]??p).trim(); };

/** Mi criterio, no el de Codex: que ocupa la POSICION INICIAL de la oracion. */
function forma(f: string): string {
  const w0 = f.split(/\s+/)[0]?.replace(/[:,]$/,"") ?? "";
  if (/^[“"„]/.test(f)) return "dialogo";
  if (PERS.includes(w0)) return /^[A-ZÄÖÜ][a-zäöüß]+:/.test(f) ? "dialogo" : "persona";
  if (/^(Ich|Wir|Er|Sie|Man)$/.test(w0)) return "persona";
  if (/^(Der|Die|Das|Den|Dem|Ein|Eine|Einen|Einem|Einer|Zwei|Drei|Vier|Fünf|Sechs|Sieben|Kein|Keine|Keinen|Mein|Meine|Sein|Seine|Ihr|Ihre)$/.test(w0)) {
    // sujeto nominal: persona solo si el nucleo es humano
    return /\b(Mitbewohnerin|Kollege|Kollegin|Freund|Freundin|Bedienung|Mann|Frau|Gruppe|Leute)\b/.test(f.split(/\s+/).slice(0,4).join(" ")) ? "persona" : "objeto";
  }
  if (/^(Am|An|Im|In|Auf|Unter|Vor|Nach|Bei|Neben|Zwischen|Hinter|Über|Seit|Während|Als|Wenn|Bevor|Nachdem|Kurz|Heute|Gestern|Morgens|Abends|Sonntags|Dann|Danach|Später|Draußen|Drinnen|Oben|Unten)$/.test(w0)) return "circunstancia";
  if (/^[a-zäöüß]/.test(w0)) return "accion (verbo inicial)";
  if (/^(Wer|Was|Wie|Wo|Warum|Wann)$/.test(w0)) return "pregunta";
  return `otra (${w0})`;
}

const rows: any[] = [];
for (let i=1;i<=7;i++) for (const s of JSON.parse(fs.readFileSync(`${DIR}/t${i}.json`,"utf8"))) rows.push({...s, t:i});
console.log(`historias en ficheros: ${rows.length}`);
const cf = new Map<string,number>(); const porSlot = new Map<number,string[]>();
rows.forEach((s,i)=>{
  const f = first(s.text), fo = forma(f);
  cf.set(fo,(cf.get(fo)||0)+1);
  porSlot.set(s.slotIndex,[...(porSlot.get(s.slotIndex)??[]), fo]);
  const v = (s.vocab??[]).length, pal = s.text.split(/\s+/).filter(Boolean).length;
  console.log(`${String(i+1).padStart(2)} t${s.t}#${s.slotIndex} [${fo.padEnd(22)}] voc=${v} pal=${pal}\n    1a: ${f}\n    ult: ${last(s.text)}`);
});
console.log("\n=== FORMA DE APERTURA (mi criterio) ===");
for (const [k,v] of [...cf].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
console.log("=== CICLO POR SLOT ===");
for (const [k,v] of [...porSlot].sort()) console.log(`  slot ${k}: ${v.join(", ")}`);
const vs = rows.map(r=>(r.vocab??[]).length), ps = rows.map(r=>r.text.split(/\s+/).filter(Boolean).length);
console.log(`\nvocab: min=${Math.min(...vs)} max=${Math.max(...vs)}  fuera de 20: ${rows.filter(r=>(r.vocab??[]).length!==20).map(r=>`t${r.t}#${r.slotIndex}=${(r.vocab??[]).length}`).join(", ")||"ninguna"}`);
console.log(`palabras: min=${Math.min(...ps)} max=${Math.max(...ps)}  fuera de 140-154: ${rows.filter(r=>{const n=r.text.split(/\s+/).filter(Boolean).length; return n<140||n>154;}).map(r=>`t${r.t}#${r.slotIndex}=${r.text.split(/\s+/).filter(Boolean).length}`).join(", ")||"ninguna"}`);
const cierre = new Map<string,number>(); const decir = new Map<string,number>();
for (const s of rows) {
  const l = last(s.text), w0 = l.split(/\s+/)[0]?.replace(/[:,]$/,"") ?? "";
  cierre.set(PERS.includes(w0)?"nombre del reparto al inicio":"otro",(cierre.get(PERS.includes(w0)?"nombre del reparto al inicio":"otro")||0)+1);
  const m = l.match(/\b(sagt|meint|nennt)\b/); if (m) decir.set("sagt/meint/nennt + lo dicho",(decir.get("sagt/meint/nennt + lo dicho")||0)+1);
}
console.log("=== ULTIMA ORACION ==="); for (const [k,v] of cierre) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
for (const [k,v] of decir) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
