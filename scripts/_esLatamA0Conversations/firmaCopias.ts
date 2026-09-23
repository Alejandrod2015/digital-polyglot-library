/** Marca `rev: true` en las copias de hermanos de este bundle QUE YA SE LEYERON.
 *
 *  El 2026-09-23 se leyeron las 530 copias una a una contra la frase de ESTE
 *  journey (`reviewCopiedGlosses` no marcaba nada, asi que la lista se
 *  reconstruyo como "bundle global menos las escritas a mano en
 *  _newGlosses.json"), y 71 traian el sentido de otro journey: `caja` como
 *  "a hand drum", `marca` como "the mark" donde es la marca del producto,
 *  `riego` como "irrigation", argot pegado detras de `seco`, `mano`, `sale` y
 *  `seguro`. Van corregidas en corrigeCopias.ts. `once` se borro del mapa.
 *
 *  CRITERIO, y es estrecho a proposito: solo se firma la palabra que este en
 *  esa lista leida. Si aparece una con `rev:false` que NO este, el script PARA
 *  y la nombra, porque seria una copia nueva que nadie ha leido y firmarla en
 *  masa vaciaria el unico control que hay sobre el sentido heredado.
 *
 *  Se marca en la fila global Y en las filas por historia. Las de historia
 *  tienen el flag porque `glossContextChunks.ts` escribe
 *  `{...global[w], ...previa[w], c}`, que arrastra el `rev:false` del global
 *  (`writeGlossLayer.ts` no toca `rev`: crea la entrada con solo g y t).
 *
 *  Uso: npx tsx scripts/_esLatamA0Conversations/firmaCopias.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import manual from "../_newGlosses.json";

const B = "spanish-conversations-latam-a0";
const prisma = new PrismaClient();

async function main() {
  const dry = process.argv.includes("--dry");
  const filas = await prisma.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const global = filas.find((f) => f.slug === "");
  if (!global) throw new Error(`no hay fila global de ${B}`);

  const aMano = new Set(Object.keys((manual as Record<string, Record<string, unknown>>)[B] ?? {}));
  // La lista LEIDA: lo que hay en el mapa global y no se escribio a mano.
  const leidas = new Set(Object.keys(global.glosses as Record<string, unknown>).filter((w) => !aMano.has(w)));

  const sinLeer = new Set<string>();
  for (const f of filas) {
    for (const [w, v] of Object.entries((f.glosses ?? {}) as Record<string, { rev?: boolean }>)) {
      if (v?.rev === false && !leidas.has(w)) sinLeer.add(`${f.slug || "global"}:${w}`);
    }
  }
  if (sinLeer.size) {
    console.error(`PARO: ${sinLeer.size} copia(s) con rev:false que NO estan en la lista leida.`);
    console.error(`  ${[...sinLeer].slice(0, 20).join(", ")}`);
    console.error(`  Leelas con reviewCopiedGlosses.ts antes de firmar.`);
    process.exit(1);
  }

  let entradas = 0;
  const palabras = new Set<string>();
  for (const f of filas) {
    const gl = (f.glosses ?? {}) as Record<string, { rev?: boolean }>;
    let tocada = false;
    for (const [w, v] of Object.entries(gl)) {
      if (v?.rev !== false) continue;
      v.rev = true;
      entradas++;
      palabras.add(w);
      tocada = true;
    }
    if (!tocada || dry) continue;
    await prisma.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: gl as never } });
  }
  console.log(`${dry ? "[dry] " : ""}firmadas ${entradas} entradas (${palabras.size} palabras distintas) en ${filas.length} filas`);
  await prisma.$disconnect();
}
main();
