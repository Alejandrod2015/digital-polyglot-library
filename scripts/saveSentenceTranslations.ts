/**
 * Guarda en la base las traducciones de frase que escribio un chat ejecutor.
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
 * Que se comprueba, y por que cada cosa:
 *   - La palabra existe en el vocab de la historia. Una clave que no casa no
 *     se lee nunca: seria trabajo tirado que nadie echaria de menos.
 *   - La traduccion no esta vacia.
 *   - Sin guiones largos, que es regla dura del proyecto y esto va a pantalla.
 *   - Sin caracteres fuera de ASCII salvo los que ya estan en la frase de
 *     origen. Sirve para cazar la traduccion que se quedo a medias en el idioma
 *     original ("la manana" en vez de "the morning") sin castigar los nombres
 *     propios, que si se conservan.
 *   - Entre 0,5 y 2,5 veces las palabras de la frase. Fuera de esa banda no es
 *     una traduccion: o falta media frase o sobra un comentario.
 *   - No contiene la palabra objetivo en el idioma de origen. Es el fallo mas
 *     probable de todos: dejar sin traducir justo la palabra que el ejercicio
 *     pide.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import * as fs from "fs";
import * as path from "path";
// `PrismaClient` del cliente generado, y NO `@/lib/prisma`: ese modulo lleva el
// sello `server-only`, que bajo tsx se resuelve al entry que TIRA. Es el mismo
// patron que usa `scripts/journeysTable.ts`.
import { PrismaClient } from "../src/generated/prisma";
import { sentenceTranslationKey } from "../src/lib/sentenceTranslation";

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

type PalabraEntrada = {
  word?: unknown;
  sentence?: unknown;
  translation?: unknown;
};

type HistoriaEntrada = {
  storySlug?: unknown;
  words?: unknown;
};

function palabras(texto: string): string[] {
  const t = texto.trim();
  return t ? t.split(/\s+/) : [];
}

function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Caracteres no ASCII de un texto, en minusculas y sin repetir. */
function noAscii(texto: string): Set<string> {
  const out = new Set<string>();
  for (const ch of texto.toLowerCase()) {
    if (ch.charCodeAt(0) > 127) out.add(ch);
  }
  return out;
}

function contienePalabraCompleta(texto: string, palabra: string): boolean {
  const tokens = sinAcentos(texto)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const buscados = sinAcentos(palabra)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (buscados.length === 0) return false;
  for (let i = 0; i <= tokens.length - buscados.length; i += 1) {
    if (buscados.every((b, j) => tokens[i + j] === b)) return true;
  }
  return false;
}

type Problema = { storySlug: string; word: string; motivo: string };

function revisar(
  storySlug: string,
  word: string,
  sentence: string,
  translation: string,
  vocabDeLaHistoria: Set<string>
): Problema[] {
  const fallos: Problema[] = [];
  const di = (motivo: string) => fallos.push({ storySlug, word, motivo });

  if (!vocabDeLaHistoria.has(sentenceTranslationKey(word))) {
    di("la palabra no esta en el vocab de la historia");
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
  if (contienePalabraCompleta(translation, word)) {
    di(`la traduccion deja "${word}" sin traducir`);
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

  for (const historia of historias) {
    const storySlug = typeof historia.storySlug === "string" ? historia.storySlug.trim() : "";
    if (!storySlug) {
      problemas.push({ storySlug: "(sin slug)", word: "", motivo: "historia sin storySlug" });
      continue;
    }
    const story = await prisma.journeyStory.findFirst({
      where: { slug: storySlug },
      select: { id: true, vocab: true, practiceSet: { select: { id: true } } },
    });
    if (!story) {
      problemas.push({ storySlug, word: "", motivo: "no existe esa historia" });
      continue;
    }
    const vocabDeLaHistoria = new Set(
      ((story.vocab as { word?: unknown }[] | null) ?? [])
        .map((v) => (typeof v?.word === "string" ? sentenceTranslationKey(v.word) : ""))
        .filter(Boolean)
    );

    const words = Array.isArray(historia.words) ? (historia.words as PalabraEntrada[]) : [];
    const mapa: Record<string, string> = {};
    for (const entrada of words) {
      const word = typeof entrada.word === "string" ? entrada.word.trim() : "";
      const sentence = typeof entrada.sentence === "string" ? entrada.sentence.trim() : "";
      const translation =
        typeof entrada.translation === "string" ? entrada.translation.trim() : "";
      if (!word) {
        problemas.push({ storySlug, word: "(sin palabra)", motivo: "entrada sin `word`" });
        continue;
      }
      // Una palabra sin traducir todavia no es un error: el ejecutor puede ir
      // por partes. Simplemente no se guarda.
      if (!translation) continue;
      problemas.push(...revisar(storySlug, word, sentence, translation, vocabDeLaHistoria));
      mapa[sentenceTranslationKey(word)] = translation;
    }
    if (Object.keys(mapa).length > 0) porHistoria.set(storySlug, mapa);
  }

  if (problemas.length > 0) {
    console.error(`${problemas.length} problemas. NO se ha escrito nada:\n`);
    for (const p of problemas) {
      console.error(`  ${p.storySlug} / ${p.word || "(historia)"}: ${p.motivo}`);
    }
    process.exit(1);
  }

  if (porHistoria.size === 0) {
    console.log("Nada que guardar: ninguna palabra trae traduccion.");
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
