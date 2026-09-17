/** Palabras tocables sin contexto de UNA historia, con su glosa global:
 *  npx tsx scripts/_b2/_huecosHistoria.ts <bundle> <slug> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const TAPPABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const p = new PrismaClient();
(async () => {
  const [bundle, slug] = process.argv.slice(2);
  const global = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } }))!.glosses as Record<string, { g?: string; t?: string }>;
  const fila = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug } } }))?.glosses as Record<string, any> ?? {};
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
  const faltan = new Set<string>();
  for (const m of `${s!.title}. ${s!.text}`.matchAll(TAPPABLE)) {
    const k = m[0].toLowerCase();
    if (!global[k]) continue;
    if (!fila[k]?.c) faltan.add(k);
  }
  for (const k of [...faltan].sort()) console.log(`${k}\t${global[k]?.g}\t(${global[k]?.t})`);
  console.log(`\ntotal: ${faltan.size}`);
  await p.$disconnect();
})();
