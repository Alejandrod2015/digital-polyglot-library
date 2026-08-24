import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const id = process.argv[2];
  const modo = process.argv[3] ?? "resumen";
  const j = await prisma.journey.findUnique({ where: { id }, select: { topics: true, name: true, variant: true, levels: true,
    stories: { select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, arcType: true, text: true, vocab: true } } } });
  if (!j) { console.log("no existe"); return; }
  const orden = j.topics;
  const ss = j.stories.sort((a,b)=> (orden.indexOf(a.topic)-orden.indexOf(b.topic)) || (a.slotIndex-b.slotIndex));
  console.log(`${j.name} ${j.variant} ${JSON.stringify(j.levels)}`);
  for (const s of ss) {
    console.log(`\n── ${s.topic}#${s.slotIndex}  ${s.title}  [${s.arcType ?? "-"}]`);
    if (modo === "resumen") console.log(`   ${s.synopsis ?? ""}`);
    if (modo === "texto") console.log(s.text);
    if (modo === "vocab") console.log("   " + ((s.vocab as Array<{word:string}>)??[]).map(v=>v.word).join(", "));
  }
})().finally(() => prisma.$disconnect());
