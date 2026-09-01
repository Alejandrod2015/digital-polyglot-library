import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
(async () => {
  const { SPANISH_A1_A2_LEMMAS } = await import("@/lib/cefr/spanishA1A2");
  const J = "cmtgelq560007j84n3ujx9bpd";
  const mio = await p.journey.findUnique({ where: { id: J }, select: { language: true, typeSlug: true } });
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: J } },
    select: { vocab: true, journey: { select: { typeSlug: true } } } });
  const duro = new Set<string>();
  for (const r of otras) if (r.journey?.typeSlug === mio!.typeSlug)
    for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) duro.add(lema(String(v.word)));
  const propias = await p.journeyStory.findMany({ where: { journeyId: J }, select: { vocab: true } });
  for (const r of propias) for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) duro.add(lema(String(v.word)));
  const lista = [...new Set([...SPANISH_A1_A2_LEMMAS].map(lema))];
  const libres = lista.filter((w) => !duro.has(w));
  console.log(`lista curada A1/A2:            ${lista.length}`);
  console.log(`bloqueadas (cero, mismo tipo): ${duro.size}`);
  console.log(`LIBRES sobre el papel:         ${libres.length}`);
  console.log(`plazas que faltan:             ${18 * 20} (18 historias x 20)`);
  console.log(`\nmuestra de lo libre: ${libres.slice(0, 40).join(", ")}`);
})().finally(() => p.$disconnect());
