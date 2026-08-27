import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const [bundle, fichero] = process.argv.slice(2);
 const viejo = JSON.parse(fs.readFileSync(fichero,"utf8")) as { byStory?: Record<string, Record<string, any>> };
 const filas = await p.tapGlossSet.findMany({ where: { bundle } });
 const out: string[] = [];
 for (const f of filas.filter(x=>x.slug!=="")) {
  const capa = f.glosses as Record<string, any>;
  for (const [w,e] of Object.entries(viejo.byStory?.[f.slug] ?? {})) {
   if (!e.f) continue;
   const ahora = capa[w]?.f;
   if (!ahora) out.push(`QUITADA  ${f.slug.slice(0,24).padEnd(25)} ${w.padEnd(14)} ${e.f.lemma ?? "(sin lema)"}`);
   else if (canon(ahora)!==canon(e.f)) out.push(`CAMBIADA ${f.slug.slice(0,24).padEnd(25)} ${w.padEnd(14)} ${e.f.lemma} -> ${ahora.lemma}`);
  }
 }
 console.log(out.join("\n") || "identico al JSON de git");
 console.log(`\n${out.length} diferencias`);
 await p.$disconnect();
}
main();
