/**
 * Publica el Friends FR A0 (france): pasa las 21 historias a `published` y el
 * journey a `active`, todo o nada. Copia del molde del B1 latam
 * (_publishB1Latam.ts, 2026-09-10) con el journey cambiado y UN gate mas.
 *
 * Repite los gates VIGENTES de /api/studio/journeys/publish (route.ts):
 *   1. continuidad: un `mini-cliffhanger` no puede ser el ultimo slot de su tema.
 *   2. audio de practica: `meaning_in_context` necesita wordClipUrl y
 *      `fill_blank` necesita clipUrl. NO se exige la frase del meaning
 *      (2026-08-24): esa tarjeta reproduce la palabra, nunca la frase.
 * Ademas: texto, titulo, narracion y portada en las 21.
 *
 * GATE NUEVO frente al molde: el selector de variantes. El B1 latam iba a una
 * variante que la app ya emparejaba; este es el PRIMER journey frances vivo, y
 * activar una variante que el selector no encuentra se ve como "No journeys
 * available", igual que el portugues el 2026-08-13. Se comprueba ANTES de
 * escribir, con el mismo checkSelectorFindsVariant que usa setJourneyStatus.
 *
 *   npx tsx scripts/_publishFrA0.ts --dry
 *   npx tsx scripts/_publishFrA0.ts --apply
 * Despues de --apply: npx tsx scripts/setJourneyStatus.ts --revalidate
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { checkSelectorFindsVariant } from "./selectorVariants";

const JOURNEY_ID = "cmtwo6cys0007j8yzg6ni3fsc";
const apply = process.argv.includes("--apply");

(async () => {
  const prisma: any = new PrismaClient();
  const j = await prisma.journey.findUnique({ where: { id: JOURNEY_ID }, select: { status: true, language: true, variant: true, levels: true } });
  const stories = await prisma.journeyStory.findMany({ where: { journeyId: JOURNEY_ID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  const blocking: string[] = [];
  if (stories.length !== 21) blocking.push(`hay ${stories.length} historias, no 21`);
  const sel = checkSelectorFindsVariant(j?.language ?? "", j?.variant ?? "");
  if (!sel.ok) blocking.push(`el selector de la app no encontraria ${j?.language}/${j?.variant}: ${sel.reason}`);
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
  if (sel.ok) console.log(`selector: lo encuentra (${sel.reason})`);
  if (blocking.length) {
    console.log(`\nBLOQUEADO (${blocking.length}):`); for (const b of blocking) console.log("  · " + b);
    await prisma.$disconnect(); process.exit(1);
  }
  console.log("pasan los gates: selector, continuidad, audio de practica, texto, narracion y portada");
  if (!apply) { console.log("\n--dry: no se escribio nada."); await prisma.$disconnect(); return; }
  const r = await prisma.journeyStory.updateMany({ where: { journeyId: JOURNEY_ID }, data: { status: "published", error: null } });
  await prisma.journey.update({ where: { id: JOURNEY_ID }, data: { status: "active" } });
  console.log(`\npublicadas ${r.count} historias; journey -> active`);
  console.log("FALTA: npx tsx scripts/setJourneyStatus.ts --revalidate (sin esto la app no lo ve)");
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
