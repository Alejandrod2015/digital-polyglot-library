/**
 * La escalera, palabra a palabra: de las plazas ya guardadas en el journey,
 * cuales han vuelto a salir en otro cuerpo y cuales no. Lo que imprime la
 * segunda lista es lo que hay que plantar en los temas que quedan.
 *
 *   npx tsx scripts/_a2/weave.ts [fichero.json ...]   (los ficheros aun sin guardar)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const prisma = new PrismaClient();
const JOURNEY = "cmt70xfyt000l3283gxd70wck";
(async () => {
  const filas = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY }, select: { slug: true, text: true, vocab: true, topic: true, slotIndex: true },
  });
  const extra = process.argv.slice(2).flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const todas = [...filas.filter((f) => f.text), ...extra].map((s: any) => ({
    slug: s.slug, text: String(s.text), vocab: (s.vocab ?? []) as Array<{ word: string; surface?: string }>,
  }));
  const tok = (t: string) => new Set(t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = todas.map((s) => tok(s.text));
  const clave = (v: { word: string; surface?: string }) => String(v.surface ?? v.word).toLowerCase();
  const filas2: Array<{ w: string; n: number }> = [];
  for (const s of todas) for (const v of s.vocab)
    filas2.push({ w: clave(v), n: cuerpos.filter((c) => c.has(clave(v))).length });
  const media = filas2.reduce((a, b) => a + b.n, 0) / (filas2.length || 1);
  const solas = filas2.filter((x) => x.n <= 1).map((x) => x.w).sort();
  console.log(`${todas.length} cuerpos · ${filas2.length} plazas · media ${media.toFixed(2)} historias por plaza`);
  console.log(`vuelven en otro cuerpo: ${filas2.length - solas.length} · salen una sola vez: ${solas.length}\n`);
  console.log("SIN REENCUENTRO (plantar en lo que queda):");
  for (let i = 0; i < solas.length; i += 12) console.log("  " + solas.slice(i, i + 12).join(" "));
})().finally(() => prisma.$disconnect());
