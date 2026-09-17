import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
import * as path from "path";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const JOURNEY = "cmtwz1iop000l32jybeo2jg4x";
const OUT = path.join(__dirname, "_frA1FriendsIntroFix.json");
const OUT_TOUCHED = path.join(__dirname, "_frA1FriendsIntroFixTouched.json");

const replacements: Array<[string, string]> = [
  [
    "Amélie, une libraire de Paris, arrive chez Marc avec un petit sac et un grand papier bleu. Marc, un ami d'Amélie, tient un thé chaud.",
    "Amélie, une libraire de Paris, arrive chez Marc avec un sac et un grand papier bleu. Marc, un ami d'Amélie, tient un thé chaud.",
  ],
  [
    "Amélie, une libraire de Paris, regarde le canapé du salon près de la porte.",
    "Amélie regarde le canapé du salon près de la porte.",
  ],
  [
    "Après la réunion, Amélie, une libraire de Paris, attend avec Marc.",
    "Après la réunion, Amélie attend avec Marc.",
  ],
  [
    "Olivier est un ami organisé du groupe. Amélie, une libraire de Paris, est une femme qui pose son papier blanc et cherche un jour.",
    "Olivier est un ami organisé du groupe. Amélie cherche un jour simple pour le groupe. “Je cherche un jour”, dit-elle. La femme pose son papier blanc sur le bureau calme.",
  ],
  [
    "Amélie, une libraire de Paris, garde son cahier ouvert.",
    "Amélie garde son cahier ouvert.",
  ],
  [
    "Son appel prêt, Amélie regarde la station par la vitre du métro avec Marc, un ami de Paris.",
    "Son appel prêt, Amélie regarde la station par la vitre du métro avec Marc.",
  ],
  [
    "Marc, un ami d'Amélie, reste en bas.",
    "Marc reste en bas.",
  ],
  [
    "Dans un café de Paris, Amélie est une libraire en manteau rouge. Marc est un ami avec une veste bleu marine. Baptiste est un patron de café.",
    "Dans un café de Paris, Amélie porte un manteau rouge. Marc porte une veste bleu marine. Baptiste est un patron de café.",
  ],
  [
    "Elle dit: “Je l'envoie maintenant.” Marc lit et sourit. “C'est toi.”",
    "Elle dit: “Je l'envoie maintenant.” Marc lit, ferme le téléphone et sourit. “C'est toi.”",
  ],
  [
    "Lundi, gâteau chez Marc, avec plaisir? C'est simple et vrai.",
    "Lundi, gâteau chez Marc, avec plaisir? C'est un petit mot, simple et vrai.",
  ],
];

const TOPIC_ORDER = [
  "group-notes-and-plans",
  "hosting-and-care",
  "plans-and-timing",
  "seats-and-tables",
  "invites-and-boundaries",
  "trust-and-doubts",
  "circles-and-introductions",
];

(async () => {
  const prisma = new PrismaClient();
  const rows = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    orderBy: [{ slotIndex: "asc" }],
    select: {
      topic: true,
      slotIndex: true,
      title: true,
      slug: true,
      synopsis: true,
      text: true,
      vocab: true,
      arcType: true,
    },
  });

  const orderedRows = [...rows].sort((a, b) => {
    const ai = TOPIC_ORDER.indexOf(a.topic);
    const bi = TOPIC_ORDER.indexOf(b.topic);
    return (ai - bi) || (a.slotIndex - b.slotIndex);
  });

  const changed = orderedRows.map((story) => {
    let text = story.text ?? "";
    for (const [from, to] of replacements) text = text.replace(from, to);
    return { ...story, text };
  });

  const touched = changed.filter((story, i) => story.text !== orderedRows[i].text).map((story) => story.slug);
  fs.writeFileSync(OUT, JSON.stringify(changed, null, 2) + "\n");
  fs.writeFileSync(OUT_TOUCHED, JSON.stringify(changed.filter((story, i) => story.text !== orderedRows[i].text), null, 2) + "\n");
  console.log(`wrote ${OUT}`);
  console.log(`wrote ${OUT_TOUCHED}`);
  console.log(`touched ${touched.length}: ${touched.join(", ")}`);
  await prisma.$disconnect();
})();
