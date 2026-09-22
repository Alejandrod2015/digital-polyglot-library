/** SOLO MIDE: de que se compone el denominador, para que el informe diga
 *  contra cuantos sets se midio y por que faltan los demas. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ff = fs.readdirSync("scripts/_sets").filter(f=>f.endsWith(".json"));
  const slugs = ff.map(f=>f.replace(".json",""));
  const rows = await p.journeyStory.findMany({ where: { slug: { in: slugs } },
    select: { slug:true, vocab:true, journey: { select: { status:true } } } });
  const m = new Map(rows.map(r=>[r.slug!, r]));
  let sinHistoria=0, archivado=0, sinVocab=0, medidos=0;
  for (const s of slugs) { const r=m.get(s);
    if (!r || !r.journey) { sinHistoria++; continue; }
    if (r.journey.status!=="active" && r.journey.status!=="draft") { archivado++; continue; }
    if (!((r.vocab as any[])??[]).filter(v=>v?.word).length) { sinVocab++; continue; }
    medidos++; }
  console.log(`ficheros en scripts/_sets: ${ff.length}`);
  console.log(`  medidos:                 ${medidos}`);
  console.log(`  sin historia en la base: ${sinHistoria}`);
  console.log(`  fuera del marco:         ${archivado}`);
  console.log(`  historia sin vocab:      ${sinVocab}`);
  await p.$disconnect();
})();
