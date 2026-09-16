/**
 * Alinea la glosa de toque de `davanti` con su plaza de vocab.
 *
 * Las seis veces que `davanti` sale en el bundle italian-friends-italy-a0 sale
 * como `davanti a` + complemento (al palazzo, a tutti, alla porta, a lei, ad
 * Alice, all'altra). Ni una es adverbio, que es lo que decian la glosa global y
 * las seis capas de historia heredadas de ella. Desde que la plaza de
 * solo-per-una-foto ensena `davanti a` como expresion, las dos capas se
 * contradecian sobre la misma palabra.
 *
 * Toca SOLO `g` y `t`. El trozo de contexto (`c`) de cada historia se queda
 * como estaba, porque ya dice lo correcto, y `rev` tambien.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const BUNDLE = "italian-friends-italy-a0";
const PALABRA = "davanti";
const G = "in front of (davanti a)";
const T = "preposition";

async function main() {
  const aplicar = process.argv.includes("--apply");
  const filas = await prisma.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { slug: true, glosses: true } });
  let tocadas = 0;
  for (const fila of filas) {
    const glosas = fila.glosses as Record<string, Record<string, unknown>>;
    const e = glosas?.[PALABRA];
    if (!e) continue;
    console.log((fila.slug || "(GLOBAL)").padEnd(26), `${e.g} / ${e.t}  ->  ${G} / ${T}`);
    if (!aplicar) { tocadas++; continue; }
    e.g = G;
    e.t = T;
    await prisma.tapGlossSet.update({
      where: { bundle_slug: { bundle: BUNDLE, slug: fila.slug } },
      data: { glosses: glosas as never },
    });
    tocadas++;
  }
  console.log(aplicar ? `escritas ${tocadas} filas` : `${tocadas} filas (seco; usa --apply)`);
}
main().finally(() => prisma.$disconnect());
