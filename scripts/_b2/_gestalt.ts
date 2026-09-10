import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const db = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h", text: { not: "" } }, select: { slug: true, text: true } });
  const t7 = JSON.parse(fs.readFileSync("scripts/_b2/t7.json", "utf8")) as any[];
  const all = [...db, ...t7.map((s: any) => ({ slug: s.slug, text: s.text }))];
  const frases = ["como quien", "por primera vez", "medio segundo", "se queda", "de golpe", "ninguno", "esa noche", "sin saber", "se viene abajo", "no dice nada", "de verdad", "todavía"];
  for (const f2 of frases) {
    const hits = all.filter(s => s.text.toLowerCase().includes(f2));
    if (hits.length >= 3) console.log(`"${f2}": ${hits.length} historias -> ${hits.map(h => h.slug).join(", ")}`);
  }
  // acotacion dominante global
  const SAY = ["dice","contesta","pregunta","insiste","agrega","corta","promete","plantea","avisa","saluda","remata","pide","suelta","grita","propone","apura"];
  const cnt: Record<string, number> = {};
  for (const s of all) for (const v of SAY) cnt[v] = (cnt[v] ?? 0) + (s.text.match(new RegExp(`”, ?${v}\\b|”\\. ?${v}\\b`, "g")) ?? []).length;
  console.log("acotaciones journey:", Object.entries(cnt).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k} ${n}`).join(" · "));
  await p.$disconnect();
})();
