/**
 * Lint de VARIANTE en las glosas de contexto.
 *
 *   npx tsx scripts/checkGlossVariants.ts
 *   npm run lint:gloss-variants
 *
 * Las tarjetas de vocabulario enseñan formas: la conjugación de un verbo, el
 * paradigma de un pronombre. Esas formas NO son las mismas en España, en
 * México y en Argentina, y el fallo es invisible en revisión: `vosotros nadáis`
 * en un journey de Bogotá se lee como español correcto, solo que nadie habla
 * así allí. Este lint cruza cada bundle con la variante de su journey (grabada
 * en el propio fichero, porque el nombre miente: `spanish-friends.json` es
 * LATAM) y falla cuando una forma no pertenece a esa variante.
 *
 * Reglas, por variante:
 *
 *   España            vosotros sí; `ustedes` solo como tratamiento formal.
 *   LATAM, México,    NUNCA vosotros, ni `os`, ni `vuestro`. La segunda del
 *   Colombia          plural es `ustedes`, y su forma coincide con la de ellos.
 *   Argentina         además, VOSEO: la segunda del singular es `vos`, no `tú`,
 *                     y su forma lleva la tilde en la última sílaba
 *                     (hablás, comés, vivís; ser es `sos`). El imperativo
 *                     también cambia: hablá, comé, viví.
 *
 * Solo mira lo que se puede comprobar sin juicio: etiquetas de persona
 * prohibidas, formas de vosotros, posesivos de vosotros y formas de `vos` que
 * no estén acentuadas. Lo que no se puede comprobar así (léxico regional,
 * registro) sigue siendo trabajo de leerlo.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma";

type Fila = [string, string];
type Formas = { rows?: Fila[]; lemma?: string; link?: string };
type Entrada = { c?: { es: string; en: string }; f?: Formas };
type Bundle = {
  language?: string;
  variant?: string;
  slugs?: string[];
  byStory?: Record<string, Record<string, Entrada>>;
};

const prisma = new PrismaClient();
/** Variantes sin vosotros. Argentina va aparte porque suma el voseo. */
const SIN_VOSOTROS = new Set(["latam", "mexico", "colombia", "argentina", "peru", "chile"]);
const VOSEO = new Set(["argentina", "uruguay"]);

type Fallo = { fichero: string; historia: string; palabra: string; motivo: string };

/** La MISMA lista que usa el check de cobertura para no contarlas como hueco.
 *  Aquí se mira al revés: si una palabra exenta tiene glosa, vuelve a ser
 *  tocable y el otro lint deja de avisar de ella. Un solo fichero para las dos
 *  direcciones, que es lo que impide que vuelvan a contradecirse. */
const EXEMPT: Record<string, { articles: string[]; numerals: string[]; characterNames: string[] }> =
  JSON.parse(fs.readFileSync(path.join("scripts", "tap-gloss-exempt.json"), "utf8")).bundles;

/** Tipos que no se tocan: el artículo y el número no son vocabulario. El tipo
 *  "other" NO entra aquí aunque lo parezca: en alemán es un cajón de sastre con
 *  Kreuzberg, la Elbphilharmonie y las partículas doch, ja y halt, que son de lo
 *  más útil que hay. Los nombres que viven ahí se cazan por la glosa, abajo. */
const TIPOS_NO_TOCABLES = new Set(["article", "number", "numeral"]);

/** Linea base de trozos largos: deuda vieja congelada, solo puede bajar. */
const BASE_TROZOS = path.join(__dirname, "gloss-chunk-baseline.json");
function leeBaseTrozos(): number {
  try {
    return JSON.parse(fs.readFileSync(BASE_TROZOS, "utf8")).trozos as number;
  } catch {
    return 0;
  }
}

/** Maximo de palabras del trozo de contexto de una glosa. */
const TOPE_TROZO = 8;

/** "Marta (name)", "Timo (a name)", "Basti (nickname for Sebastian)": la glosa
 *  repite la palabra y no enseña nada. El contrato ya decía que los personajes
 *  inventados no se glosan; los reales y culturales llevan descriptor de lo que
 *  SON ("Madrid (city)", "Kreuzberg (Berlin district)") y no caen aquí. */
function esNombreDePersonaje(clave: string, glosa: string): boolean {
  const g = (glosa ?? "").trim();
  if (!g) return false;
  if (/\((?:nick)?name for /i.test(g)) return true;
  const cap = clave.charAt(0).toUpperCase() + clave.slice(1);
  const escapada = cap.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapada}(?:'s)? \\((?:a |man's |woman's |girl's |boy's )?name\\)$`).test(g);
}

function esFormaDeVos(forma: string): boolean {
  const limpia = forma.trim().toLowerCase();
  if (!limpia) return false;
  // Los monosílabos del presente no llevan tilde y ya son correctos en voseo:
  // vos sos, vos vas, vos das, vos ves, vos has. `estás` y los dos regulares
  // se quedan como muestra de lo que sí la lleva.
  if (["sos", "vas", "das", "ves", "estás", "has", "tenés", "vení"].includes(limpia)) return true;
  const ultima = limpia.split(/\s+/).pop() ?? limpia;
  return /(ás|és|ís)$/.test(ultima);
}

/**
 * ¿El paradigma está en presente de indicativo?
 *
 * El voseo solo cambia la forma en el presente y en el imperativo. En
 * pretérito, imperfecto o condicional, `vos` toma exactamente la misma forma
 * que `tú` (vos escuchaste, vos escuchabas, vos escucharías), así que pedirle
 * la tilde de la última sílaba marcaba como error una conjugación correcta.
 *
 * El tiempo no viene escrito en ninguna parte: las filas son personas. Se
 * deduce de la fila de `yo`, que en presente acaba en -o (hablo, veo, tengo)
 * salvo los cuatro en -oy y `sé` / `he`.
 */
function esParadigmaEnPresente(filas: Fila[]): boolean {
  const yo = filas.find(([etiqueta]) => String(etiqueta ?? "").trim().toLowerCase() === "yo");
  // Sin la fila de `yo` no hay de dónde deducirlo; se revisa igual, que es el
  // lado seguro: el lint avisa y lo mira una persona.
  if (!yo) return true;
  const forma = String(yo[1] ?? "").trim().toLowerCase().split(/\s+/).pop() ?? "";
  return /o$/.test(forma) || ["soy", "estoy", "voy", "doy", "sé", "he"].includes(forma);
}

function revisa(fichero: string, bundle: Bundle): Fallo[] {
  const fallos: Fallo[] = [];
  const variante = (bundle.variant ?? "").trim().toLowerCase();

  for (const [palabra, entrada] of Object.entries((bundle as { glosses?: Record<string, { t?: string; g?: string }> }).glosses ?? {})) {
    if (entrada?.t && TIPOS_NO_TOCABLES.has(entrada.t)) {
      fallos.push({ fichero, historia: "-", palabra, motivo: `tipo "${entrada.t}": no debe ser tocable` });
    }
    if (entrada?.g && esNombreDePersonaje(palabra, entrada.g)) {
      fallos.push({ fichero, historia: "-", palabra, motivo: "nombre de personaje inventado: la glosa repite la palabra" });
    }
    const exenta = EXEMPT[fichero.replace(/\.json$/, "")];
    if (exenta) {
      const p = palabra.toLowerCase();
      const clase = exenta.articles.includes(p) ? "artículo"
        : exenta.numerals.includes(p) ? "número"
        : exenta.characterNames.includes(p) ? "nombre de personaje" : null;
      if (clase) {
        fallos.push({ fichero, historia: "-", palabra, motivo: `${clase} exento en tap-gloss-exempt.json: no debe tener glosa` });
      }
    }
  }

  // TOPE DEL TROZO DE CONTEXTO: 8 palabras. El trozo tiene que ser el minimo
  // con sentido alrededor de la palabra, y el catalogo va de hecho en 4 de
  // mediana y 6 en el p90; ocho deja fuera el 1,4% y es una lista que se puede
  // vaciar. Puesto el 2026-09-04: tocar `esta` en el B1 devolvia "La habitacion
  // que le han ensenado esta en un cuarto sin ascensor", doce palabras, que es
  // la frase entera y no un trozo.
  for (const [historia, entradas] of Object.entries(bundle.byStory ?? {})) {
    for (const [palabra, entrada] of Object.entries(entradas)) {
      const es = (entrada as { c?: { es?: string } }).c?.es;
      if (!es) continue;
      const n = String(es).trim().split(/\s+/).length;
      if (n > TOPE_TROZO) {
        fallos.push({ fichero, historia, palabra, motivo: `trozo de ${n} palabras (tope ${TOPE_TROZO}): "${es}"` });
      }
    }
  }

  if ((bundle.language ?? "").toLowerCase() !== "spanish") return fallos;
  if (!variante) {
    fallos.push({ fichero, historia: "-", palabra: "-", motivo: "el bundle no dice de qué variante es" });
    return fallos;
  }

  for (const [historia, entradas] of Object.entries(bundle.byStory ?? {})) {
    for (const [palabra, entrada] of Object.entries(entradas)) {
      const filas = entrada.f?.rows ?? [];
      const presente = esParadigmaEnPresente(filas);
      for (const [etiqueta, forma] of filas) {
        const et = String(etiqueta ?? "").trim().toLowerCase();
        const fo = String(forma ?? "").trim().toLowerCase();

        if (SIN_VOSOTROS.has(variante)) {
          if (et.includes("vosotros") || et.includes("vosotras")) {
            fallos.push({ fichero, historia, palabra, motivo: `persona "${etiqueta}" en un journey ${variante}; ahí es ustedes` });
          }
          if (/\bos\b/.test(fo)) {
            fallos.push({ fichero, historia, palabra, motivo: `"${forma}" usa el pronombre os, que en ${variante} es los o les` });
          }
          if (/\bvuestr[oa]s?\b/.test(fo)) {
            fallos.push({ fichero, historia, palabra, motivo: `"${forma}" usa vuestro, que en ${variante} es de ustedes` });
          }
        }

        if (VOSEO.has(variante)) {
          if (et === "tú" || et === "tu") {
            fallos.push({ fichero, historia, palabra, motivo: `persona "tú" en un journey ${variante}; ahí es vos` });
          }
          if (et.includes("vos") && presente && !esFormaDeVos(fo)) {
            fallos.push({ fichero, historia, palabra, motivo: `"${forma}" no es forma de vos; el voseo acentúa la última sílaba (hablás, comés, vivís)` });
          }
        }
      }
    }
  }
  return fallos;
}

async function main() {
  // Las glosas viven en dp_tap_glosses_v1 desde el 2026-08-26: una fila por
  // (bundle, historia) y la de slug "" es el mapa global. Aqui se rearman los
  // bundles tal como los esperaba el lint cuando eran ficheros.
  const filas = await prisma.tapGlossSet.findMany({
    select: { bundle: true, slug: true, language: true, variant: true, glosses: true },
  });
  const bundles = new Map<string, Bundle>();
  for (const f of filas) {
    if (f.bundle.startsWith("talking-points")) continue;
    const b = bundles.get(f.bundle) ?? { slugs: [], glosses: {}, byStory: {} };
    if (f.slug === "") {
      b.language = f.language ?? undefined;
      b.variant = f.variant ?? undefined;
      (b as { glosses: Record<string, unknown> }).glosses = f.glosses as Record<string, never>;
    } else {
      (b.byStory ??= {})[f.slug] = f.glosses as Record<string, Entrada>;
    }
    bundles.set(f.bundle, b);
  }
  const fallos: Fallo[] = [];
  let revisados = 0;
  let conCapa = 0;

  for (const [nombre, bundle] of bundles) {
    revisados += 1;
    if (bundle.byStory && Object.keys(bundle.byStory).length > 0) conCapa += 1;
    fallos.push(...revisa(`${nombre}.json`, bundle));
  }

  await prisma.$disconnect();

  // Las dos mitades se miden distinto A PROPOSITO. Una forma de otra variante
  // (un vosotros en un journey de Mexico) es un fallo y nunca hubo ninguno, asi
  // que sigue en cero. El tope del trozo se puso el 2026-09-04 sobre un
  // catalogo ya escrito y nacio con 672 encima: se congela ahi y solo puede
  // bajar, como la linea base de no-emojis. Lo nuevo bloquea igual.
  const trozos = fallos.filter((f) => f.motivo.startsWith("trozo de"));
  const variantes = fallos.filter((f) => !f.motivo.startsWith("trozo de"));
  const baseTrozos = leeBaseTrozos();

  if (process.argv.includes("--apretar")) {
    fs.writeFileSync(BASE_TROZOS, JSON.stringify({ trozos: trozos.length }, null, 2) + "\n");
    console.log(`gloss-variants: linea base de trozos apretada a ${trozos.length}.`);
    return;
  }

  if (variantes.length === 0 && trozos.length <= baseTrozos) {
    console.log(
      `gloss-variants: limpio (${revisados} bundles, ${conCapa} con capa de contexto)` +
        (trozos.length ? ` · ${trozos.length} trozos largos de deuda vieja, linea base ${baseTrozos}` : "")
    );
    return;
  }

  if (variantes.length) {
    console.error(`gloss-variants: ${variantes.length} formas que no son de su variante\n`);
    for (const f of variantes) {
      console.error(`  ${f.fichero} · ${f.historia} · ${f.palabra}: ${f.motivo}`);
    }
    console.error("\nLas formas se corrigen en el bundle; la variante de cada journey manda.");
  }

  if (trozos.length > baseTrozos) {
    console.error(
      `\ngloss-variants: ${trozos.length} trozos por encima del tope, y la linea base era ${baseTrozos}\n`
    );
    for (const f of trozos) {
      console.error(`  ${f.fichero} · ${f.historia} · ${f.palabra}: ${f.motivo}`);
    }
    console.error(
      "\nEl trozo es el minimo con sentido alrededor de la palabra, no la frase entera." +
        "\nAl arreglar los viejos, baja la linea base:  npm run lint:gloss-variants -- --apretar"
    );
  }
  process.exit(1);
}

main();
