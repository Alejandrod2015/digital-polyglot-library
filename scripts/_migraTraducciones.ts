/**
 * UN SOLO USO: pasa las traducciones ya escritas de clave PALABRA a clave
 * ORACION, en los ficheros de `docs/sentence-translations/` y en la columna.
 *
 * Por que puede escribir la columna sin pasar por `saveSentenceTranslations.ts`,
 * que es la unica puerta de la regla `sentence-translations-canonical`: aqui no
 * nace NINGUNA traduccion nueva. Cada cadena que se escribe ya paso ese
 * validador cuando se guardo por palabra; lo unico que cambia es la clave con
 * la que se busca. Traducir es lo que sigue estando prohibido fuera de la
 * puerta, y este script no traduce: lo que no encuentra lo deja vacio en un
 * `.todo2.json` para que lo escriba un chat de contenido.
 *
 * Que hace, por journey:
 *   1. Lee el fichero viejo (`<journeyId>.json`, formato `words[]`).
 *   2. Recalcula las oraciones candidatas de cada historia igual que el dump
 *      nuevo (limpia del item, la del texto, y la del `fill_blank` curado).
 *   3. Casa cada candidata con la traduccion vieja cuya `sentence` normaliza
 *      igual. Las que casan van al `<journeyId>.json` nuevo; las que no, con
 *      `translation: ""`, al `<journeyId>.todo2.json`.
 *   4. REESCRIBE (no fusiona) la columna de esas historias: las claves viejas
 *      eran palabras y ninguna se va a leer ya.
 *
 * Uso:
 *   npx tsx scripts/_migraTraducciones.ts --dry
 *   npx tsx scripts/_migraTraducciones.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { buildPracticeItemsFromStory } from "../src/lib/storyPracticeItems";
import { getContextSentence, singleCleanSentence } from "../src/lib/practiceExercises";
import { normalizeSentenceKey, sentenceFromBlanked } from "../src/lib/sentenceTranslation";

const prisma = new PrismaClient();
const DIR = path.join(process.cwd(), "docs", "sentence-translations");

type EntradaVieja = { word?: unknown; sentence?: unknown; translation?: unknown };
type HistoriaVieja = { storySlug?: unknown; words?: unknown };
type FicheroViejo = {
  journeyId?: unknown;
  journeyName?: unknown;
  language?: unknown;
  variant?: unknown;
  stories?: unknown;
};

type OracionNueva = { sentence: string; words: string[]; translation: string };

function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function migraJourney(fichero: string, dry: boolean) {
  const journeyId = path.basename(fichero, ".json");
  const viejo = JSON.parse(fs.readFileSync(fichero, "utf8")) as FicheroViejo;
  const historiasViejas = Array.isArray(viejo.stories) ? (viejo.stories as HistoriaVieja[]) : [];

  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
    select: { id: true, name: true, language: true, variant: true },
  });
  if (!journey) {
    console.error(`  ${journeyId}: ese journey ya no existe; se salta.`);
    return null;
  }

  // Traducciones viejas por historia y ORACION normalizada.
  const viejasPorHistoria = new Map<string, Map<string, string>>();
  for (const h of historiasViejas) {
    const slug = texto(h.storySlug);
    if (!slug) continue;
    const mapa = viejasPorHistoria.get(slug) ?? new Map<string, string>();
    for (const w of Array.isArray(h.words) ? (h.words as EntradaVieja[]) : []) {
      const sentence = texto(w.sentence);
      const translation = texto(w.translation);
      if (!sentence || !translation) continue;
      const clave = normalizeSentenceKey(sentence);
      if (clave && !mapa.has(clave)) mapa.set(clave, translation);
    }
    viejasPorHistoria.set(slug, mapa);
  }

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId, status: "published" },
    orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      text: true,
      level: true,
      vocab: true,
      voiceId: true,
      practiceSet: {
        select: {
          id: true,
          exercises: { select: { type: true, word: true, payload: true } },
        },
      },
    },
  });

  const conTraduccion: unknown[] = [];
  const pendientes: unknown[] = [];
  let migradas = 0;
  let vacias = 0;
  let sinCasar = 0;
  const casadas = new Set<string>();

  for (const story of stories) {
    if (!story.slug || !story.title || !story.text) continue;
    const items = buildPracticeItemsFromStory({
      title: story.title,
      slug: story.slug,
      text: story.text,
      language: journey.language,
      sourcePath: `journey/${story.id}`,
      vocab: (story.vocab as object[]) as never,
      voiceId: story.voiceId,
    });

    const porClave = new Map<string, OracionNueva>();
    const anade = (sentence: string, word?: string | null) => {
      const limpia = (sentence ?? "").trim();
      const clave = normalizeSentenceKey(limpia);
      if (!clave) return;
      let entrada = porClave.get(clave);
      if (!entrada) {
        entrada = { sentence: limpia, words: [], translation: "" };
        porClave.set(clave, entrada);
      }
      const palabra = (word ?? "").trim();
      if (palabra && !entrada.words.includes(palabra)) entrada.words.push(palabra);
    };

    for (const item of items) {
      const limpia = singleCleanSentence(item);
      if (limpia) anade(limpia, item.word);
      const delTexto = getContextSentence(item);
      if (delTexto.trim()) anade(delTexto, item.word);
    }
    for (const ex of story.practiceSet?.exercises ?? []) {
      if (ex.type !== "fill_blank") continue;
      const payload = (ex.payload ?? null) as Record<string, unknown> | null;
      const entera = sentenceFromBlanked(payload?.sentence, payload?.answer);
      if (entera) anade(entera, ex.word);
    }

    const viejas = viejasPorHistoria.get(story.slug) ?? new Map<string, string>();
    const llenas: OracionNueva[] = [];
    const huecas: OracionNueva[] = [];
    for (const [clave, entrada] of porClave) {
      const traduccion = viejas.get(clave);
      if (traduccion) {
        casadas.add(`${story.slug}::${clave}`);
        llenas.push({ ...entrada, translation: traduccion });
      } else {
        huecas.push(entrada);
      }
    }
    migradas += llenas.length;
    vacias += huecas.length;

    const cabecera = {
      storySlug: story.slug,
      storyTitle: story.title,
      level: story.level,
      language: journey.language,
      variant: journey.variant,
    };
    if (llenas.length > 0) conTraduccion.push({ ...cabecera, sentences: llenas });
    if (huecas.length > 0) pendientes.push({ ...cabecera, sentences: huecas });

    // La columna se REESCRIBE: las claves viejas eran palabras.
    if (!dry && story.practiceSet?.id) {
      const columna: Record<string, string> = {};
      for (const entrada of llenas) columna[normalizeSentenceKey(entrada.sentence)] = entrada.translation;
      await prisma.storyPracticeSet.update({
        where: { id: story.practiceSet.id },
        data: { sentenceTranslations: columna },
      });
    }
  }

  // Traducciones viejas que ninguna candidata nueva reclamo: casi siempre la
  // frase del vocab de una palabra que hoy no llega a pantalla por ningun
  // camino. No se pierden: se quedan en el fichero viejo del historial de git.
  for (const [slug, mapa] of viejasPorHistoria) {
    for (const clave of mapa.keys()) {
      if (!casadas.has(`${slug}::${clave}`)) sinCasar += 1;
    }
  }

  const meta = {
    journeyId,
    journeyName: journey.name,
    language: journey.language,
    variant: journey.variant,
  };
  if (!dry) {
    fs.writeFileSync(
      path.join(DIR, `${journeyId}.json`),
      `${JSON.stringify(
        {
          _comoSeUsa:
            "Formato NUEVO: la clave es la oracion. Para guardar: npx tsx scripts/saveSentenceTranslations.ts docs/sentence-translations/<journeyId>.json",
          _migrado:
            "Convertido desde el formato por palabra por scripts/_migraTraducciones.ts. Las oraciones que quedaron sin traducir viven en <journeyId>.todo2.json.",
          ...meta,
          stories: conTraduccion,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(DIR, `${journeyId}.todo2.json`),
      `${JSON.stringify(
        {
          _comoSeUsa:
            "Oraciones candidatas que el volcado nuevo encontro y nadie ha traducido. Rellena `translation` y guardalo con: npx tsx scripts/saveSentenceTranslations.ts docs/sentence-translations/<journeyId>.todo2.json",
          _words:
            "`words` son las palabras del vocab que usan esa oracion. El validador comprueba que la traduccion no deje ninguna de ellas sin traducir.",
          ...meta,
          stories: pendientes,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  return { journeyId, name: journey.name, migradas, vacias, sinCasar };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const ficheros = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json") && f !== "keep-as-is.json" && !f.includes(".todo"))
    .map((f) => path.join(DIR, f));

  if (ficheros.length === 0) {
    console.error(`No hay ficheros que migrar en ${path.relative(process.cwd(), DIR)}.`);
    process.exit(2);
  }

  console.log(dry ? "--dry: sin escribir nada.\n" : "");
  for (const fichero of ficheros) {
    const r = await migraJourney(fichero, dry);
    if (!r) continue;
    console.log(
      `${r.journeyId} (${r.name}): ${r.migradas} con traduccion, ${r.vacias} vacias, ` +
        `${r.sinCasar} traducciones viejas sin candidata nueva.`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
