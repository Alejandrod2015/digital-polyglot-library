/** Por historia: que plazas son de A1/A2 (candidatas a subir) y que palabras
 *  B1+ hay libres en su cuerpo para ocuparlas.
 *
 *  Lematiza LOS DOS LADOS al comparar: una candidata que aparece como
 *  "arrancaba" choca con la plaza "arrancar", y compararlas en crudo no lo ve.
 *  Esa es la leccion que costo iteraciones en la tanda anterior.
 *
 *  Tambien dice cuantas plazas hay que subir en cada historia para llegar al
 *  60% del journey, que es lo que decide si los cuerpos dan de si. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";

const p = new PrismaClient();
const JOURNEY = "cmtmylg7k0007321h6t7njesx";

/** De nivel = NO se resuelve con el lexico hasta A2. */
const deNivel = (w: string) => !isSpanishUpToLevel(w.toLowerCase(), "a2");
/** Raiz burda para comparar lados distintos de la misma familia. */
const raiz = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 5);

(async () => {
  const hs = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true, audioUrl: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  let arriba = 0, total = 0;
  for (const h of hs) {
    const voc = (h.vocab as Array<{ word?: unknown; surface?: unknown }>) ?? [];
    const palabras = voc.map((v) => String(v?.word ?? ""));
    const raices = new Set(palabras.map(raiz));
    const bajas = palabras.filter((w) => !deNivel(w));
    arriba += palabras.length - bajas.length; total += palabras.length;

    const cuenta = new Map<string, number>();
    for (const w of `${h.text}`.toLowerCase().match(/\p{L}+/gu) ?? []) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
    const libres = [...cuenta.entries()]
      .filter(([w]) => w.length > 4 && deNivel(w) && !raices.has(raiz(w)) && isSpanishUpToLevel(w, "c1"))
      .sort((a, b) => b[1] - a[1]);
    console.log(`\n${h.audioUrl ? "NARRADA " : "        "}${h.slug}`);
    console.log(`  A1/A2 en plaza (${bajas.length}): ${bajas.join(", ")}`);
    console.log(`  B1+ libres en el cuerpo (${libres.length}): ${libres.map(([w, c]) => `${w}${c > 1 ? ` x${c}` : ""}`).join(", ")}`);
  }
  console.log(`\nahora ${arriba}/${total} por encima de A1/A2 (${Math.round((arriba / total) * 100)}%) · para el 60% hacen falta ${Math.ceil(total * 0.6) - arriba} plazas mas`);
  await p.$disconnect();
})();
