/** Resuelve el paquete igual que la pagina y tokeniza el cuerpo con la MISMA
 *  regla del lector: cuantas palabras se quedarian muertas al tocarlas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as unknown as { cache: Record<string, unknown> }).cache[q] = { id: q, filename: q, loaded: true, exports: {} }; } catch {}
import { PrismaClient } from "../../../src/generated/prisma";
import { getTapGlossesForSlug } from "../../../src/lib/tapGlosses";
const p = new PrismaClient();
const TAPPABLE = /\p{L}+(?:-\p{L}+)*/gu;
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt70xfyt000l3283gxd70wck" }, select: { slug: true, title: true, text: true } });
  let muertas = 0, total = 0;
  for (const s of st) {
    const g = getTapGlossesForSlug(s.slug!);
    if (!g) { console.log(`SIN PAQUETE: ${s.slug}`); continue; }
    const faltan: string[] = [];
    for (const src of [s.title ?? "", s.text ?? ""]) for (const m of src.matchAll(TAPPABLE)) {
      total++; if (!g[m[0].toLowerCase()]) { muertas++; faltan.push(m[0]); }
    }
    if (faltan.length) console.log(`${s.slug}: ${faltan.join(" ")}`);
  }
  console.log(`\n${muertas}/${total} palabras muertas al tocarlas (${((muertas / total) * 100).toFixed(1)}%)`);
})().finally(() => p.$disconnect());
