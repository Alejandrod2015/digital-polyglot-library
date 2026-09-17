/**
 * Guarda en la base las traducciones de ORACION que escribio un chat ejecutor.
 *
 * Uso:
 *   npx tsx scripts/saveSentenceTranslations.ts docs/sentence-translations/<journeyId>.json
 *   npx tsx scripts/saveSentenceTranslations.ts <fichero> --dry
 *
 * TODO O NADA. Si una sola traduccion falla una comprobacion, no se escribe
 * ninguna. Una tanda a medias es peor que ninguna: deja la historia con unas
 * frases traducidas y otras no, y nadie sabe cuales sin volver a mirarlas una
 * por una.
 *
 * La clave es la ORACION normalizada (`normalizeSentenceKey`), no la palabra:
 * una palabra no identifica una frase, y por eso la etiqueta MEANING ensenaba
 * la traduccion de una oracion distinta de la que se leia en pantalla.
 *
 * Que se comprueba, y por que cada cosa:
 *   - Cada palabra de `words` existe en el vocab de la historia. Una entrada
 *     que no casa con nada apunta a un volcado viejo: mejor pararlo.
 *   - La traduccion no esta vacia.
 *   - Sin guiones largos, que es regla dura del proyecto y esto va a pantalla.
 *   - Sin caracteres fuera de ASCII salvo los que ya estan en la frase de
 *     origen. Sirve para cazar la traduccion que se quedo a medias en el idioma
 *     original ("la manana" en vez de "the morning") sin castigar los nombres
 *     propios, que si se conservan.
 *   - Entre 0,5 y 2,5 veces las palabras de la frase. Fuera de esa banda no es
 *     una traduccion: o falta media frase o sobra un comentario.
 *   - No deja la palabra objetivo SIN traducir. Es el fallo mas probable de
 *     todos. Con dos salidas: que la definicion en ingles de la palabra use esa
 *     misma forma ("Spaghetti; long thin pasta..."), o que el termino este en
 *     `docs/sentence-translations/keep-as-is.json`, la lista de los que un
 *     traductor deja tal cual aunque su definicion diga otra cosa (`barista`
 *     esta definido como "Barman; ..."). Ver `translationLeavesWordUntranslated`.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import * as fs from "fs";
import * as path from "path";
// `PrismaClient` del cliente generado, y NO `@/lib/prisma`: ese modulo lleva el
// sello `server-only`, que bajo tsx se resuelve al entry que TIRA. Es el mismo
// patron que usa `scripts/journeysTable.ts`.
import { PrismaClient } from "../src/generated/prisma";
import {
  normalizeSentenceKey,
  sentenceTranslationKey,
  translationLeavesWordUntranslated,
} from "../src/lib/sentenceTranslation";

const prisma = new PrismaClient();

/**
 * El generador canonico de sets, cargado SOLO si hace falta: arrastra
 * `@/lib/prisma` y con el el sello `server-only`. Casi todas las historias ya
 * tienen set, asi que el camino normal no lo toca.
 */
async function crearSetDePractica(storyId: string): Promise<void> {
  const { buildAndPersistStoryPracticeSet } = await import("../src/lib/storyPracticeSets");
  await buildAndPersistStoryPracticeSet(storyId, false);
}

/** Guiones largos por codigo: el literal no puede aparecer en `scripts/`. */
const GUIONES_LARGOS = new RegExp(`[${String.fromCharCode(8212, 8211)}]`, "g");

const MIN_RATIO = 0.5;
const MAX_RATIO = 2.5;

/**
 * Terminos que se dejan tal cual, por idioma. Vive en `docs/` y no aqui a
 * proposito: ampliarla exige tocar un fichero en un commit, que es lo unico que
 * impide que crezca por pereza cada vez que el gate moleste.
 */
const KEEP_AS_IS = path.join(process.cwd(), "docs", "sentence-translations", "keep-as-is.json");

function cargarKeepAsIs(): Record<string, string[]> {
  try {
    const crudo = JSON.parse(fs.readFileSync(KEEP_AS_IS, "utf8")) as Record<string, unknown>;
    const out: Record<string, string[]> = {};
    for (const [idioma, valor] of Object.entries(crudo)) {
      if (idioma.startsWith("_")) continue;
      if (Array.isArray(valor)) {
        out[idioma.toLowerCase()] = valor.filter((v): v is string => typeof v === "string");
      }
    }
    return out;
  } catch {
    // Sin lista, el validador sigue funcionando: solo exime por definicion.
    console.error(`Aviso: no pude leer ${path.relative(process.cwd(), KEEP_AS_IS)}.`);
    return {};
  }
}

type OracionEntrada = {
  sentence?: unknown;
  /** Las palabras del vocab que usan esa oracion. */
  words?: unknown;
  translation?: unknown;
};

type HistoriaEntrada = {
  storySlug?: unknown;
  sentences?: unknown;
  /** Idioma de la historia, que elige la lista de terminos a dejar tal cual. */
  language?: unknown;
};

function palabras(texto: string): string[] {
  const t = texto.trim();
  return t ? t.split(/\s+/) : [];
}

/** Caracteres no ASCII de un texto, en minusculas y sin repetir. */
function noAscii(texto: string): Set<string> {
  const out = new Set<string>();
  for (const ch of texto.toLowerCase()) {
    if (ch.charCodeAt(0) > 127) out.add(ch);
  }
  return out;
}

type Problema = { storySlug: string; donde: string; motivo: string };

/** Un trozo corto de la oracion, para que el informe se pueda leer. */
function recorta(sentence: string): string {
  const t = sentence.trim();
  return t.length <= 48 ? t : `${t.slice(0, 45)}...`;
}

function revisar(
  storySlug: string,
  sentence: string,
  translation: string,
  words: string[],
  vocabDeLaHistoria: Map<string, string>,
  keepAsIs: readonly string[]
): Problema[] {
  const fallos: Problema[] = [];
  const donde = recorta(sentence);
  const di = (motivo: string) => fallos.push({ storySlug, donde, motivo });

  if (!sentence.trim()) {
    di("entrada sin `sentence`");
    return fallos;
  }
  if (!normalizeSentenceKey(sentence)) {
    di("la oracion no deja clave: no tiene letras ni numeros");
  }
  if (!translation.trim()) {
    di("traduccion vacia");
    return fallos;
  }
  if (GUIONES_LARGOS.test(translation)) {
    di("lleva guion largo");
  }
  const permitidos = noAscii(sentence);
  const sobrantes = [...noAscii(translation)].filter((ch) => !permitidos.has(ch));
  if (sobrantes.length > 0) {
    di(`caracteres que no estan en la frase de origen: ${sobrantes.join(" ")}`);
  }
  const nOrigen = palabras(sentence).length;
  const nDestino = palabras(translation).length;
  if (nOrigen > 0) {
    const ratio = nDestino / nOrigen;
    if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
      di(`largo fuera de banda: ${nDestino} palabras para ${nOrigen} (x${ratio.toFixed(2)})`);
    }
  }
  // La regla de "palabra objetivo sin traducir" se mide contra TODAS las
  // palabras del vocab que usan esta oracion, con las dos exenciones de
  // siempre: su definicion en ingles, o `keep-as-is.json`.
  for (const word of words) {
    const clave = sentenceTranslationKey(word);
    if (!vocabDeLaHistoria.has(clave)) {
      di(`"${word}" no esta en el vocab de la historia`);
      continue;
    }
    if (translationLeavesWordUntranslated(translation, word, vocabDeLaHistoria.get(clave), keepAsIs)) {
      di(`la traduccion deja "${word}" sin traducir`);
    }
  }
  return fallos;
}

async function main() {
  const ficheroArg = process.argv[2]?.trim();
  const dry = process.argv.includes("--dry");
  if (!ficheroArg) {
    console.error(
      "Falta el fichero.\n  npx tsx scripts/saveSentenceTranslations.ts docs/sentence-translations/<journeyId>.json [--dry]"
    );
    process.exit(2);
  }
  const fichero = path.resolve(process.cwd(), ficheroArg);
  if (!fs.existsSync(fichero)) {
    console.error(`No existe ${ficheroArg}.`);
    process.exit(2);
  }

  const datos = JSON.parse(fs.readFileSync(fichero, "utf8")) as { stories?: unknown };
  const historias = Array.isArray(datos.stories) ? (datos.stories as HistoriaEntrada[]) : [];
  if (historias.length === 0) {
    console.error("El fichero no trae `stories`.");
    process.exit(2);
  }

  const problemas: Problema[] = [];
  const porHistoria = new Map<string, Record<string, string>>();
  const keepAsIsPorIdioma = cargarKeepAsIs();

  for (const historia of historias) {
    const idioma =
      typeof historia.language === "string" ? historia.language.trim().toLowerCase() : "";
    const keepAsIs = keepAsIsPorIdioma[idioma] ?? [];
    const storySlug = typeof historia.storySlug === "string" ? historia.storySlug.trim() : "";
    if (!storySlug) {
      problemas.push({ storySlug: "(sin slug)", donde: "", motivo: "historia sin storySlug" });
      continue;
    }
    const story = await prisma.journeyStory.findFirst({
      where: { slug: storySlug },
      select: { id: true, vocab: true, practiceSet: { select: { id: true } } },
    });
    if (!story) {
      problemas.push({ storySlug, donde: "", motivo: "no existe esa historia" });
      continue;
    }
    // Palabra normalizada -> su definicion en ingles, que es la primera
    // exencion de la regla de "palabra sin traducir".
    const vocabDeLaHistoria = new Map<string, string>();
    for (const v of ((story.vocab as { word?: unknown; definition?: unknown }[] | null) ?? [])) {
      if (typeof v?.word !== "string") continue;
      vocabDeLaHistoria.set(
        sentenceTranslationKey(v.word),
        typeof v?.definition === "string" ? v.definition : ""
      );
    }

    const oraciones = Array.isArray(historia.sentences)
      ? (historia.sentences as OracionEntrada[])
      : [];
    if (oraciones.length === 0) {
      problemas.push({ storySlug, donde: "", motivo: "historia sin `sentences`" });
      continue;
    }
    const mapa: Record<string, string> = {};
    for (const entrada of oraciones) {
      const sentence = typeof entrada.sentence === "string" ? entrada.sentence.trim() : "";
      const translation =
        typeof entrada.translation === "string" ? entrada.translation.trim() : "";
      const words = Array.isArray(entrada.words)
        ? entrada.words.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
        : [];
      if (!sentence) {
        problemas.push({ storySlug, donde: "", motivo: "entrada sin `sentence`" });
        continue;
      }
      // Una oracion sin traducir todavia no es un error: el ejecutor puede ir
      // por partes. Simplemente no se guarda.
      if (!translation) continue;
      problemas.push(
        ...revisar(storySlug, sentence, translation, words, vocabDeLaHistoria, keepAsIs)
      );
      mapa[normalizeSentenceKey(sentence)] = translation;
    }
    if (Object.keys(mapa).length > 0) porHistoria.set(storySlug, mapa);
  }

  if (problemas.length > 0) {
    console.error(`${problemas.length} problemas. NO se ha escrito nada:\n`);
    for (const p of problemas) {
      console.error(`  ${p.storySlug} / ${p.donde || "(historia)"}: ${p.motivo}`);
    }
    process.exit(1);
  }

  if (porHistoria.size === 0) {
    console.log("Nada que guardar: ninguna oracion trae traduccion.");
    return;
  }

  if (dry) {
    console.log("--dry: validado y sin escribir.");
    for (const [slug, mapa] of porHistoria) {
      console.log(`  ${slug}: ${Object.keys(mapa).length}`);
    }
    return;
  }

  for (const [storySlug, mapa] of porHistoria) {
    const story = await prisma.journeyStory.findFirst({
      where: { slug: storySlug },
      select: { id: true, practiceSet: { select: { id: true, sentenceTranslations: true } } },
    });
    if (!story) continue;

    let setId = story.practiceSet?.id ?? null;
    let previas = (story.practiceSet?.sentenceTranslations ?? {}) as Record<string, string>;
    if (!setId) {
      // La historia no tenia set: se arma con el generador canonico, que es el
      // unico que sabe como es un set. Aqui no se inventa ninguno.
      await crearSetDePractica(story.id);
      const recargada = await prisma.journeyStory.findUnique({
        where: { id: story.id },
        select: { practiceSet: { select: { id: true, sentenceTranslations: true } } },
      });
      setId = recargada?.practiceSet?.id ?? null;
      previas = (recargada?.practiceSet?.sentenceTranslations ?? {}) as Record<string, string>;
    }
    if (!setId) {
      console.error(`  ${storySlug}: no se pudo crear el set de practica; se salta.`);
      continue;
    }

    // Se FUSIONA con lo que hubiera: dos tandas del mismo journey no se pisan.
    await prisma.storyPracticeSet.update({
      where: { id: setId },
      data: { sentenceTranslations: { ...previas, ...mapa } },
    });
    console.log(`  ${storySlug}: ${Object.keys(mapa).length} guardadas`);
  }
  console.log(`Listo: ${porHistoria.size} historias.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
