/**
 * Saca a un fichero las frases que hay que traducir de un journey, para que un
 * chat ejecutor las traduzca a mano.
 *
 * WHY: la traduccion de la frase solo existe en el `fill_blank` curado, y ese
 * solo cubre de 4 a 6 palabras por historia. De las 682 palabras guardadas hoy,
 * 39 tienen traduccion. El resto hay que escribirlas, y escribirlas contra la
 * frase EQUIVOCADA no sirve de nada: la que se traduce tiene que ser la MISMA
 * que el usuario ve y oye en practica.
 *
 * Por eso este script no recompone la frase: llama a `singleCleanSentence`, que
 * es exactamente la que usa el builder, y solo cae a `getContextSentence`
 * cuando aquella devuelve null, marcandolo con `fallback: true` para que quien
 * traduzca sepa que esa no es la que se ensena hoy.
 *
 * Uso:
 *   npx tsx scripts/dumpVocabSentences.ts <journeyId>
 *
 * Escribe `docs/sentence-translations/<journeyId>.todo.json`. El ejecutor
 * rellena el campo `translation` de cada palabra y lo guarda como
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

const prisma = new PrismaClient();

const DESTINO = path.join(process.cwd(), "docs", "sentence-translations");

type PalabraPendiente = {
  word: string;
  surface: string | null;
  definition: string;
  sentence: string;
  /** true cuando la frase NO es la que practica ensena hoy; ver cabecera. */
  fallback?: true;
  /** Lo rellena el chat ejecutor. */
  translation: string;
};

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
    },
  });

  const historias = [];
  let totalPalabras = 0;
  let totalFallback = 0;

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

    const words: PalabraPendiente[] = [];
    for (const item of items) {
      const limpia = singleCleanSentence(item);
      const sentence = limpia ?? getContextSentence(item);
      if (!sentence.trim()) continue;
      words.push({
        word: item.word,
        surface: item.surface ?? null,
        definition: item.translation,
        sentence,
        ...(limpia ? {} : { fallback: true as const }),
        translation: "",
      });
      if (!limpia) totalFallback += 1;
    }
    if (words.length === 0) continue;

    totalPalabras += words.length;
    historias.push({
      storySlug: story.slug,
      storyTitle: story.title,
      level: story.level,
      language: journey.language,
      variant: journey.variant,
      words,
    });
  }

  fs.mkdirSync(DESTINO, { recursive: true });
  const salida = path.join(DESTINO, `${journeyId}.todo.json`);
  fs.writeFileSync(
    salida,
    `${JSON.stringify(
      {
        _comoSeUsa:
          "Rellena `translation` en cada palabra con la traduccion al ingles de `sentence`, y guarda el fichero como <journeyId>.json (sin .todo). Despues: npx tsx scripts/saveSentenceTranslations.ts docs/sentence-translations/<journeyId>.json",
        _fallback:
          "Una palabra con `fallback: true` lleva una frase que la practica NO ensena hoy (la suya no pasa el filtro de oracion limpia). Traducela igual; si esa palabra vuelve a entrar, ya estara.",
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

  console.log(`${historias.length} historias, ${totalPalabras} palabras (${totalFallback} con frase de reserva).`);
  console.log(`Escrito: ${path.relative(process.cwd(), salida)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
