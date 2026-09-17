/**
 * Publica el Traveler FR/france A1: pasa las 21 historias a `published` y el
 * journey a `active`, todo o nada.
 *
 * Repite los gates VIGENTES de /api/studio/journeys/publish (route.ts):
 *   1. continuidad: un `mini-cliffhanger` no puede ser el ultimo slot de su tema.
 *   2. audio de practica: `meaning_in_context` necesita wordClipUrl y
 *      `fill_blank` necesita clipUrl. NO se exige la frase del meaning
 *      (2026-08-24): esa tarjeta reproduce la palabra, nunca la frase. El
 *      script del italiano (_publishItA0.ts) es anterior y aun la pedia.
 * Ademas: texto, titulo, narracion y portada en las 21.
 *
 *   npx tsx scripts/_publishA1France.ts --dry
 *   npx tsx scripts/_publishA1France.ts --apply
 * Despues de --apply: npx tsx scripts/setJourneyStatus.ts --revalidate
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY_ID = "cmtwz1iop000l32jybeo2jg4x";
const apply = process.argv.includes("--apply");

(async () => {
  const prisma: any = new PrismaClient();
  const j = await prisma.journey.findUnique({ where: { id: JOURNEY_ID }, select: { status: true, language: true, variant: true, levels: true } });
  const stories = await prisma.journeyStory.findMany({ where: { journeyId: JOURNEY_ID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  const blocking: string[] = [];
  if (stories.length !== 21) blocking.push(`hay ${stories.length} historias, no 21`);
  for (const s of stories) {
    if (!s.text || !s.title) blocking.push(`${s.slug}: sin texto o titulo`);
    if (!s.audioUrl) blocking.push(`${s.slug}: sin narracion`);
    if (!s.coverUrl) blocking.push(`${s.slug}: sin portada`);
    if (s.arcType === "mini-cliffhanger") {
      const later = stories.find((o: any) => o.topic === s.topic && o.level === s.level && o.slotIndex > s.slotIndex);
      if (!later) blocking.push(`${s.slug}: mini-cliffhanger en el ultimo slot de ${s.topic}`);
    }
    const set = await prisma.storyPracticeSet.findFirst({ where: { storyId: s.id }, include: { exercises: true } });
    if (!set) { blocking.push(`${s.slug}: sin set de practica`); continue; }
    const missing: string[] = [];
    for (const e of set.exercises) {
      const clip = (e.payload as any)?.audioClip;
      if (e.type === "meaning_in_context" && !clip?.wordClipUrl) missing.push(`${e.word} (palabra)`);
      if (e.type === "fill_blank" && !clip?.clipUrl) missing.push(`${e.word} (frase)`);
    }
    if (missing.length) blocking.push(`${s.slug}: audio de practica ${missing.join(", ")}`);
  }
  console.log(`journey: ${j?.language}/${j?.variant} ${JSON.stringify(j?.levels)} status=${j?.status} · historias: ${stories.length}`);
  if (blocking.length) {
    console.log(`\nBLOQUEADO (${blocking.length}):`); for (const b of blocking) console.log("  · " + b);
    await prisma.$disconnect(); process.exit(1);
  }
  console.log("pasan los gates: continuidad, audio de practica, texto, narracion y portada");
  if (!apply) { console.log("\n--dry: no se escribio nada."); await prisma.$disconnect(); return; }
  const r = await prisma.journeyStory.updateMany({ where: { journeyId: JOURNEY_ID }, data: { status: "published", error: null } });
  await prisma.journey.update({ where: { id: JOURNEY_ID }, data: { status: "active" } });
  console.log(`\npublicadas ${r.count} historias; journey -> active`);
  console.log("FALTA: npx tsx scripts/setJourneyStatus.ts --revalidate (sin esto la app no lo ve)");
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
