/**
 * Publica el journey Traveler IT Italy A0: pasa las 21 historias a
 * `published` y el journey a `active`.
 *
 * POR QUÉ UN SCRIPT Y NO EL ENDPOINT: /api/studio/journeys/publish exige
 * sesión de Clerk con membresía de studio, que no existe en la terminal. Para
 * no perder los controles, este script REPITE LOS DOS GATES del endpoint
 * (route.ts, líneas 39-105) contra la misma base:
 *   1. continuidad: una historia `mini-cliffhanger` no puede ser el último
 *      slot de su tema.
 *   2. audio de práctica: `meaning_in_context` necesita clipUrl + wordClipUrl,
 *      y `fill_blank` necesita clipUrl. Sin esto suena mudo en el móvil.
 * Si algo falla, NO escribe nada: o entran las 21 o no entra ninguna.
 *
 *   npx tsx scripts/_publishItA0.ts --dry     (solo comprueba)
 *   npx tsx scripts/_publishItA0.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY_ID = "cmss0fkc40007j8dub1zpa1kc";
const apply = process.argv.includes("--apply");

(async () => {
  const prisma: any = new PrismaClient();
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY_ID },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  const blocking: string[] = [];
  for (const s of stories) {
    if (!s.text || !s.title) blocking.push(`${s.slug}: sin texto o título`);
    if (!s.audioUrl) blocking.push(`${s.slug}: sin narración`);
    if (!s.coverUrl) blocking.push(`${s.slug}: sin portada`);

    if (s.arcType === "mini-cliffhanger") {
      const later = stories.find(
        (o: any) => o.topic === s.topic && o.level === s.level && o.slotIndex > s.slotIndex
      );
      if (!later) blocking.push(`${s.slug}: mini-cliffhanger en el último slot de ${s.topic}`);
    }

    const set = await prisma.storyPracticeSet.findFirst({
      where: { storyId: s.id },
      include: { exercises: true },
    });
    if (!set) {
      blocking.push(`${s.slug}: sin set de práctica`);
      continue;
    }
    const missing: string[] = [];
    for (const e of set.exercises) {
      const clip = (e.payload as any)?.audioClip;
      if (e.type === "meaning_in_context") {
        if (!clip?.clipUrl) missing.push(`${e.word} (frase)`);
        if (!clip?.wordClipUrl) missing.push(`${e.word} (palabra)`);
      } else if (e.type === "fill_blank") {
        if (!clip?.clipUrl) missing.push(`${e.word} (frase)`);
      }
    }
    if (missing.length) blocking.push(`${s.slug}: audio de práctica ${missing.join(", ")}`);
  }

  console.log(`historias: ${stories.length}`);
  if (blocking.length) {
    console.log(`\nBLOQUEADO (${blocking.length}):`);
    for (const b of blocking) console.log("  · " + b);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log("los dos gates pasan: continuidad y audio de práctica");

  if (!apply) {
    console.log("\n--dry: no se escribió nada. Repetir con --apply.");
    await prisma.$disconnect();
    return;
  }

  const r = await prisma.journeyStory.updateMany({
    where: { journeyId: JOURNEY_ID },
    data: { status: "published", error: null },
  });
  await prisma.journey.update({ where: { id: JOURNEY_ID }, data: { status: "active" } });
  console.log(`\npublicadas ${r.count} historias; journey → active`);
  // Esto decía "la caché es de 5 min, puede tardar en verse". Era falso y
  // costó una tarde: el tag `published-journey-stories` NO se invalida al
  // cambiar el estado de un journey, así que la app se quedó sirviendo la
  // respuesta vacía de cuando era borrador, sin caducar sola.
  console.log("\n⚠  FALTA UN PASO: la app NO lo verá hasta invalidar la caché del lector.");
  console.log("   npx tsx scripts/setJourneyStatus.ts --revalidate");
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
