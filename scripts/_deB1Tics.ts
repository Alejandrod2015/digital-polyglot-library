import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmufhdbsj0007j8rotoym061z";
const first = (t:string) => { const p=t.split(/\n{2,}/)[0]??""; return (p.split(/(?<=[.!?])\s/)[0]??p).trim(); };
const last  = (t:string) => { const p=t.trim().split(/\n{2,}/).pop()??""; const s=p.split(/(?<=[.!?])\s/); return (s[s.length-1]??p).trim(); };
const LEX: Record<string,string[]> = {
  "beer-gardens-and-regulars":["Brotzeit","Kastanien","Maß","Stammtisch","Biergarten","Hofbräukeller","Chinesischen","Augustiner","Bank"],
  "oktoberfest-and-reserved-tables":["Wiesn","Tracht","Theresienwiese","Anstich","Dirndl","Lederhose","Reservierung","Zelt"],
  "weisswurst-and-late-risers":["Weißwurst","Weisswurst","Brezn","Breze","Senf","Weißbier","Mittagsläuten","Wirtshaus","zwölf"],
  "rivers-and-summer-heat":["Isar","Eisbach","Flaucher","Kies","Englische","Surfbrett","Welle","Grill"],
  "alps-and-day-trips":["Alpen","Bayernticket","Tegernsee","S-Bahn","Wanderung","Gipfel","Abfahrt","Berg"],
  "museums-and-cheap-sundays":["Pinakothek","Deutsches Museum","Euro","Garderobe","Sonntag","Insel","Schlange","Ausstellung"],
  "rents-and-waiting-lists":["Schufa","Besichtigung","Kaution","Bürgschaft","Warteliste","Miete","Sofa","Makler"],
};
(async () => {
  const p = new PrismaClient();
  const j = await p.journey.findUnique({ where:{id:J}, select:{topics:true} });
  const ss = await p.journeyStory.findMany({ where:{journeyId:J}, select:{text:true,topic:true,slotIndex:true} });
  ss.sort((a,b)=> j!.topics.indexOf(a.topic!)-j!.topics.indexOf(b.topic!) || a.slotIndex-b.slotIndex);

  const vIni = new Map<string,number>(), sujeto = new Map<string,number>(), vFin = new Map<string,number>();
  for (const s of ss) {
    const f = first(s.text||""); const w = f.split(/\s+/);
    const v = w.find((x,i)=> i>0 && /^[a-zäöüß]+t?$/.test(x)) ?? "?";
    vIni.set(v,(vIni.get(v)||0)+1);
    sujeto.set(/^(Der|Die|Das|Ein|Eine|Zwei|Drei|Kein|Keine)\b/.test(f) ? "sintagma nominal (cosa) + verbo" : "otro", (sujeto.get(/^(Der|Die|Das|Ein|Eine|Zwei|Drei|Kein|Keine)\b/.test(f)?"sintagma nominal (cosa) + verbo":"otro")||0)+1);
    const l = last(s.text||"");
    const m = l.match(/\b(sagt|meint|nennt|nickt|findet|antwortet)\b/);
    vFin.set(m?m[1]:"(sin verbo de decir)", (vFin.get(m?m[1]:"(sin verbo de decir)")||0)+1);
  }
  console.log("SUJETO DE LA 1a ORACION"); for (const [k,v] of [...sujeto].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
  console.log("VERBO DE LA 1a ORACION (3+)"); for (const [k,v] of [...vIni].sort((a,b)=>b[1]-a[1])) if(v>=2) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
  console.log("VERBO DE LA ULTIMA ORACION"); for (const [k,v] of [...vFin].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(2)}/21  ${k}`);

  console.log("\nLEXICO DE MUNICH, por tema (anclas distintas encontradas / historias que traen alguna)");
  for (const t of j!.topics) {
    const del = ss.filter(s=>s.topic===t);
    const hits = new Set<string>(); let conAlguna = 0;
    for (const s of del) { let any=false; for (const a of LEX[t]||[]) if ((s.text||"").includes(a)) { hits.add(a); any=true; } if(any) conAlguna++; }
    console.log(`  ${t.padEnd(32)} ${hits.size} anclas  ${conAlguna}/3 historias  [${[...hits].join(", ")}]`);
  }
  await p.$disconnect();
})();
