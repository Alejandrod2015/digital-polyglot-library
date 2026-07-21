/**
 * RUNNER de narración MULTIVOZ para Hanseat DE C1.
 * 18 hablantes distintos en 21 historias (7 recurrentes + puntuales). Todas
 * las voces del mapa están en la allowlist (src/lib/approvedVoices.ts).
 *
 * Trae un PRE-FLIGHT que, antes de gastar un solo crédito:
 *   1) verifica que TODO speaker del dialogueSpec tenga voz asignada;
 *   2) verifica que dentro de una misma historia no haya dos personajes
 *      distintos compartiendo voz (Boysen/Fiete comparten Charlie a propósito,
 *      pero nunca coinciden; si alguna vez coincidieran, aborta).
 * Si algo falla, NO narra nada y lista el problema.
 *
 * GATED (ElevenLabs): requiere el verbo de audio del usuario + créditos.
 *
 * Uso (el NODE_OPTIONS es obligatorio; si no, `server-only` revienta bajo tsx):
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_runHanseatNarration.ts --check
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_runHanseatNarration.ts [--limit=N]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";

const JOURNEY_ID = "cmrdbz11t000032asrvo832i9";

const MORITZ = "Ww7Sq9tx9CCOiNOwWgsx";       // narrador (m)
const ELA_WARM = "SJJe86Va82zRzg6zi2dX";     // f
const ENNIAH = "WHaUUVTDq47Yqc9aDbkH";       // f
const DAIEN = "9iYBWBbTzTDIt6imiMxp";        // f
const ELA_CHEER = "NE7AIW5DoJ7lUosXV2KR";    // f (puntuales)
const MARIUS = "JDXBO1etYlVlJZRMoYzH";       // m joven
const BEN = "MMwckqU477oQxnAk1SgA";          // m adulto
const CHARLIE = "vmVmHDKBkkCgbLVIOJRb";      // m adulto

/** speaker (tal cual aparece en dialogueSpec) -> voiceId aprobado */
const VOICE_MAP: Record<string, string> = {
  narrator: MORITZ,
  // recurrentes
  Nora: ELA_WARM, Ole: MARIUS, Wiebke: ENNIAH, Merle: DAIEN,
  Carstens: BEN, Boysen: CHARLIE, Fiete: CHARLIE,
  // femeninas puntuales
  Grit: ELA_CHEER, Sofia: ELA_CHEER, "Verkäuferin": ELA_CHEER,
  // masculinos puntuales
  Greve: CHARLIE, Timm: CHARLIE, Mann: CHARLIE, Kunde: CHARLIE,
  Schreier: CHARLIE, Voss: CHARLIE, Dose: BEN, // Dose comparte historia con Fiete
};

const checkOnly = process.argv.includes("--check");
const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : Infinity;

(async () => {
  const prisma = new PrismaClient();
  const all = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY_ID },
    select: { id: true, slug: true, title: true, text: true, audioUrl: true, dialogueSpec: true,
              journey: { select: { language: true } } },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  // ── PRE-FLIGHT ──
  const problems: string[] = [];
  for (const s of all) {
    const ds: any = s.dialogueSpec;
    const speakers: string[] = Array.isArray(ds)
      ? [...new Set(ds.map((d: any) => d.speaker).filter(Boolean))] as string[]
      : [];
    const seen = new Map<string, string>(); // voiceId -> speaker
    for (const sp of speakers) {
      const v = VOICE_MAP[sp];
      if (!v) { problems.push(`${s.slug}: speaker SIN VOZ -> "${sp}"`); continue; }
      const prev = seen.get(v);
      if (prev && prev !== sp) problems.push(`${s.slug}: "${prev}" y "${sp}" comparten la misma voz`);
      seen.set(v, sp);
    }
  }
  console.log(`pre-flight: ${all.length} historias, ${problems.length} problema(s)`);
  for (const p of problems) console.log(`  ${p}`);
  if (problems.length) { console.error("\nABORTA: arregla VOICE_MAP antes de narrar."); await prisma.$disconnect(); process.exit(1); }
  console.log("pre-flight OK: todos los speakers tienen voz y no hay colisiones.");
  if (checkOnly) { await prisma.$disconnect(); return; }

  const pending = all.filter((s) => !s.audioUrl);
  console.log(`\npendientes de narrar: ${pending.length}`);
  let ok = 0, fail = 0, done = 0;
  for (const s of pending) {
    if (done >= limit) break;
    if (!s.text || !s.title) { console.log(`  skip ${s.slug}`); continue; }
    done++;
    console.log(`\n=== ${s.slug} ===`);
    try {
      await prisma.journeyStory.update({ where: { id: s.id }, data: { audioStatus: "generating" } });
      const result = await generateAndUploadMultiVoiceAudio({
        storyText: s.text, title: s.title, voiceMap: VOICE_MAP,
        language: s.journey.language ?? "german", disableStitching: true,
      } as any);
      if (!result) throw new Error("multi-voice returned null");
      await prisma.journeyStory.update({
        where: { id: s.id },
        data: {
          audioUrl: result.url, audioSegments: result.audioSegments as any, audioFilename: result.filename,
          audioStatus: "ready", voiceId: MORITZ,
          audioQaStatus: result.audioQa?.status ?? null, audioQaScore: result.audioQa?.score ?? null,
          audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
          ...(result.fragments?.length ? { audioFragments: result.fragments as object } : {}),
        },
        select: { id: true },
      });
      console.log(`  master: ${result.url}`);
      try { await generateWordTimingsForStory(s.id); console.log("  alignment OK"); }
      catch (e: any) { console.warn(`  alignment FAILED: ${e.message?.slice(0, 120)}`); }
      ok++;
    } catch (e: any) {
      fail++;
      console.error(`  FALLÓ: ${e.message?.slice(0, 160)}`);
      await prisma.journeyStory.update({ where: { id: s.id }, data: { audioStatus: "pending" } }).catch(() => {});
    }
  }
  console.log(`\nTOTAL Hanseat: ok=${ok} fail=${fail}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
