/**
 * Tercera lectura: las 84 copias que entraron con el tema 3, contra su frase.
 *
 * Dieciseis salieron con el sentido de su journey de origen. Es la misma
 * proporcion de siempre (7 de 161, 15 de 111, 16 de 84) y se concentra en dos
 * sitios: las palabras muy corrientes con muchos sentidos ("molho" como salsa
 * sobre una olla EN REMOJO, "larga" como ancho sobre el verbo largar) y las
 * copias que traen pegada una coletilla del journey de origen ("here, nobody
 * said it" sobre una frase donde si lo dijo).
 *
 *   npx tsx scripts/_pta2RevisaYmarca4.ts
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";

const ARREGLOS: Record<string, { g?: string; t?: string }> = {
  // Otro sentido de la misma palabra.
  molho: { g: "de molho means left soaking in water" },
  larga: { g: "drops it, puts it down (largar)", t: "verb" },
  parada: { g: "still, with nothing going on (parado)", t: "adjective" },
  limpa: { g: "clean (limpo)", t: "adjective" },
  bilhete: { g: "a note left for somebody" },
  baixo: { g: "para baixo means facing down" },
  aí: { g: "then, in that case" },
  cortada: { g: "cut into pieces (cortar)" },
  virada: { g: "turned over, upside down (virar)" },
  puxa: { g: "draws it out, pulls it out (puxar)" },
  pronto: { g: "e pronto means and that is that" },
  // Coletilla del journey de origen, falsa aqui.
  arruma: { g: "tidies, puts in order (arrumar)" },
  der: { g: "se der certo means if it works out (dar)" },
  disse: { g: "said it, told it (dizer)" },
  estava: { g: "it was (estar)" },
  // Tipo mal puesto.
  também: { t: "adverb" },
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
