/** Corre los gates DE CONJUNTO sobre el journey entero.
 *
 *  `journey-vocab-worth-teaching` y la escalera de recirculacion son de
 *  conjunto: cierraTema solo ve tres historias y los deja pendientes. Para
 *  saber si el journey pasa hay que darle las veintiuna de una vez.
 *
 *  Solo lee. */
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const s = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[s] = { id: s, filename: s, loaded: true, exports: {} };
} catch { /* noop */ }

import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { validateJourneyStories, type JourneyStoryInput } from "../../src/lib/validateJourneyStories";

const p = new PrismaClient();

(async () => {
  const journeyId = process.argv[2];
  const j = await p.journey.findFirst({
    where: { id: journeyId }, select: { topics: true, levels: true, language: true, variant: true },
  });
  const hs = await p.journeyStory.findMany({
    where: { journeyId },
    select: { slug: true, topic: true, slotIndex: true, title: true, text: true, vocab: true, arcType: true, synopsis: true },
  });
  const orden = (j?.topics ?? []) as string[];
  hs.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const language = j?.language ?? "spanish";
  const level = (j?.levels ?? ["b1"])[0];
  const entrada = hs.map((h) => ({
    slug: String(h.slug ?? `${h.topic}#${h.slotIndex}`),
    title: String(h.title ?? ""),
    text: String(h.text ?? ""),
    vocab: h.vocab as never,
    language, level, topic: h.topic,
  })) as unknown as JourneyStoryInput[];

  // conjuntoCompleto: estan las veintiuna, asi que los checks de conjunto se
  // pronuncian en vez de quedarse pendientes.
  const checks = validateJourneyStories(entrada, { language, level, conjuntoCompleto: true } as never);
  let mal = 0;
  for (const c of checks) {
    if (c.status === "pass" && !/worth-teaching|recirculation|level-floor/.test(c.id)) continue;
    if (c.status === "fail") mal++;
    console.log(`${c.status.toUpperCase().padEnd(5)} [${c.id}] ${c.detail ?? c.label ?? ""}`);
  }
  console.log(`\n${checks.length} checks de conjunto · ${mal} fallando`);
  await p.$disconnect();
})();
