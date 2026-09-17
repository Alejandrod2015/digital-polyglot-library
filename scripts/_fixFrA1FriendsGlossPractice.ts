import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const JOURNEY = "cmtwz1iop000l32jybeo2jg4x";
const BUNDLE = "french-friends-france-a1";

type Patch = {
  slug: string;
  orderIndex: number;
  sentence: string;
  audioSentence: string;
  targetWord: string;
};

const practicePatches: Patch[] = [
  {
    slug: "le-papier-bleu",
    orderIndex: 1,
    sentence: "Marc, un ami d'Amélie, tient un thé [[chaud]].",
    audioSentence: "Marc, un ami d'Amélie, tient un thé chaud.",
    targetWord: "chaud",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 2,
    sentence: "Il [[ouvre]] la cuisine.",
    audioSentence: "Il ouvre la cuisine.",
    targetWord: "ouvre",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 3,
    sentence: "Amélie veut [[parler]] au groupe.",
    audioSentence: "Amélie veut parler au groupe.",
    targetWord: "parler",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 4,
    sentence: "Sur le papier clair, elle [[voit]] une phrase courte.",
    audioSentence: "Sur le papier clair, elle voit une phrase courte.",
    targetWord: "voit",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 5,
    sentence: "Amélie garde le papier [[bleu]], mais elle n'en a plus besoin.",
    audioSentence: "Amélie garde le papier bleu, mais elle n'en a plus besoin.",
    targetWord: "bleu",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 6,
    sentence: "Sur le papier [[clair]], elle voit une phrase courte.",
    audioSentence: "Sur le papier clair, elle voit une phrase courte.",
    targetWord: "clair",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 7,
    sentence: "Je ne [[comprends]] pas si c'est gentil.",
    audioSentence: "Je ne comprends pas si c'est gentil.",
    targetWord: "comprends",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 8,
    sentence: "Marc [[bouge]] déjà la main.",
    audioSentence: "Marc bouge déjà la main.",
    targetWord: "bouge",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 9,
    sentence: "Je peux [[aider]].",
    audioSentence: "Je peux aider.",
    targetWord: "aider",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 10,
    sentence: "Marc montre le [[lundi]] et demande si le groupe vient ici.",
    audioSentence: "Marc montre le lundi et demande si le groupe vient ici.",
    targetWord: "lundi",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 11,
    sentence: "Amélie [[respire]], parce qu'elle a peur de mal écrire.",
    audioSentence: "Amélie respire, parce qu'elle a peur de mal écrire.",
    targetWord: "respire",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 12,
    sentence: "Je [[cherche]] ma phrase.",
    audioSentence: "Je cherche ma phrase.",
    targetWord: "cherche",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 13,
    sentence: "Marc montre le lundi et [[demande]] si le groupe vient ici.",
    audioSentence: "Marc montre le lundi et demande si le groupe vient ici.",
    targetWord: "demande",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 14,
    sentence: "Amélie répond: _____, Marc. Pas ta phrase.",
    audioSentence: "Amélie répond: Lentement, Marc. Pas ta phrase.",
    targetWord: "Lentement",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 15,
    sentence: "Amélie _____ sa ligne.",
    audioSentence: "Amélie trouve sa ligne.",
    targetWord: "trouve",
  },
  {
    slug: "le-papier-bleu",
    orderIndex: 16,
    sentence: "Marc _____ la bouche et pousse le téléphone vers elle.",
    audioSentence: "Marc ferme la bouche et pousse le téléphone vers elle.",
    targetWord: "ferme",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 1,
    sentence: "Il reste près de la fenêtre et [[attend]].",
    audioSentence: "Il reste près de la fenêtre et attend.",
    targetWord: "attend",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 2,
    sentence: "Elle ne veut [[perdre]] personne.",
    audioSentence: "Elle ne veut perdre personne.",
    targetWord: "perdre",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 3,
    sentence: "Amélie a la main [[froide]].",
    audioSentence: "Amélie a la main froide.",
    targetWord: "froide",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 4,
    sentence: "Son [[train]] arrive dans une heure.",
    audioSentence: "Son train arrive dans une heure.",
    targetWord: "train",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 5,
    sentence: "Son train arrive dans une [[heure]].",
    audioSentence: "Son train arrive dans une heure.",
    targetWord: "heure",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 6,
    sentence: "La nuit [[semble]] déjà proche.",
    audioSentence: "La nuit semble déjà proche.",
    targetWord: "semble",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 7,
    sentence: "On peut [[revenir]] au message demain.",
    audioSentence: "On peut revenir au message demain.",
    targetWord: "revenir",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 8,
    sentence: "Amélie secoue la [[tête]].",
    audioSentence: "Amélie secoue la tête.",
    targetWord: "tête",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 9,
    sentence: "Elle [[veut]] une réponse claire.",
    audioSentence: "Elle veut une réponse claire.",
    targetWord: "veut",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 10,
    sentence: "Elle veut une [[réponse]] claire.",
    audioSentence: "Elle veut une réponse claire.",
    targetWord: "réponse",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 11,
    sentence: "Passe-moi le [[stylo]] noir.",
    audioSentence: "Passe-moi le stylo noir.",
    targetWord: "stylo",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 12,
    sentence: "Passe-moi le stylo [[noir]].",
    audioSentence: "Passe-moi le stylo noir.",
    targetWord: "noir",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 13,
    sentence: "Marc [[porte]] le sac et promet: Je reste ici.",
    audioSentence: "Marc porte le sac et promet: Je reste ici.",
    targetWord: "porte",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 14,
    sentence: "La [[nuit]] semble déjà proche.",
    audioSentence: "La nuit semble déjà proche.",
    targetWord: "nuit",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 15,
    sentence: "Le gâteau coûte _____.",
    audioSentence: "Le gâteau coûte cher.",
    targetWord: "cher",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 16,
    sentence: "C'est _____ par mon coeur.",
    audioSentence: "C'est accepté par mon coeur.",
    targetWord: "accepté",
  },
  {
    slug: "la-ligne-corrigee",
    orderIndex: 17,
    sentence: "L'invitation _____ juste.",
    audioSentence: "L'invitation sort juste.",
    targetWord: "sort",
  },
  {
    slug: "le-mardi-choisi",
    orderIndex: 4,
    sentence: "Vendredi, elle a [[promis]] un après-midi libre à une amie.",
    audioSentence: "Vendredi, elle a promis un après-midi libre à une amie.",
    targetWord: "promis",
  },
  {
    slug: "le-mardi-choisi",
    orderIndex: 5,
    sentence: "Vendredi, elle a promis un [[après-midi]] libre à une amie.",
    audioSentence: "Vendredi, elle a promis un après-midi libre à une amie.",
    targetWord: "après-midi",
  },
  {
    slug: "le-mardi-choisi",
    orderIndex: 8,
    sentence: "Olivier [[écrit]] mardi sur le papier.",
    audioSentence: "Olivier écrit mardi sur le papier.",
    targetWord: "écrit",
  },
  {
    slug: "le-mardi-choisi",
    orderIndex: 10,
    sentence: "[[Ici]], maintenant, Olivier attend une seconde.",
    audioSentence: "Ici, maintenant, Olivier attend une seconde.",
    targetWord: "Ici",
  },
  {
    slug: "avant-le-retour",
    orderIndex: 3,
    sentence: "Le [[cou]] d'Amélie pique parce qu'elle veut protester.",
    audioSentence: "Le cou d'Amélie pique parce qu'elle veut protester.",
    targetWord: "cou",
  },
  {
    slug: "avant-le-retour",
    orderIndex: 4,
    sentence: "Elle veut protester et rester [[bonne]] amie.",
    audioSentence: "Elle veut protester et rester bonne amie.",
    targetWord: "bonne",
  },
  {
    slug: "avant-le-retour",
    orderIndex: 5,
    sentence: "Elle boit de l'[[eau]] et regarde Marc.",
    audioSentence: "Elle boit de l'eau et regarde Marc.",
    targetWord: "eau",
  },
  {
    slug: "avant-le-retour",
    orderIndex: 12,
    sentence: "[[Avant]] la réponse, Amélie l'arrête d'une main.",
    audioSentence: "Avant la réponse, Amélie l'arrête d'une main.",
    targetWord: "Avant",
  },
  {
    slug: "avant-le-retour",
    orderIndex: 14,
    sentence: "Marc lit la règle sur le billet: Avant, pas [[pendant]].",
    audioSentence: "Marc lit la règle sur le billet: Avant, pas pendant.",
    targetWord: "pendant",
  },
  {
    slug: "avant-le-retour",
    orderIndex: 15,
    sentence: "Marc lit la _____ sur le billet: Avant, pas pendant.",
    audioSentence: "Marc lit la règle sur le billet: Avant, pas pendant.",
    targetWord: "règle",
  },
  {
    slug: "avant-le-retour",
    orderIndex: 16,
    sentence: "Marc arrive _____ Olivier et une nouvelle heure.",
    audioSentence: "Marc arrive avec Olivier et une nouvelle heure.",
    targetWord: "avec",
  },
  {
    slug: "avant-le-retour",
    orderIndex: 17,
    sentence: "Le billet d'Olivier est sur la table du café, _____ son retour.",
    audioSentence: "Le billet d'Olivier est sur la table du café, pour son retour.",
    targetWord: "pour",
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function supportedKey(key: string, text: string, vocab: Array<{ word?: string; surface?: string }>): boolean {
  const k = norm(key);
  if (!k) return true;
  const textNorm = norm(text);
  if (textNorm.includes(k)) return true;
  return vocab.some((v) => norm(v.word ?? "") === k || norm(v.surface ?? "") === k);
}

function patchPayload(payload: unknown, audioSentence: string, targetWord: string): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const next = { ...(payload as Record<string, unknown>) };
  const audioClip = next.audioClip;
  if (audioClip && typeof audioClip === "object" && !Array.isArray(audioClip)) {
    next.audioClip = {
      ...(audioClip as Record<string, unknown>),
      sentence: audioSentence,
      targetWord,
    };
  }
  return next;
}

(async () => {
  const prisma = new PrismaClient();
  let updatedExercises = 0;
  let removedGlossKeys = 0;

  for (const patch of practicePatches) {
    const story = await prisma.journeyStory.findFirst({
      where: { journeyId: JOURNEY, slug: patch.slug },
      select: {
        practiceSet: {
          select: {
            exercises: {
              where: { orderIndex: patch.orderIndex },
              select: { id: true, payload: true },
            },
          },
        },
      },
    });
    const exercise = story?.practiceSet?.exercises[0];
    if (!exercise) throw new Error(`Missing exercise ${patch.slug} #${patch.orderIndex}`);
    await prisma.storyPracticeExercise.update({
      where: { id: exercise.id },
      data: {
        sentence: patch.sentence,
        payload: patchPayload(exercise.payload, patch.audioSentence, patch.targetWord) as object,
      },
    });
    updatedExercises += 1;
  }

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, text: true, vocab: true },
  });
  const storyBySlug = new Map(stories.map((s) => [s.slug, s]));
  const rows = await prisma.tapGlossSet.findMany({
    where: { bundle: BUNDLE },
    select: { id: true, slug: true, glosses: true },
  });

  for (const row of rows) {
    const story = storyBySlug.get(row.slug);
    if (!story) continue;
    const glosses = (row.glosses ?? {}) as Record<string, unknown>;
    const vocab = Array.isArray(story.vocab) ? (story.vocab as Array<{ word?: string; surface?: string }>) : [];
    const next: Record<string, unknown> = {};
    let changed = false;
    for (const [key, value] of Object.entries(glosses)) {
      if (supportedKey(key, story.text ?? "", vocab)) {
        next[key] = value;
      } else {
        changed = true;
        removedGlossKeys += 1;
      }
    }
    if (changed) {
      await prisma.tapGlossSet.update({ where: { id: row.id }, data: { glosses: next } });
    }
  }

  console.log(`updatedExercises=${updatedExercises}`);
  console.log(`removedGlossKeys=${removedGlossKeys}`);
  await prisma.$disconnect();
})();
