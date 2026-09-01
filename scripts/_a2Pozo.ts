/** Lista las palabras LIBRES de verdad, filtrando las de funcion, para elegir
 *  plazas sin ir adivinando de una en una. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const FUNCION = new Set(("a ante bajo con contra de desde en entre hacia hasta mediante para por segun sin so sobre tras "+
 "el la los las un una unos unas lo al del y e o u ni pero sino aunque porque pues como cuando donde mientras si que "+
 "quien cual cuyo cuanto yo tu el ella nosotros vosotros ellos ellas me te se nos os le les lo la los las mi tu su "+
 "mio tuyo suyo nuestro este ese aquel esta esa aquella esto eso aquello no si ya tambien tampoco muy mas menos "+
 "mucho poco todo nada algo alguien nadie cada otro mismo tan tanto asi aqui alli ahi ahora antes despues siempre nunca").split(/\s+/));
(async () => {
  const { SPANISH_A1_A2_LEMMAS } = await import("@/lib/cefr/spanishA1A2");
  const J = "cmtgelq560007j84n3ujx9bpd";
  const mio = await p.journey.findUnique({ where: { id: J }, select: { typeSlug: true } });
  const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } }, journeyId: { not: J } },
    select: { vocab: true, journey: { select: { typeSlug: true } } } });
  const duro = new Set<string>();
  for (const r of otras) if (r.journey?.typeSlug === mio!.typeSlug)
    for (const v of ((r.vocab as any[]) ?? [])) if (v?.word && !PORT.has(String(v.type ?? "").toLowerCase()))
      duro.add(lema(String(v.word)));
  const propias = await p.journeyStory.findMany({ where: { journeyId: J }, select: { vocab: true } });
  for (const r of propias) for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) duro.add(lema(String(v.word)));
  const libres = [...new Set([...SPANISH_A1_A2_LEMMAS].map(String))]
    .filter((w) => !duro.has(lema(w)) && !FUNCION.has(lema(w)) && lema(w).length > 3);
  console.log(`palabras de contenido libres: ${libres.length}`);
  const q = process.argv[2];
  const sel = q ? libres.filter((w) => new RegExp(q, "i").test(w)) : libres;
  console.log(sel.slice(0, 400).join(", "));
})().finally(() => p.$disconnect());
