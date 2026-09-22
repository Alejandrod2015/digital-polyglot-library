/** SOLO LEE: la plaza huerfana, el ejercicio que le roba el sitio y la frase
 *  de la historia donde sale, para escribir el ejercicio que le falta. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
const p = new PrismaClient();
(async () => {
  const [slug, plaza] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { title:true, text:true, vocab:true, journeyId:true, journey: { select: { id:true, name:true, language:true, variant:true, levels:true, status:true } } } });
  const j = s!.journey!;
  console.log(`journey ${j.id} · ${j.language}/${j.variant} ${j.name} ${(j.levels??[]).join(",")} · ${j.status}`);
  const v = ((s!.vocab as any[])??[]).find(x => String(x.word).toLowerCase() === plaza.toLowerCase());
  console.log(`PLAZA: ${JSON.stringify(v)}`);
  const texto = `${s!.title}\n${extractStoryPlainText(s!.text ?? "")}`;
  const re = new RegExp(`(?<![\\p{L}\\p{M}])${String(v.surface ?? v.word).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`, "iu");
  for (const f of texto.split(/(?<=[.!?”])\s+/).map(x=>x.trim()).filter(Boolean)) if (re.test(f)) console.log(`FRASE: ${f}`);
  const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${slug}.json`, "utf8")) as any[];
  console.log(`\nejercicios del set: ${exs.length}`);
  for (const e of exs) {
    const w = e.type === "match_meaning" ? (e.payload.pairs??[]).map((x:any)=>x.word).join(",") : e.word;
    console.log(`  ${String(e.type).padEnd(18)} ${String(w).padEnd(28)} feat=${e.featured !== false} clip=${!!(e.payload?.audioClip?.clipUrl)}`);
  }
  await p.$disconnect();
})();
