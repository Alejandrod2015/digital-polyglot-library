/** Que capa lexica se llevo el A0: portables (verbo/adj/adv) frente a ancladas. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const PORT = new Set(["verb","adjective","adverb","expression","conjunction","preposition","pronoun"]);
async function run(){
  const rows = await prisma.journeyStory.findMany({
    where: { journey: { language: "italian", status: { not: "archived" } } },
    select: { journeyId: true, vocab: true, journey: { select: { name: true, levels: true } } },
  });
  const agg = new Map<string, {p:number,n:number}>();
  for (const r of rows) {
    const k = `${r.journey!.name} ${JSON.stringify(r.journey!.levels)}`;
    const a = agg.get(k) ?? {p:0,n:0};
    for (const v of ((r.vocab as any[]) ?? [])) (PORT.has(String(v.type)) ? a.p++ : a.n++);
    agg.set(k, a);
  }
  for (const [k,v] of agg) console.log(`${k.padEnd(24)} portables ${v.p} · ancladas ${v.n} · ${(100*v.p/(v.p+v.n)).toFixed(0)}% portables`);
  const mio = JSON.parse(fs.readFileSync("scripts/_itA1/ALL.json","utf8")) as any[];
  let p=0,n=0; for (const s of mio) for (const v of s.vocab) (PORT.has(String(v.type))?p++:n++);
  console.log(`${"Traveler A1 (sin guardar)".padEnd(24)} portables ${p} · ancladas ${n} · ${(100*p/(p+n)).toFixed(0)}% portables`);
  await prisma.$disconnect();
}
run();
