import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

/** ¿Cuántas historias live+draft tienen un dialogueSpec cuyo texto YA NO
 *  coincide con el body? (deriva tras editar el texto). Solo lectura. */
async function run() {
  const prisma = new PrismaClient();
  const journeys = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: {
      name: true, status: true, language: true,
      stories: { select: { slug: true, title: true, text: true, dialogueSpec: true } },
    },
  });
  let withSpec = 0, drifted = 0;
  for (const j of journeys) {
    for (const s of j.stories) {
      const spec = s.dialogueSpec as Array<{ text?: string }> | null;
      if (!Array.isArray(spec) || spec.length === 0) continue;
      withSpec++;
      const body = String(s.text ?? "");
      const bad = spec.filter((seg) => seg?.text && !body.includes(String(seg.text).trim()));
      if (bad.length) {
        drifted++;
        console.log(`[${j.status}] ${j.name} (${j.language}) — ${s.title} [${s.slug}] : ${bad.length}/${spec.length} segmentos desfasados`);
        console.log(`    ej: ${JSON.stringify(String(bad[0].text).slice(0, 90))}`);
      }
    }
  }
  console.log(`\nhistorias con dialogueSpec: ${withSpec} | con deriva texto<->spec: ${drifted}`);
  await prisma.$disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
