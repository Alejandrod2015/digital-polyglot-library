/**
 * RUNNER de narración Friends ES Argentina C1 (Renzo, APROBADO).
 * Busca las historias SIN audioUrl y las narra una por una, reusando el
 * script per-slug `_genFriendsARStoryAudio.ts` (que ya salta las ya narradas
 * y usa Renzo). Idempotente: re-correrlo retoma donde quedó.
 *
 * GATED (ElevenLabs): solo corre si el mensaje del usuario trae el verbo de
 * audio ("genera/lanza/manda audio"). NO ejecutar sin eso ni sin créditos.
 *
 * Uso (tras el reset de cuota 22/07, con verbo de audio):
 *   npx tsx scripts/_runARNarration.ts
 * Después, calibrar tempo por oído:
 *   npx tsx scripts/normalizeAudioPace.ts --apply 0.94 <slug>   (por historia)
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { execSync } from "node:child_process";

const JOURNEY_ID = "cmrqn1s5s000032tj3kq0gykb";

(async () => {
  const p = new PrismaClient();
  const pending = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY_ID, audioUrl: null },
    select: { slug: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  await p.$disconnect();
  console.log(`pendientes de narrar: ${pending.length}`);
  let ok = 0, fail = 0;
  for (const { slug } of pending) {
    console.log(`\n=== narrando ${slug} ===`);
    try {
      execSync(`npx tsx scripts/_genFriendsARStoryAudio.ts ${slug}`, { stdio: "inherit" });
      ok++;
    } catch (e) {
      fail++;
      console.error(`FALLÓ ${slug}: ${(e as Error).message?.slice(0, 120)}`);
    }
  }
  console.log(`\nTOTAL narración: ok=${ok} fail=${fail} (de ${pending.length})`);
})().catch((e) => { console.error(e); process.exit(1); });
