/** ¿Las claves que borre eran entradas del VOCABULARIO de su historia?
 *
 *  Si lo eran, no eran peso muerto: VocabPanel las alcanza por lema y el
 *  borrado ha dejado esos items sin su frase. Se comprueba contra la lista que
 *  imprimio el borrado, bundle por bundle. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();

/** Lo que salio por pantalla al borrar, tal cual. */
const BORRADO: Record<string, string[]> = {
  "spanish-traveler-spain-b2": [
    "quedar por", "cara a", "ir por", "hacer una excepción", "deber una", "moverse",
    "tanda", "forrar", "cruzado", "envolver", "volver a", "agacharse", "manuscrito",
    "medir", "negar", "cruzar", "añadir", "callado", "invitar", "perderse",
    "tender la mano", "aburrirse", "caer en la cuenta", "calentarse la cara",
    "salirse con la suya", "picarse", "cortar por el mismo patrón", "lanzarse",
    "dejarse querer", "ponerse a", "curar", "temer", "oírse", "sudado", "mudarse",
    "contento", "informar", "recordar", "hacer falta", "quedarse atrás", "abrazarse",
    "funcionar", "desconocido", "dar las gracias", "dar por sabido", "darse por aludido",
    "sonar a", "dejar de", "llevarse", "clavo", "ganarse", "subirse", "estrenar",
    "retratar", "desdoblar", "aguantarse", "pedir silencio",
  ],
  "spanish-traveler-latam-a2": [
    "firmo", "pedí", "subir", "olvido", "cuídese", "contestar", "ante", "pues",
    "cobro", "hecha", "hecho", "conste", "arranca", "cerrado", "hubiera", "llamara",
    "funcionaba", "contárselo",
  ],
  "spanish-traveler-latam-b1": ["perdiera", "panadero", "corrió"],
  "spanish-friends-argentina": ["remero", "escoltaban", "guardaba"],
  "italian-traveler-a1": ["faccia", "lasciata"],
  "german-traveler-a0": ["kap"],
  "german-traveler-a1": ["lichtern"],
  "german-hamburg": ["geschrien"],
  "italian-friends-a0": ["passeggiata"],
};

(async () => {
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, slugs: true } });
  for (const [bundle, claves] of Object.entries(BORRADO)) {
    const slugs = (filas.find((f) => f.bundle === bundle && !f.slug)?.slugs ?? []) as string[];
    const hs = await p.journeyStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true, vocab: true } });
    const enVocab: string[] = [];
    for (const w of claves) {
      const l = w.toLowerCase();
      const donde = hs.filter((h) =>
        ((h.vocab ?? []) as Array<{ word?: string; surface?: string }>).some(
          (v) => v.word?.trim().toLowerCase() === l || v.surface?.trim().toLowerCase() === l
        )
      );
      if (donde.length) enVocab.push(`${w} (${donde.map((d) => d.slug).join(", ")})`);
    }
    console.log(`\n${bundle}: ${enVocab.length} de ${claves.length} eran vocabulario`);
    for (const e of enVocab) console.log(`  ${e}`);
  }
  await p.$disconnect();
})();
