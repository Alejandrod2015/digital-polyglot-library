/** Devuelve a su toma ORIGINAL las secciones que emparejaRitmo estiro. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { id: true, audioFragments: true } });
  if (!s) throw new Error(`no encuentro ${slug}`);
  const frags = (s.audioFragments as any[]) ?? [];
  const pedidos = process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
  const idx = frags.map((f, i) => ({ f, i }))
    .filter(({ f, i }) => f?.prevUrl && String(f.url).includes("_re") && (!pedidos.length || pedidos.includes(i)))
    .map(({ i }) => i);
  if (!idx.length) { console.log("nada estirado"); await prisma.$disconnect(); return; }
  const { revertSection } = await import("../src/lib/audioEditorSections");
  for (const i of idx) { await revertSection({ storyId: s.id, fragmentIndex: i }); console.log(`  [${i}] devuelta a la toma original`); }
  const { generateWordTimingsForStory } = await import("../src/lib/audioWordTimings");
  await generateWordTimingsForStory(s.id);
  console.log("re-alineado");
  await prisma.$disconnect();
})();
