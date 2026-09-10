/**
 * QUITA EL RESTO DE LA TOMA VIEJA que un empalme dejo en la costura.
 *
 * Cuando se sustituye una seccion por otra de distinta duracion, el corte usa
 * los [startSec,endSec] guardados. Si esos tiempos describen la toma ANTERIOR,
 * el corte se queda corto y la cola de la vieja sobrevive pegada a la nueva:
 * en los-changarines se oia "ofrece, apurada, apurada". Aqui se re-miden las
 * fronteras contra el master de verdad (_remeasureFragments) y se vuelve a
 * empalmar la MISMA seccion, que ahora si corta el tramo entero.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_limpiaCostura.ts <slug> <i> [i...]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { execFileSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const idx = process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
  if (!slug || !idx.length) throw new Error("uso: _limpiaCostura.ts <slug> <i> [i...]");
  execFileSync("npx", ["tsx", "scripts/_remeasureFragments.ts", slug, "--apply"], { stdio: "inherit" });

  const { replaceSectionAndRebuild } = await import("../src/lib/audioEditorSections");
  for (const i of idx) {
    const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { id: true, audioFragments: true } });
    const f = ((s!.audioFragments as any[]) ?? [])[i];
    const buf = Buffer.from(await (await fetch(String(f.url))).arrayBuffer());
    await replaceSectionAndRebuild({ storyId: s!.id, fragmentIndex: i, newSectionBuffer: buf, normalizeSection: false });
    console.log(`  [${i}] costura limpiada`);
  }
  const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { id: true } });
  const { generateWordTimingsForStory } = await import("../src/lib/audioWordTimings");
  await generateWordTimingsForStory(s!.id);
  console.log("re-alineado");
  await prisma.$disconnect();
})();
