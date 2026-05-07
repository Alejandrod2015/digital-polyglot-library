/**
 * Detecta drift entre el catálogo de voces y lo realmente casteado en
 * producción. Dos clases de drift que matan auditorías silenciosamente:
 *
 *   1. UNCATALOGUED: voces que aparecen en `JourneyStory.dialogueSpec`
 *      o `JourneyStory.voiceId` pero NO existen en VOICE_CATALOG.
 *      Ejemplo histórico: las dos chatterbox/clone-* del cast original
 *      de Carnitas/Tinto que vivían fuera del catálogo y por eso el
 *      sistema de tags era ciego a ellas.
 *
 *   2. CASTED-BUT-DISCARDED: voces que el catálogo marca como
 *      `status: discarded` (con razón documentada) pero que siguen
 *      vivas en producción. Ejemplo histórico: Liam en
 *      cafe-in-kreuzberg, descartado por "acento gringo se cuela en
 *      eleven_multilingual_v2" y casteado igual hasta el fix.
 *
 * También reporta voces casteadas como `unverified` (no es drift
 * pero sí señal de que el casting se hizo a ciegas y conviene
 * auditar antes de regenerar.)
 *
 * Sin side-effects. Corre con: `npx tsx scripts/auditProductionVoiceDrift.ts`
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { VOICE_CATALOG } from "../src/lib/voiceCatalog";

config({ path: ".env.local" });
config({ path: ".env" });

type Segment = { text?: string; voice?: string; speaker?: string };

async function main() {
  const prisma = new PrismaClient();

  const stories = await prisma.journeyStory.findMany({
    select: {
      slug: true,
      title: true,
      voiceId: true,
      dialogueSpec: true,
      audioStatus: true,
      journey: { select: { language: true, variant: true } },
    },
  });

  // Map voiceId → list of (slug, segmentIndex)
  type Hit = { slug: string; title: string; segmentIndex: number | null; language: string };
  const usage = new Map<string, Hit[]>();
  function record(voiceId: string, hit: Hit) {
    let arr = usage.get(voiceId);
    if (!arr) {
      arr = [];
      usage.set(voiceId, arr);
    }
    arr.push(hit);
  }

  for (const s of stories) {
    const slug = s.slug ?? "(no-slug)";
    const title = s.title ?? "(untitled)";
    const language = s.journey?.language ?? "?";
    if (s.voiceId) {
      record(s.voiceId, { slug, title, segmentIndex: null, language });
    }
    if (Array.isArray(s.dialogueSpec)) {
      const segs = s.dialogueSpec as unknown as Segment[];
      segs.forEach((seg, i) => {
        if (typeof seg.voice === "string" && seg.voice.trim()) {
          record(seg.voice.trim(), { slug, title, segmentIndex: i, language });
        }
      });
    }
  }

  const catalogIds = new Set(VOICE_CATALOG.map((v) => v.id));
  const catalogById = new Map(VOICE_CATALOG.map((v) => [v.id, v]));

  const uncatalogued: Array<{ voiceId: string; usage: number; sampleSlugs: string[] }> = [];
  const discardedButCasted: Array<{ voiceId: string; reason: string; usage: number; sampleSlugs: string[] }> = [];
  const unverifiedCasted: Array<{ voiceId: string; usage: number; sampleSlugs: string[] }> = [];

  for (const [voiceId, hits] of usage) {
    const slugs = Array.from(new Set(hits.map((h) => h.slug))).slice(0, 5);
    if (!catalogIds.has(voiceId)) {
      // F5 cloned voices use ids like `f5/<cuid>` and llegan dinámicamente
      // del endpoint `/api/studio/audio/voices`; las ignoramos aquí.
      if (voiceId.startsWith("f5/")) continue;
      uncatalogued.push({ voiceId, usage: hits.length, sampleSlugs: slugs });
      continue;
    }
    const entry = catalogById.get(voiceId)!;
    if (entry.status === "discarded") {
      discardedButCasted.push({
        voiceId,
        reason: entry.reason ?? "(sin razón documentada)",
        usage: hits.length,
        sampleSlugs: slugs,
      });
    }
    if (entry.accentTags?.includes("unverified")) {
      unverifiedCasted.push({ voiceId, usage: hits.length, sampleSlugs: slugs });
    }
  }

  console.log("== UNCATALOGUED — en producción pero fuera del catálogo (corrige catálogo) ==");
  if (uncatalogued.length === 0) {
    console.log("  (clean)");
  } else {
    for (const u of uncatalogued) {
      console.log(`  🔴 ${u.voiceId}  (${u.usage} segmentos)`);
      console.log(`     stories: ${u.sampleSlugs.join(", ")}`);
    }
  }

  console.log("\n== DISCARDED-BUT-CASTED — voz rechazada sigue casteada (regen con reemplazo) ==");
  if (discardedButCasted.length === 0) {
    console.log("  (clean)");
  } else {
    for (const d of discardedButCasted) {
      console.log(`  🔴 ${d.voiceId}  (${d.usage} segmentos)`);
      console.log(`     razón rechazo: ${d.reason}`);
      console.log(`     stories: ${d.sampleSlugs.join(", ")}`);
    }
  }

  console.log("\n== UNVERIFIED-CASTED — casteada pero accent sin auditar (escuchar antes de regen) ==");
  if (unverifiedCasted.length === 0) {
    console.log("  (clean)");
  } else {
    for (const u of unverifiedCasted) {
      console.log(`  🟡 ${u.voiceId}  (${u.usage} segmentos)`);
      console.log(`     stories: ${u.sampleSlugs.join(", ")}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
