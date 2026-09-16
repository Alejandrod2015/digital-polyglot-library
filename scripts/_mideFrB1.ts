import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const stories: any[] = await p.journeyStory.findMany({
    where: { journeyId: "cmu0doigc0007j8e292tycths" }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { slug: true, practiceSet: { select: { exercises: { select: { word: true, type: true, payload: true } } } } },
  });
  const acc: Record<string, {n:number;c:number}> = {};
  const add = (k:string,c:number)=>{ (acc[k] ??= {n:0,c:0}); acc[k].n++; acc[k].c+=c; };
  for (const s of stories) {
    const exs: any[] = JSON.parse(readFileSync(`scripts/_sets/${s.slug}.json`, "utf8"));
    for (const e of exs) {
      const sent = e.payload?.audioClip?.sentence;
      if (!sent || e.payload.audioClip.clipUrl) continue;
      if (e.type === "fill_blank") add(`frase fill_blank ${e.featured!==false?"featured":"pool"}`, String(sent).length);
      else if (e.type === "meaning_in_context") add(`frase meaning ${e.featured!==false?"featured":"pool"}`, String(sent).length);
    }
    for (const e of (s.practiceSet?.exercises ?? []) as any[]) {
      if (e.type!=="meaning_in_context" || !e.word || e.payload?.audioClip?.wordClipUrl) continue;
      add("palabra", String(e.word).trim().replace(/[.?!]+$/,"").length+1);
    }
  }
  let tn=0,tc=0;
  for (const [k,v] of Object.entries(acc).sort()) { console.log(k.padEnd(28), String(v.n).padStart(4), v.c.toString().padStart(6)+"c"); tn+=v.n; tc+=v.c; }
  console.log("TOTAL".padEnd(28), String(tn).padStart(4), tc.toString().padStart(6)+"c");
  const need = Object.entries(acc).filter(([k])=>k==="palabra"||k.startsWith("frase fill_blank"));
  console.log("\nMINIMO PARA PUBLICAR:", need.reduce((a,[,v])=>a+v.n,0), "clips,", need.reduce((a,[,v])=>a+v.c,0), "caracteres");
  await p.$disconnect();
})();
