/**
 * Mismo error de clase que `davanti` en el A0, buscado en el bundle
 * italian-friends-italy-a1 (Milan): una PREPOSICION CON COMPLEMENTO glosada
 * como adverbio.
 *
 * La lista va fila a fila y a mano a proposito. La palabra no decide: decide
 * la frase donde cae, porque casi todas estas son adverbio cuando van solas y
 * preposicion cuando llevan complemento detras, y eso cambia de una historia a
 * otra. Por eso `giu` y `fuori` no estan aqui (en las cinco apariciones van
 * solas) y por eso `dopo` y `prima` solo cambian en las filas donde rigen algo.
 *
 * La fila GLOBAL solo cambia cuando TODAS las apariciones del bundle son
 * preposicion (davanti, dietro). En `dopo` y `prima` conviven los dos usos, asi
 * que la global se queda en adverbio y manda la capa de cada historia.
 *
 * Toca SOLO `g` y `t`. Los trozos de contexto ya dicen lo correcto.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const BUNDLE = "italian-friends-italy-a1";

type Fila = { slug: string; palabra: string; g: string; porque: string };

const FILAS: Fila[] = [
  // davanti: las cinco apariciones con complemento, y la global con ellas.
  { slug: "", palabra: "davanti", g: "in front of (davanti a)", porque: "fallback del bundle; todas sus apariciones rigen complemento" },
  { slug: "quattro-sabati-per-nicola", palabra: "davanti", g: "in front of (davanti a)", porque: "davanti alle Poste" },
  { slug: "concerto-al-secondo-piano", palabra: "davanti", g: "in front of (davanti a)", porque: "davanti alla porta" },
  { slug: "davide-vende-la-bici", palabra: "davanti", g: "in front of (davanti a)", porque: "davanti a Davide" },
  { slug: "tre-gambe-e-mezzo", palabra: "davanti", g: "in front of (davanti a)", porque: "davanti alla bottega" },
  // OJO: esta historia usa davanti DOS veces, "davanti a Elisa" (preposicion) y
  // "Elisa davanti" (adverbio). Una palabra tiene una sola glosa por historia,
  // asi que se sirve la del trozo que la glosa ya declara, que es la primera.
  { slug: "davide-prende-il-trapano", palabra: "davanti", g: "in front of (davanti a)", porque: "davanti a Elisa (la 2a aparicion, 'Elisa davanti', es adverbio: colision sin arreglo posible)" },

  // dietro: una sola aparicion en el bundle y rige complemento.
  { slug: "", palabra: "dietro", g: "behind", porque: "fallback; su unica aparicion rige complemento" },
  { slug: "davide-dorme-sulle-scale", palabra: "dietro", g: "behind", porque: "dietro la porta" },

  // dopo: solo donde rige. La global se queda adverbio.
  { slug: "quattro-sabati-per-nicola", palabra: "dopo", g: "after", porque: "dopo il giro" },
  { slug: "concerto-al-secondo-piano", palabra: "dopo", g: "after", porque: "dopo cinque minuti" },
  { slug: "chi-paga-il-calzino", palabra: "dopo", g: "after", porque: "Dopo un'ora" },

  // prima: solo la de "prima di". Las otras son adverbio.
  { slug: "milano-e-vuota", palabra: "prima", g: "before (prima di)", porque: "Prima della partenza" },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  let n = 0;
  for (const f of FILAS) {
    const fila = await prisma.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: BUNDLE, slug: f.slug } } });
    if (!fila) { console.log(`FALTA la fila ${f.slug || "(GLOBAL)"}`); continue; }
    const glosas = fila.glosses as Record<string, Record<string, unknown>>;
    const e = glosas?.[f.palabra];
    if (!e) { console.log(`FALTA ${f.palabra} en ${f.slug || "(GLOBAL)"}`); continue; }
    if (e.t !== "adverb") { console.log(`YA NO es adverb: ${f.palabra} en ${f.slug || "(GLOBAL)"} (${e.t}); no toco`); continue; }
    console.log(`${(f.slug || "(GLOBAL)").padEnd(26)} ${f.palabra.padEnd(8)} "${e.g}"/adverb -> "${f.g}"/preposition   · ${f.porque}`);
    if (!aplicar) { n++; continue; }
    e.g = f.g;
    e.t = "preposition";
    await prisma.tapGlossSet.update({
      where: { bundle_slug: { bundle: BUNDLE, slug: f.slug } },
      data: { glosses: glosas as never },
    });
    n++;
  }
  console.log(aplicar ? `escritas ${n} filas` : `${n} filas (seco; usa --apply)`);
}
main().finally(() => prisma.$disconnect());
