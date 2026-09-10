/**
 * Segunda lectura: las 111 copias que entraron con el tema 2, contra su frase.
 *
 * Quince salieron con el sentido de su journey de origen. La proporcion no
 * baja con la practica (siete de 161 en el tema 1, quince de 111 aqui) porque
 * el copiador va por PALABRA: cuanto mas corriente es la palabra, mas sentidos
 * tiene y mas facil es que el bueno no sea el de aqui.
 *
 *   npx tsx scripts/_pta2RevisaYmarca2.ts
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";

/** Lo que decia la copia, y lo que dice la frase de aqui. */
const ARREGLOS: Record<string, { g?: string; t?: string }> = {
  // Traian coletilla del origen, falsa aqui.
  abriu: { g: "opened, as in the shop opened (abrir)" },
  fechar: { g: "to close, here to shut the shop" },
  resolve: { g: "it does the job, it sorts the problem out (resolver)" },
  turno: { g: "the shift somebody works, here the night one" },
  orelha: { g: "the ear, the part on the side of your head" },
  // Sentido directamente equivocado en esta frase.
  avisar: { g: "to let somebody know" },
  dobra: { g: "bends it, here the finger (dobrar)" },
  curta: { g: "short, here a short queue (curto)" },
  fraco: { g: "weak, here weak coffee" },
  ruim: { g: "bad, of poor quality" },
  viu: { g: "saw, has seen (ver)" },
  fina: { g: "thin (fino)" },
  passar: { g: "to pass; of pain, to go away" },
  // "Recife" es la ciudad, no un arrecife. Nombre propio real: se glosa con
  // lo que ES, que es la regla, en vez de esconderlo en los exentos.
  recife: { g: "Recife, a city on the northeast coast of Brazil", t: "noun" },
  // Se quedaban cortas o cargadas de mas.
  admite: { g: "admits it, says it even if she would rather not" },
  forte: { g: "strong, here a strong medicine" },
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
