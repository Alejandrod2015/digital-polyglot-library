/** El TECHO de la operacion: hasta que porcentaje se puede subir el suelo de
 *  nivel SIN TOCAR NI UNA LINEA DE TEXTO.
 *
 *  La regla del encargo es que la plaza nueva salga del cuerpo de su historia.
 *  Entonces el maximo por historia no es "las plazas que quiera", sino
 *  min(plazas de A1/A2 que puedo liberar, palabras B1+ libres que hay en ese
 *  cuerpo). Sumando ese minimo historia por historia sale el techo del
 *  journey, y si el techo esta por debajo del suelo pedido, el encargo no se
 *  puede cumplir tal como esta escrito.
 *
 *  Mismo metodo que se uso en el plan de vocab del A2: medir la imposibilidad
 *  en vez de descubrirla a mitad. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";

const p = new PrismaClient();
const JOURNEY = "cmtmylg7k0007321h6t7njesx";
const deNivel = (w: string) => !isSpanishUpToLevel(w.toLowerCase(), "a2");
const raiz = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 5);

(async () => {
  const hs = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, text: true, vocab: true, audioUrl: true },
  });
  let arriba = 0, total = 0, ganancia = 0;
  const secos: string[] = [];
  for (const h of hs) {
    const voc = (h.vocab as Array<{ word?: unknown }>) ?? [];
    const palabras = voc.map((v) => String(v?.word ?? ""));
    const raices = new Set(palabras.map(raiz));
    const bajas = palabras.filter((w) => !deNivel(w)).length;
    arriba += palabras.length - bajas; total += palabras.length;

    const libres = new Set<string>();
    for (const w of `${h.text}`.toLowerCase().match(/\p{L}+/gu) ?? []) {
      if (w.length > 2 && deNivel(w) && !raices.has(raiz(w)) && isSpanishUpToLevel(w, "c1")) libres.add(raiz(w));
    }
    const puede = Math.min(bajas, libres.size);
    ganancia += puede;
    if (puede < bajas) secos.push(`${h.slug}: ${bajas} plazas bajas y solo ${libres.size} palabras B1+ libres${h.audioUrl ? " (NARRADA)" : ""}`);
  }
  const techo = (arriba + ganancia) / total;
  console.log(`hoy: ${arriba}/${total} (${Math.round((arriba / total) * 100)}%)`);
  console.log(`techo sin tocar texto: ${arriba + ganancia}/${total} (${Math.round(techo * 100)}%)`);
  console.log(`suelo pedido: 60% = ${Math.ceil(total * 0.6)} plazas\n`);
  console.log(`historias donde el cuerpo NO da para subir todas sus plazas bajas (${secos.length}):`);
  for (const s of secos) console.log(`  ${s}`);
  await p.$disconnect();
})();
