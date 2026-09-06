/** Ocho trozos del tema 5 pasaban de 8 palabras. El tope existe porque el
 *  catalogo va en 4 de mediana: un trozo largo deja de ser el minimo con
 *  sentido y le repite la frase entera al lector. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const CORTOS: Record<string, { es: string; en: string }> = {
  "El del tercero ha vuelto a dejar la basura fuera": { es: "el del tercero ha dejado la basura fuera", en: "the third floor left the rubbish out" },
  "El nombre de uno aquí lo ponen los demás": { es: "el nombre lo ponen los demás", en: "your name is given by the others" },
  "Se lo he puesto yo, por lo del cuaderno": { es: "Se lo he puesto yo", en: "I gave it to her" },
  "Y con la llave en la mano, como siempre": { es: "con la llave en la mano", en: "with the key in her hand" },
  "Y el jueves te apunto a ti lo del agua": { es: "el jueves te apunto lo del agua", en: "on Thursday I note the water for you" },
  "el mote se le quedó antes que la factura": { es: "el mote se le quedó", en: "the nickname stuck to him" },
  "en su cabeza las palabras van una a una": { es: "las palabras van una a una", en: "the words come one by one" },
  "está en el buzón con el sobre del agua": { es: "con el sobre del agua", en: "with the water bill" },
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let c = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    for (const w of Object.keys(g)) {
      const ctx = g[w]?.c;
      if (ctx && CORTOS[ctx.es]) { g[w] = { ...g[w], c: { ...CORTOS[ctx.es] } }; c++; }
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`trozos acortados ${c}`);
  await p.$disconnect();
})();
