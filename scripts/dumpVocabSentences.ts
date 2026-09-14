/**
 * Saca a un fichero las ORACIONES que hay que traducir de un journey, para que
 * un chat ejecutor las traduzca a mano.
 *
 * WHY el volcado va por ORACION y no por palabra: la columna se indexaba por
 * palabra, y una palabra no identifica una frase. La traduccion se escribio
 * contra la frase del vocab, pero el ejercicio puede pintar otra (el
 * `exampleSentence` del favorito, el item construido desde el texto, o el
 * `fill_blank` curado), asi que la etiqueta MEANING ensenaba la traduccion de
 * una oracion distinta de la que se leia. Ahora se vuelcan TODAS las
 * candidatas de la historia, deduplicadas por `normalizeSentenceKey`, y cada
 * una se traduce una sola vez.
 *
 * Las tres fuentes, que son los tres caminos por los que una frase llega a
 * pantalla:
 *   1. `singleCleanSentence` del item: la que ensena el turno hablado.
 *   2. La oracion del item de `buildPracticeItemsFromStory` (`getContextSentence`),
 *      que es la forma en que llega desde el texto de la historia.
 *   3. La `sentence` de cada `fill_blank` curado del set, con la respuesta
 *      devuelta a su hueco.
 *
 * Uso:
 *   npx tsx scripts/dumpVocabSentences.ts <journeyId>
 *
 * Escribe `docs/sentence-translations/<journeyId>.todo.json`. El ejecutor
 * rellena el campo `translation` de cada oracion y lo guarda como
 * `<journeyId>.json`; de ahi lo recoge `scripts/saveSentenceTranslations.ts`.
 *
 * Solo LEE. No escribe en la base ni genera audio.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import * as fs from "fs";
import * as path from "path";
// `PrismaClient` del cliente generado, y NO `@/lib/prisma`: ese modulo lleva el
// sello `server-only`, que bajo tsx se resuelve al entry que TIRA. Es el mismo
// patron que usa `scripts/journeysTable.ts`.
import { PrismaClient } from "../src/generated/prisma";
import { buildPracticeItemsFromStory } from "../src/lib/storyPracticeItems";
import { getContextSentence, singleCleanSentence } from "../src/lib/practiceExercises";
import { normalizeSentenceKey, sentenceFromBlanked } from "../src/lib/sentenceTranslation";

const prisma = new PrismaClient();

const DESTINO = path.join(process.cwd(), "docs", "sentence-translations");

type OracionPendiente = {
  sentence: string;
  /** Las palabras del vocab que usan ESTA oracion. Puede estar vacia cuando la
   *  oracion solo aparece en un `fill_blank` curado de otra forma. */
  words: string[];
  /** Lo rellena el chat ejecutor. */
  translation: string;
};

/** Junta candidatas deduplicando por clave normalizada, sin perder el orden. */
class Candidatas {
  private readonly porClave = new Map<string, OracionPendiente>();

  add(sentence: string, word?: string | null): void {
    const limpia = (sentence ?? "").trim();
    const clave = normalizeSentenceKey(limpia);
    if (!clave) return;
    let entrada = this.porClave.get(clave);
    if (!entrada) {
      entrada = { sentence: limpia, words: [], translation: "" };
      this.porClave.set(clave, entrada);
    }
    const palabra = (word ?? "").trim();
    if (palabra && !entrada.words.includes(palabra)) entrada.words.push(palabra);
  }

  list(): OracionPendiente[] {
    return [...this.porClave.values()];
  }
}

async function main() {
  const journeyId = process.argv[2]?.trim();
  if (!journeyId) {
    console.error("Falta el journeyId.\n  npx tsx scripts/dumpVocabSentences.ts <journeyId>");
    process.exit(2);
  }

  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
    select: { id: true, name: true, language: true, variant: true },
  });
  if (!journey) {
    console.error(`No hay journey con id ${journeyId}.`);
    process.exit(2);
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
        select: { exercises: { select: { type: true, word: true, payload: true } } },
      },
    },
  });

  const historias = [];
  let totalOraciones = 0;

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

    const candidatas = new Candidatas();
    for (const item of items) {
      // 1. La oracion limpia: la que ensena el turno hablado.
      const limpia = singleCleanSentence(item);
      if (limpia) candidatas.add(limpia, item.word);
      // 2. La del item tal como llega desde el texto de la historia. Cuando la
      //    limpia existe suelen ser la misma y la dedup se la come; cuando no,
      //    esta es la que acaba en el favorito.
      const delTexto = getContextSentence(item);
      if (delTexto.trim()) candidatas.add(delTexto, item.word);
    }
    // 3. Las del set curado, con la respuesta devuelta a su hueco.
    for (const ex of story.practiceSet?.exercises ?? []) {
      if (ex.type !== "fill_blank") continue;
      const payload = (ex.payload ?? null) as Record<string, unknown> | null;
      const entera = sentenceFromBlanked(payload?.sentence, payload?.answer);
      if (entera) candidatas.add(entera, ex.word);
    }

    const sentences = candidatas.list();
    if (sentences.length === 0) continue;

    totalOraciones += sentences.length;
    historias.push({
      storySlug: story.slug,
      storyTitle: story.title,
      level: story.level,
      language: journey.language,
      variant: journey.variant,
      sentences,
    });
  }

  fs.mkdirSync(DESTINO, { recursive: true });
  const salida = path.join(DESTINO, `${journeyId}.todo.json`);
  fs.writeFileSync(
    salida,
    `${JSON.stringify(
      {
        _comoSeUsa:
          "Rellena `translation` en cada oracion con su traduccion al ingles, y guarda el fichero como <journeyId>.json (sin .todo). Despues: npx tsx scripts/saveSentenceTranslations.ts docs/sentence-translations/<journeyId>.json",
        _words:
          "`words` son las palabras del vocab que usan esa oracion. El validador comprueba que la traduccion no deje NINGUNA de ellas sin traducir; no hay que nombrarlas ni marcarlas en el texto ingles.",
        journeyId,
        journeyName: journey.name,
        language: journey.language,
        variant: journey.variant,
        stories: historias,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`${historias.length} historias, ${totalOraciones} oraciones distintas.`);
  console.log(`Escrito: ${path.relative(process.cwd(), salida)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
