import { config } from "dotenv"; config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

// paths relativos no valen desde el scratchpad; se corre con cwd=worktree y tsx resuelve el alias? No: usar ruta absoluta via tsconfig no aplica. Este archivo se copia a scripts/_tmp si falla.
const p = new PrismaClient();
(async () => {
  const b1 = await p.journey.findUnique({ where: { id: "cmt5x67ze000l320cpgunu5vi" } });
  console.log("B1 SPAIN:", JSON.stringify({ id: b1?.id, name: b1?.name, variant: b1?.variant, levels: b1?.levels, status: b1?.status, topics: b1?.topics, next: b1?.nextJourneyId }, null, 1));
  const stories = await p.journeyStory.findMany({
    where: { journeyId: b1!.id }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { topic: true, slotIndex: true, status: true, title: true, slug: true, synopsis: true },
  });
  for (const s of stories) console.log(`${s.topic} #${s.slotIndex} [${s.status}] ${s.title ?? "-"}`);
  // sinopsis del primer y ultimo tema para ver espina y reparto
  for (const s of stories.filter(x => x.synopsis)) console.log(`\n== ${s.topic}#${s.slotIndex} ${s.title}\n${s.synopsis}`);
  // temas ya usados en espanol (live+draft)
  const otros = await p.journey.findMany({ where: { language: "spanish", status: { in: ["active", "draft"] as any } }, select: { name: true, variant: true, levels: true, topics: true } });
  const usados = [...new Set(otros.flatMap(j => j.topics))];
  const labels = await p.topic.findMany({ where: { slug: { in: usados } }, select: { slug: true, label: true } });
  console.log("\nTEMAS ES (live+draft):");
  for (const l of labels) console.log(`  ${l.slug} = "${l.label}"`);
  await p.$disconnect();
})();
