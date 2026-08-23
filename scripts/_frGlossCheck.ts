/**
 * Comprueba el lookup del Expat FR A0 sin pasar por el lector: resuelve el
 * bundle igual que la pagina (`getTapGlossesForSlug`) y tokeniza el cuerpo con
 * la MISMA regla del reader (`\p{L}+(?:-\p{L}+)*`), que es donde estaba el
 * agujero del italiano. Dice cuantas palabras quedarian muertas al tocarlas.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as unknown as { cache: Record<string, unknown> }).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
import { getTapGlossesForSlug } from "../src/lib/tapGlosses";
const p = new PrismaClient();
const TAPPABLE = /\p{L}+(?:-\p{L}+)*/gu;

async function main() {
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmt09ehi60000320qf9efrypu" },
    select: { slug: true, title: true, text: true },
  });
  let muertas = 0, total = 0;
  for (const s of st) {
    const g = getTapGlossesForSlug(s.slug!);
    if (!g) { console.log(`SIN BUNDLE: ${s.slug}`); continue; }
    const faltan: string[] = [];
    for (const src of [s.title ?? "", s.text ?? ""]) {
      for (const m of src.matchAll(TAPPABLE)) {
        total++;
        if (!g[m[0].toLowerCase()]) { muertas++; faltan.push(m[0]); }
      }
    }
    if (faltan.length) console.log(`${s.slug}: ${faltan.length} sin glosa -> ${[...new Set(faltan)].slice(0, 8).join(", ")}`);
  }
  console.log(`\n${st.length} historias · ${total} palabras tocables · ${muertas} sin glosa`);
  const g = getTapGlossesForSlug("les-premieres-heures")!;
  for (const k of ["manon", "porte", "glace", "place", "coince", "facteur", "rideaux", "tirer"])
    console.log(`  ${k}: ${g[k] ? JSON.stringify(g[k]) : "SIN GLOSA"}`);
  await p.$disconnect();
}
main();
