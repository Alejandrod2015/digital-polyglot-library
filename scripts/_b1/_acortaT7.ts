/** Diecinueve trozos del tema 7 pasaban de 8 palabras. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const CORTOS: Record<string, { es: string; en: string }> = {
  "Celia se queda con la llave a medio girar": { es: "la llave a medio girar", en: "the key half turned" },
  "Celia ya está en el rellano con la llave fuera": { es: "ya está en el rellano", en: "she is already on the landing" },
  "Desde el lunes la miran de un modo raro": { es: "la miran de un modo raro", en: "they look at her oddly" },
  "Dije que en junio se me acaba el contrato": { es: "en junio se me acaba el contrato", en: "my contract ends in June" },
  "Emilio la escucha en el marco de la puerta": { es: "la escucha en el marco de la puerta", en: "he listens in the doorway" },
  "La frase era suya y ahora no la reconoce": { es: "La frase era suya", en: "The sentence was hers" },
  "Lo del contrato de junio se lo digo yo": { es: "el contrato de junio se lo digo yo", en: "the June contract I tell you myself" },
  "Pues nada, ya me enteraré yo por otro lado": { es: "ya me enteraré por otro lado", en: "I will find out some other way" },
  "Se queda callado más de lo que se quedaba antes": { es: "Se queda callado más que antes", en: "He stays silent longer than before" },
  "Sole se lo ha contado a Emilio antes que ella": { es: "se lo ha contado antes que ella", en: "she told him before Celia did" },
  "Yo prefiero saberlo aquí y no en el buzón": { es: "prefiero saberlo aquí", en: "I would rather know here" },
  "con la bolsa de la compra en el suelo": { es: "la bolsa en el suelo", en: "the bag on the floor" },
  "contesta Celia con la excusa del correo en la mano": { es: "con el correo en la mano", en: "with the post in her hand" },
  "el caso es la oficina y quien la lleva": { es: "el caso es la oficina", en: "the matter is the office" },
  "las dos saben lo mismo: poco y de oídas": { es: "poco y de oídas", en: "little, and by hearsay" },
  "y la para con la bolsa de la compra": { es: "la para en el portal", en: "stops her in the entrance" },
  "y le sale la voz más rápida de lo que quería": { es: "le sale la voz más rápida", en: "her voice comes out faster" },
  "y se da cuenta de que sí lo dijo": { es: "se da cuenta de que sí lo dijo", en: "she realises she did say it" },
  "¿tú te vas en junio o no te vas?": { es: "¿tú te vas en junio?", en: "are you leaving in June?" },
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
  console.log(`acortados ${c}`);
  await p.$disconnect();
})();
