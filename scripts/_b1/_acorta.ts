/** Seis trozos del tema 3 salieron de 9 palabras (tope 8) y tres numerales se
 *  colaron como tocables. El tope existe porque el catalogo va en 4 de mediana:
 *  un trozo largo deja de ser el minimo con sentido y repite la frase entera. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const CORTOS: Record<string, { es: string; en: string }> = {
  "Desde luego la reunión no le ha quitado trabajo": { es: "la reunión no le ha quitado trabajo", en: "the meeting has not taken work off her" },
  "El jueves por la noche llega un segundo correo": { es: "llega un segundo correo", en: "a second email arrives" },
  "de vez en cuando sale un tema de verdad": { es: "sale un tema de verdad", en: "a real subject comes up" },
  "el acuerdo fue cambiar una palabra por otra parecida": { es: "cambiar una palabra por otra parecida", en: "swapping one word for a similar one" },
  "la esperanza y el miedo caben en la misma frase": { es: "la esperanza y el miedo caben juntos", en: "hope and fear fit together" },
  "sin orden del día y sin una hora exacta": { es: "sin orden del día", en: "with no agenda" },
};
const NUMERALES = ["ocho", "nueve", "quince"];
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let cortados = 0, quitados = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    for (const w of Object.keys(g)) {
      const c = g[w]?.c;
      if (c && CORTOS[c.es]) { g[w] = { ...g[w], c: { ...CORTOS[c.es] } }; cortados++; }
    }
    if (f.slug === "") for (const n of NUMERALES) if (g[n]) { delete g[n]; quitados++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`trozos acortados ${cortados} · numerales fuera del mapa ${quitados}`);
  await p.$disconnect();
})();
