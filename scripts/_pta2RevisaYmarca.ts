/**
 * Lectura de las 161 copias del A2 PT contra su frase, y la marca `rev: true`
 * que pide `lint:glosses-reviewed`.
 *
 * Seis salieron con el sentido de su journey de ORIGEN, que es exactamente
 * para lo que existe esta lectura: la copia va por PALABRA y no mira la
 * oracion. Las 128 de contenido se leyeron una a una con
 * `scripts/_pta2RevGlosas.ts`, que pone cada glosa al lado de la frase de este
 * journey donde cae.
 *
 *   npx tsx scripts/_pta2RevisaYmarca.ts
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";

/** Lo que la copia decia, y lo que dice la frase de aqui. */
const ARREGLOS: Record<string, { g?: string; t?: string }> = {
  // Traia coletilla del journey de origen ("here she does not"), que aqui es
  // falsa: en "quando alguem corrige" no hay nadie negandose a corregir.
  corrige: { g: "corrects, puts somebody right (corrigir)" },
  // Igual: "here, too late" es del origen. Aqui la caja simplemente no llego.
  chegou: { g: "arrived, got here (chegar)" },
  // El origen hablaba de un sorteo. Aqui es el resultado de un examen.
  resultado: { g: "the result, how the exam went", t: "noun" },
  // "tall, high" sobre "em voz alta", que es en voz alta y no altura.
  alta: { g: "em voz alta means out loud", t: "adjective" },
  // PELIGROSA: "older lady" sobre el usted brasileno con el que Gilson trata a
  // una profesora en activo. Ademas empuja al lector a imaginar una anciana,
  // que es prohibicion dura del proyecto.
  senhora: { g: "a senhora is the polite you, said to a woman", t: "pronoun" },
  // "go on, off you go" es un imperativo del origen; aqui es ir a hacer algo,
  // y en la tercera historia es un animo ("Vai", tu puedes).
  vai: { g: "is going to (ir); on its own, you can do it", t: "verb" },
  // "finds" se queda corto sobre "achar graca", que es hacerle gracia.
  acha: { g: "achar graca means to find something funny", t: "verb" },
};

(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let arreglos = 0, marcadas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, { g?: string; t?: string; rev?: boolean }>;
    for (const [w, fix] of Object.entries(ARREGLOS))
      if (g[w]) { g[w] = { ...g[w], ...fix }; arreglos++; }
    for (const w of Object.keys(g))
      if (g[w]?.rev === false) { g[w].rev = true; marcadas++; }
    await p.tapGlossSet.update({
      where: { bundle_slug: { bundle: B, slug: f.slug } },
      data: { glosses: g as never },
    });
  }
  console.log(`arreglos ${arreglos} · marcadas como leidas ${marcadas}`);
  await p.$disconnect();
})();
