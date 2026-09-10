/** SOLO LECTURA. La aritmetica del pozo A2: cuantas plazas pide la escalera
 *  (420 = 21 x 20, 294 portables + 126 ancladas) y cuantos lemas hay para
 *  llenarlas con solape cero contra a0/a1/b1, separando capa por capa.
 *
 *  El `type` de cada lema se toma de como lo etiqueto el journey que lo
 *  enseño; para los lemas LIBRES (que nadie enseña) no hay etiqueta en la
 *  base, asi que se cuentan aparte y sin clasificar: ese numero es el techo,
 *  no el reparto. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { PORTUGUESE_A1_A2_LEMMAS, isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
const p = new PrismaClient();
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
const STOP = new Set("o a os as um uma uns umas do da dos das no na nos nas eu tu você ele ela nós vocês eles elas meu teu seu nosso este esta esse essa aquele aquela isto isso aquilo outro mesmo todo cada e ou mas porém porque quando enquanto se embora como que qual quem em de com para por sem sob sobre entre contra desde até após antes não sim talvez claro certo nunca sempre já ainda também só apenas aqui ali lá cá perto longe dentro fora acima abaixo cima baixo muito pouco mais menos bem mal quase tanto tão igual".split(" "));

(async () => {
  const st = await p.journeyStory.findMany({
    where: { journey: { language: "portuguese" } },
    select: { vocab: true },
  });
  const ensenadas = new Map<string, string>();
  for (const r of st)
    for (const v of (r.vocab ?? []) as Array<{ word?: string; type?: string }>) {
      const w = String(v.word ?? "").toLowerCase();
      if (w) ensenadas.set(w, String(v.type ?? "").toLowerCase());
    }

  const libres = [...PORTUGUESE_A1_A2_LEMMAS]
    .filter((w) => !ensenadas.has(w) && !STOP.has(w) && w.length > 2);
  const reabribles = [...ensenadas.entries()]
    .filter(([w, t]) => PORT.has(t) && isPortugueseA1A2(w))
    .map(([w]) => w);
  const bloqueadas = [...ensenadas.entries()]
    .filter(([w, t]) => !PORT.has(t) && isPortugueseA1A2(w))
    .map(([w]) => w);

  const PLAZAS = 21 * 20, PORTABLES = 21 * 14, ANCLADAS = 21 * 6;
  console.log(`PLAZAS que pide la escalera: ${PLAZAS} (${PORTABLES} portables + ${ANCLADAS} ancladas)`);
  console.log(`Lista A1A2 (techo de nivel del A2): ${PORTUGUESE_A1_A2_LEMMAS.size} lemas`);
  console.log(`  ya enseñados por a0/a1/b1 y en nivel: ${reabribles.length + bloqueadas.length}`);
  console.log(`    de esos, capa PORTABLE (reabrible entre niveles): ${reabribles.length}`);
  console.log(`    de esos, capa ANCLADA (cero duro dentro del nivel):  ${bloqueadas.length}`);
  console.log(`  LIBRES (nadie los enseña) y en nivel: ${libres.length}`);
  console.log("");
  console.log(`Solape CERO absoluto en las ${PLAZAS} plazas: ${libres.length} libres < ${PLAZAS} plazas -> IMPOSIBLE por ${PLAZAS - libres.length}.`);
  console.log(`Ancladas a cero (${ANCLADAS} plazas) contra ${libres.length} libres: cabe, sobran ${libres.length - ANCLADAS}.`);
  console.log(`Portables (${PORTABLES}) contra libres restantes + reabribles = ${libres.length - ANCLADAS} + ${reabribles.length} = ${libres.length - ANCLADAS + reabribles.length}: ${libres.length - ANCLADAS + reabribles.length >= PORTABLES ? "cabe" : "NO cabe"}.`);
})().finally(() => p.$disconnect());
