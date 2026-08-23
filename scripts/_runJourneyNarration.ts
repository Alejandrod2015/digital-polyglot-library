/**
 * RUNNER genérico de narración para journeys estilo NARRADOR (una sola voz).
 * Recorre las historias del journey SIN audioUrl y las narra con la voz
 * aprobada del cast. Idempotente: re-correrlo retoma donde quedó (nunca pisa
 * audio existente). Todas las voces del CONFIG están en la allowlist
 * (src/lib/approvedVoices.ts), así que el gate runtime las acepta.
 *
 * GATED (ElevenLabs): solo corre si el mensaje del usuario trae el verbo de
 * audio ("genera/lanza/manda audio"). NO ejecutar sin eso ni sin créditos.
 *
 * Uso (tras el reset de cuota, con verbo de audio). OJO: el NODE_OPTIONS es
 * obligatorio, si no `server-only` (vía src/lib/prisma) revienta bajo tsx:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_runJourneyNarration.ts --journey=it-a0
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_runJourneyNarration.ts --journey=ar --limit=3
 * Después, calibrar tempo por oído:
 *   npx tsx scripts/normalizeAudioPace.ts --apply 0.94 <slug>
 *
 * NOTA: Hanseat DE C1 NO está aquí; es multivoz (7 personajes) y necesita su
 * propio voiceMap una vez cerrado el cast.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";

// targetRate (w/s) = ritmo de habla objetivo. Tras renderizar, el runner
// AUTO-aplica normalizeAudioPace para que ninguna historia quede a la velocidad
// cruda de ElevenLabs (para A0 eso sonaba "demasiado rápido"). A0 ≈ 2.7 (= gold
// A0). Sin targetRate, no se ralentiza. Es parte del ESTÁNDAR de narración.
type Cfg = { journeyId: string; voiceId: string; voiceName: string; label: string; targetRate?: number };

const CONFIG: Record<string, Cfg> = {
  "ar": {
    journeyId: "cmrqn1s5s000032tj3kq0gykb", voiceId: "acHf5gp7AGOY30tJjvD4",
    voiceName: "Renzo (argentino)", label: "Friends ES Argentina C1",
  },
  "de-a0": {
    journeyId: "cmqtnagxp0000324lf3u73vg1", voiceId: "Ww7Sq9tx9CCOiNOwWgsx",
    voiceName: "Moritz Morgenstern (alemán)", label: "Traveler DE A0",
  },
  "it-a0": {
    journeyId: "cmrsiz1n40000320d6h8p8f5g", voiceId: "gfKKsLN1k0oYYN9n2dXX",
    voiceName: "Violetta (italiano)", label: "Friends IT A0",
  },
  "es-spain-a0": {
    journeyId: "cmrr5hnbl000032k1esry5n8g", voiceId: "jipeLrCHZ6ByxrU2JP9i",
    voiceName: "Maia (español peninsular)", label: "Friends ES Spain A0", targetRate: 2.4,
  },
  "mx-c1": {
    journeyId: "cmrrrpru1000032nnzsmraa7h", voiceId: "JW8DGEuLp9WxIS5IdxMM",
    voiceName: "Andreti Page (LATAM)", label: "Friends ES Mexico C1",
  },
  "mx-a0": {
    journeyId: "cmrrqjd2n000032nvnp2tryzg", voiceId: "JW8DGEuLp9WxIS5IdxMM",
    voiceName: "Andreti Page (LATAM)", label: "Traveler ES Mexico A0", targetRate: 2.7,
  },
  // 2.85 y no 2.7 como México: elegido de oído el 2026-08-12 sobre el primer
  // párrafo de Copacabana. A 2.7 el estirón ya se oye; a 2.85 el factor es
  // 0.945 y no se nota. El texto largo sale de EL a 3.02, no a 3.59.
  // Narradora: Fernanda, elegida de oído el 2026-08-12 sobre "Duas moedas para
  // Copacabana". Sustituye a Roberta, con la que se rindieron las tres primeras
  // y que quedan descartadas. Fernanda sale de fábrica a 2.49 w/s, o sea que
  // aquí el pacing ACELERA hasta 2.85 en vez de frenar.
  // Violetta narra los DOS journeys italianos: es la única voz italiana
  // aprobada, y el usuario la eligió para este también (2026-08-13).
  // 2.5 y no 2.7: Violetta sale de fábrica a 2.25 w/s, la más lenta de todas
  // las narradoras, así que 2.7 exigía acelerarla un 20% y el usuario lo oyó
  // ("suena un poco acelerada") sobre la primera historia. A 2.5 el factor es
  // 1.11, parecido al que ya funciona en portugués.
  "it-traveler-a0": {
    journeyId: "cmss0fkc40007j8dub1zpa1kc", voiceId: "gfKKsLN1k0oYYN9n2dXX",
    voiceName: "Violetta (italiano)", label: "Traveler IT Italy A0", targetRate: 2.5,
  },
  // 2.70 y no otro: Aurore sale de fábrica a 2.49 w/s y el usuario aprobó de
  // oído la muestra del título y el primer párrafo de "Les premières heures"
  // ya acelerada a 2.70 (2026-08-23), el mismo ritmo del A0 mexicano.
  "fr-a0": {
    journeyId: "cmt09ehi60000320qf9efrypu", voiceId: "ucMmKRQbfDEYyb2IIGax",
    voiceName: "Aurore (francés)", label: "Expat FR France A0", targetRate: 2.7,
  },
  "ptbr-a0": {
    journeyId: "cmsou2uk0000732mqa4oatcmn", voiceId: "7iqXtOF3wl3pomwXFY7G",
    voiceName: "Fernanda (brasileño)", label: "Traveler PT Brazil A0", targetRate: 2.85,
  },
};

const key = process.argv.find((a) => a.startsWith("--journey="))?.split("=")[1];
const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : Infinity;

async function withRetry<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 500 * (i + 1))); }
  }
  throw last;
}

(async () => {
  if (!key || !CONFIG[key]) {
    console.error(`uso: _runJourneyNarration.ts --journey=<${Object.keys(CONFIG).join("|")}> [--limit=N]`);
    process.exit(1);
  }
  const cfg = CONFIG[key];
  const prisma = new PrismaClient();
  // --slug=<slug> re-renderiza UNA historia aunque ya tenga audio. Existe
  // porque re-tirar un segmento borrado de la caché exige volver a pasar por
  // esa historia concreta, y `--limit=1` significa "la primera PENDIENTE",
  // que es otra distinta.
  const slugArg = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
  // --voice=<id> prueba OTRA voz aprobada sin tocar el perfil del journey.
  // assertVoiceApproved sigue mandando: si no está en la allowlist, lanza.
  const voiceArg = process.argv.find((a) => a.startsWith("--voice="))?.split("=")[1];
  if (voiceArg) cfg.voiceId = voiceArg;
  const pending = await prisma.journeyStory.findMany({
    where: slugArg
      ? { journeyId: cfg.journeyId, slug: slugArg }
      : { journeyId: cfg.journeyId, audioUrl: null },
    select: { id: true, slug: true, text: true, title: true, journey: { select: { language: true } } },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  console.log(`${cfg.label} | voz: ${cfg.voiceName} | pendientes: ${pending.length}`);
  let ok = 0, fail = 0, done = 0;
  for (const s of pending) {
    if (done >= limit) break;
    if (!s.text || !s.title) { console.log(`  skip ${s.slug} (sin texto/título)`); continue; }
    done++;
    console.log(`\n=== ${s.slug} ===`);
    try {
      await prisma.journeyStory.update({ where: { id: s.id }, data: { audioStatus: "generating" } });
      // CONFIG DE ORO (2026-07-26): stitching OFF + gate F0 anti-uptalk ON.
      //   · disableStitching: true  → previous_text off + next_text=" " → SIN
      //     respiración de costura ("aire"). El aire lo causa el stitching
      //     (feedback_tts_aire_stitching); era uno de los problemas grandes.
      //   · antiUptalkGate: true    → el gate F0 por PÁRRAFO cierra los finales
      //     re-tirando los que floten. Reemplaza el rol del stitching de cerrar
      //     la prosodia, así que ya NO hace falta el stitching para eso.
      // Resultado: sin aire Y con finales afirmativos. Verificado por F0
      // (finales −4..−8.5) y por oído del usuario (sin respiración tras "paseo").
      const result = await generateAndUploadMultiVoiceAudio({
        storyText: s.text, title: s.title, voiceMap: { narrator: cfg.voiceId },
        language: s.journey.language ?? "spanish",
        disableStitching: true, antiUptalkGate: true,
      } as any);
      if (!result) throw new Error("multi-voice returned null");
      await withRetry(() => prisma.journeyStory.update({
        where: { id: s.id },
        data: {
          audioUrl: result.url, audioSegments: result.audioSegments as any, audioFilename: result.filename,
          audioStatus: "ready", voiceId: cfg.voiceId,
          audioQaStatus: result.audioQa?.status ?? null, audioQaScore: result.audioQa?.score ?? null,
          audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
          ...(result.fragments?.length ? { audioFragments: result.fragments as object } : {}),
        },
        select: { id: true },
      }));
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
  console.log(`\nTOTAL ${cfg.label}: ok=${ok} fail=${fail} (de ${Math.min(pending.length, limit)})`);
  await prisma.$disconnect();

  // ── ESTÁNDAR: auto-ralentizar al ritmo objetivo ────────────────────────
  // El render sale a la velocidad cruda de ElevenLabs (~3.3 w/s), que para A0
  // suena "demasiado rápido". Aplicar el tempo NO puede ser un paso manual que
  // se olvide: el runner lo hace SIEMPRE si el journey define targetRate. Reusa
  // el tool probado (normalizeAudioPace, ffmpeg, sin créditos). Idempotente:
  // mide el ritmo actual y aplica target/current; re-correr salta "ya en objetivo".
  if (cfg.targetRate && ok > 0) {
    const slugs = pending.map((s) => s.slug).filter(Boolean) as string[];
    console.log(`\n[pace] ESTÁNDAR: auto-aplicando targetRate=${cfg.targetRate} w/s a ${slugs.length} historias...`);
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync("npx", ["tsx", "scripts/normalizeAudioPace.ts", "--apply", String(cfg.targetRate), ...slugs], {
      stdio: "inherit",
      env: { ...process.env, NODE_OPTIONS: "--conditions=react-server" },
    });
    if (r.status !== 0) console.warn("[pace] AVISO: auto-pace falló; correr a mano: normalizeAudioPace.ts --apply " + cfg.targetRate);
  }
})().catch((e) => { console.error(e); process.exit(1); });
