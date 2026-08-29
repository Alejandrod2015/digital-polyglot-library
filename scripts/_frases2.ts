/** Volcado por frases de una historia, con las palabras que tienen glosa.
 *  Igual que _frasesDb.ts pero sin pasar por src/lib/tapGlosses, que lleva
 *  `server-only` y revienta bajo tsx.
 *  npx tsx scripts/_frases2.ts <bundle> <slug> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [bundle, slug] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  const c = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug } } });
  type E = { g: string; t?: string; c?: unknown };
  const mapa: Record<string, E> = { ...(g!.glosses as Record<string, E>), ...((c?.glosses ?? {}) as Record<string, E>) };
  const plano = `${s!.title}. ${s!.text}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const frases = plano.split(/(?<=[.!?”])\s+/).map((f) => f.trim()).filter(Boolean);
  const visto = new Set<string>();
  frases.forEach((f, i) => {
    const ws = (f.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => mapa[w] && !mapa[w].c && !visto.has(w));
    ws.forEach((w) => visto.add(w));
    if (ws.length) console.log(`[${i}] ${f}\n     ${ws.map((w) => `${w}=${mapa[w].g}`).join(" | ")}`);
  });
  console.log(`TOTAL ${visto.size} sin trozo en ${frases.length} frases`);
  await p.$disconnect();
})();
