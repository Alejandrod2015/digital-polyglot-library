/** Las plazas de COLOR LOCAL del B1 latam, historia por historia, con lo que
 *  hay disponible para sustituirlas.
 *
 *  Una plaza de color es una palabra que no esta en el lexico graduado ni a
 *  nivel C1: sirve a la escena y no le sirve a nadie fuera de ella. La palabra
 *  NO se borra del texto, solo pierde la plaza.
 *
 *  Para cada historia lista tambien las CANDIDATAS: palabras que ya salen en
 *  su cuerpo, estan dentro del lexico graduado y todavia no ocupan plaza. Sin
 *  esa lista, sustituir obliga a tocar el texto, que en las tres narradas esta
 *  prohibido. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";

/** Copiada de _utilidadVocab.ts a proposito: ese modulo corre su propio
 *  barrido del catalogo al importarlo, asi que importar la funcion imprimia
 *  los treinta journeys encima de lo mio. */
function fueraDelLexico(w: string): boolean {
  const x = w.trim().toLowerCase();
  if (!x || x.includes(" ")) return false;
  const formas = [x];
  if (x.endsWith("es") && x.length > 4) formas.push(x.slice(0, -2));
  if (x.endsWith("s") && x.length > 3) formas.push(x.slice(0, -1));
  return !formas.some((f) => isSpanishUpToLevel(f, "c1"));
}

const p = new PrismaClient();
const JOURNEY = "cmtmylg7k0007321h6t7njesx";

(async () => {
  const hs = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, topic: true, slotIndex: true, title: true, text: true, vocab: true, audioUrl: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  let total = 0;
  for (const h of hs) {
    const voc = ((h.vocab as Array<{ word?: unknown; type?: unknown }>) ?? []);
    const fuera = voc.map((v) => String(v?.word ?? "")).filter((w) => fueraDelLexico(w));
    total += fuera.length;
    const ocupadas = new Set(voc.map((v) => String(v?.word ?? "").toLowerCase()));
    const enCuerpo = [...new Set((`${h.text}`.toLowerCase().match(/\p{L}+/gu) ?? []))];
    // Candidata: sale en el cuerpo, esta dentro del lexico y no ocupa plaza.
    const candidatas = enCuerpo
      .filter((w) => w.length > 3 && !ocupadas.has(w) && !fueraDelLexico(w) && isSpanishUpToLevel(w, "b1"))
      .slice(0, 24);
    console.log(`\n${h.audioUrl ? "NARRADA" : "       "} ${h.topic}#${h.slotIndex} ${h.slug}`);
    console.log(`  color (${fuera.length}): ${fuera.join(", ") || "-"}`);
    if (fuera.length) console.log(`  candidatas en el cuerpo: ${candidatas.join(", ")}`);
  }
  console.log(`\nTOTAL color: ${total} en ${hs.length} historias · media ${(total / hs.length).toFixed(2)} (tope 1,5)`);
  await p.$disconnect();
})();
