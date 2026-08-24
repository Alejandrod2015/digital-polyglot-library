/**
 * Re-sincroniza un bundle de tap-glosses con el texto ACTUAL de sus historias.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 *
 * El 2026-08-07 el usuario tocó `kündigt` y no salió nada. Medido después, el
 * agujero era de proceso: los bundles se generan una vez y las historias se
 * siguen editando. Tres estaban desfasados y nadie se enteró:
 *
 *   spanish-traveler-mexico-a0  bundle 21-jul, historias editadas hasta 3-ago
 *   german-hamburg              bundle  9-jul, historias editadas hasta 5-ago
 *   spanish-friends-spain-a0    bundle 21-jul, historias editadas 28-jul
 *
 * En el mexicano eso dejaba **una de cada ocho palabras muerta** al tocarla,
 * en las 21 historias, con casos del 23%. Nada avisaba: compilaba, publicaba y
 * el único que lo notaba era el usuario tocando una palabra.
 *
 * ── Dos decisiones de diseño ──────────────────────────────────────────────
 *
 * 1. ADITIVO, nunca borra. Un rebuild "desde cero" tendría que reconstruir
 *    las claves con apóstrofo o guion (`schmeckt's`) desde un tokenizador, y
 *    si el tokenizador no las reproduce exactamente se pierden glosas buenas.
 *    Las huérfanas (glosas de texto que ya no existe) se quedan: pesan poco y
 *    borrarlas es el único movimiento que puede romper algo.
 * 2. REUTILIZA antes de pedir nada. Dos tercios de lo que falta ya está
 *    glosado en un bundle hermano del mismo idioma (`mientras`, `algo`,
 *    `tan`), y copiarlo es gratis y consistente. Solo lo que no existe en
 *    ninguna parte se busca en `scripts/_newGlosses.json`, escrito a mano.
 *
 * Y como el original: si algo se queda sin glosa, NO ESCRIBE. Un bundle a
 * medias es peor que uno viejo, porque el usuario no sabe cuál falla.
 *
 * ── Uso ───────────────────────────────────────────────────────────────────
 *
 *   npx tsx scripts/rebuildTapGlosses.ts --dry           # informe, sin tocar
 *   npx tsx scripts/rebuildTapGlosses.ts                 # escribe
 *   npx tsx scripts/rebuildTapGlosses.ts --only german-hamburg
 *
 * Los TÍTULOS cuentan: el lector los hace tocables y el generador viejo solo
 * miraba el cuerpo. Ese era exactamente el caso de `kündigt`.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";

const prisma = new PrismaClient();
const DIR = path.resolve(__dirname, "../src/data/tapGlosses");
const MANUAL = path.resolve(__dirname, "_newGlosses.json");

/** Bundles hermanos por idioma: de ahí se copian las glosas ya escritas. */
const FAMILIES: Record<string, string[]> = {
  spanish: [
    "spanish-friends",
    "spanish-friends-argentina",
    "spanish-friends-colombia",
    "spanish-friends-mexico",
    "spanish-friends-spain-a0",
    "spanish-traveler-latam",
    "spanish-traveler-mexico-a0",
  ],
  german: ["german-expat", "german-friends", "german-hamburg", "german-traveler-a0"],
  french: ["french-traveler", "french-expat-lyon"],
  italian: ["italian-friends-a0", "italian-traveler-a0"],
  portuguese: ["portuguese-traveler-brazil-a0", "portuguese-traveler-brazil-a1"],
};

/**
 * Nombres de PERSONAJE inventados: tocarlos y no obtener nada no es un fallo
 * de cobertura, así que no cuentan como hueco. Los nombres REALES (Frida
 * Kahlo) sí se glosan, y viven en el fichero manual como cualquier otra.
 */
const CHARACTER_NAMES =
  /^(iv[áa]n|lupe|javier|rafa|marta|elena|kanek|to[ñn]o|sof[íi]a|luc[íi]a|chela|timo|nadia|pablo|carmen|rosa|mateo|nico|ana|marina|nerea|greve|ole|nora|merle|bia|tiago|caio|lia|nara|vitor|dani|teo|irene|dario|gaia|livia|rafaela|matheus|bruna|larissa|selma|dora|neide|iara|vera|solange|dorival|tain[áa])$/i;

/**
 * COPIA EXACTA de lo que hace el lector, en dos pasos. Inventarme el corte
 * daba palabras fantasma (`s`, de partir `schmeckt's`) y me escondía otras.
 *
 *  1. `TAPPABLE`: la unidad que el usuario puede tocar. Conserva apóstrofos y
 *     guiones (ver `ReaderScreen.tsx`, la regex de troceo de palabras).
 *  2. `glossKey`: la clave con la que se busca en el bundle. El lector la saca
 *     con `\p{L}+(?:-\p{L}+)*` sobre el token en minúsculas, o sea que el
 *     guion une pero el apóstrofo CORTA: `schmeckt's` busca `schmeckt`.
 *
 * Consecuencia conocida y NO arreglada aquí: en italiano `l'acqua` se toca
 * entera pero busca la clave `l`, así que toda la elisión depende de una
 * glosa para `l`. Eso es un fallo del lector, no del bundle, y tocarlo desde
 * aquí sería arreglar a ciegas la mitad de un problema.
 */
const TAPPABLE = /[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu;

function glossKey(token: string): string {
  const m = token.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u);
  return m ? m[0] : "";
}

function familyOf(bundle: string): string {
  for (const [lang, members] of Object.entries(FAMILIES)) {
    if (members.includes(bundle)) return lang;
  }
  return "";
}

function loadBundle(name: string) {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), "utf8")) as {
    slugs: string[];
    glosses: Record<string, { g: string; t?: string }>;
  };
}

async function main() {
  const argv = process.argv.slice(2);
  // --check: NO escribe y falla si a CUALQUIER bundle le falta una sola glosa,
  // aunque se pudiera copiar de un hermano. Es el modo del guard, y el umbral
  // es distinto a propósito: "se podría rellenar" no es lo mismo que "está
  // relleno". Mientras no se haya corrido el rebuild, esa palabra está muerta
  // en el móvil del usuario.
  const check = argv.includes("--check");
  const dry = check || argv.includes("--dry");
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
  const stale: string[] = [];

  const manual: Record<string, Record<string, { g: string; t?: string }>> = fs.existsSync(MANUAL)
    ? JSON.parse(fs.readFileSync(MANUAL, "utf8"))
    : {};

  const names = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("talking-points"))
    .map((f) => f.replace(/\.json$/, ""))
    .filter((n) => (only ? n === only : true));

  let totalAdded = 0;
  const blocked: string[] = [];

  for (const name of names) {
    const bundle = loadBundle(name);
    const own = new Map(Object.entries(bundle.glosses).map(([k, v]) => [k.toLowerCase(), v]));

    // Pool hermano: primera aparición gana, y el propio bundle no cuenta.
    const sibling = new Map<string, { g: string; t?: string }>();
    for (const other of FAMILIES[familyOf(name)] ?? []) {
      if (other === name) continue;
      for (const [k, v] of Object.entries(loadBundle(other).glosses)) {
        const key = k.toLowerCase();
        if (!sibling.has(key)) sibling.set(key, v);
      }
    }

    const stories = await prisma.$queryRawUnsafe<Array<{ title: string | null; text: string | null }>>(
      `SELECT "title","text" FROM "dp_journey_stories_v1" WHERE "slug" = ANY($1::text[])`,
      bundle.slugs
    );

    const needed = new Set<string>();
    for (const story of stories) {
      // CUERPO y TÍTULO. El título es la superficie que faltaba.
      const body = extractStoryPlainText(story.text ?? "");
      for (const source of [body, story.title ?? ""]) {
        for (const token of source.match(TAPPABLE) ?? []) {
          const key = glossKey(token);
          if (!key || own.has(key) || CHARACTER_NAMES.test(key)) continue;
          needed.add(key);
        }
      }
    }

    if (needed.size === 0) {
      console.log(`${name.padEnd(30)} al día`);
      continue;
    }

    const fromSibling: string[] = [];
    const fromManual: string[] = [];
    const uncovered: string[] = [];
    const additions: Record<string, { g: string; t?: string }> = {};

    for (const key of needed) {
      const sib = sibling.get(key);
      const man = manual[name]?.[key];
      // El manual gana: se escribió mirando ESTA frase.
      if (man) {
        additions[key] = man;
        fromManual.push(key);
      } else if (sib) {
        additions[key] = sib;
        fromSibling.push(key);
      } else {
        uncovered.push(key);
      }
    }

    stale.push(`${name} (${needed.size})`);
    console.log(
      `${name.padEnd(30)} faltan ${needed.size}: ${fromSibling.length} copiadas, ` +
        `${fromManual.length} escritas a mano, ${uncovered.length} SIN CUBRIR`
    );
    if (uncovered.length > 0) {
      console.log(`   sin cubrir: ${uncovered.slice(0, 20).join(", ")}`);
      blocked.push(name);
      continue;
    }

    totalAdded += Object.keys(additions).length;
    if (dry) continue;

    // Aditivo, y CONSERVANDO EL ORDEN existente: las nuevas van al final,
    // ordenadas entre ellas. Reordenar el fichero entero daba un diff de
    // 44.000 líneas para 391 altas, que es irrevisable y arruina cualquier
    // `git blame` sobre una glosa concreta.
    const merged: Record<string, { g: string; t?: string }> = { ...bundle.glosses };
    for (const key of Object.keys(additions).sort()) merged[key] = additions[key];
    fs.writeFileSync(
      path.join(DIR, `${name}.json`),
      JSON.stringify({ slugs: bundle.slugs, glosses: merged }, null, 1)
    );
  }

  if (check) {
    if (stale.length === 0) {
      console.log("\nlookup al día: cada palabra tocable tiene su glosa");
      return;
    }
    console.error(
      `\nLOOKUP DESFASADO en ${stale.length} bundle(s): ${stale.join(", ")}\n\n` +
        "Se ha editado una historia y sus glosas se quedaron atrás. Cada palabra\n" +
        "que falta es un toque muerto en el móvil: el usuario la toca y no sale\n" +
        "nada, sin ningún aviso. Asi se perdió una noche entera el 2026-08-07,\n" +
        "con un journey en producción con una de cada ocho palabras muerta.\n\n" +
        "Arreglo:  npx tsx scripts/rebuildTapGlosses.ts\n" +
        "Si pide glosas nuevas, se escriben en scripts/_newGlosses.json.\n"
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `\n${dry ? "[dry] " : ""}${totalAdded} glosas añadidas` +
      (blocked.length ? `; NO escritos por huecos: ${blocked.join(", ")}` : "")
  );
  if (blocked.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
