/**
 * One-off: regenerate vocab + practice sets + audio for the 6 stories
 * in the "food-everyday-life" topic of the Italian journey, applying
 * the new vocab selection rules (priority 1-3, no loanwords, no dup
 * lemmas). Vocab was hand-curated by Claude per story because OpenAI
 * quota is exhausted; rebuild reuses the production pipeline via
 * buildAndPersistStoryPracticeSet so audio gets pre-rendered through
 * Piper on Modal.
 *
 *   tsx scripts/regenerateFoodTopicVocab.ts            # dry-run summary
 *   tsx scripts/regenerateFoodTopicVocab.ts --apply    # write + rebuild
 */
import { prisma } from "../src/lib/prisma";
import { buildAndPersistStoryPracticeSet } from "../src/lib/storyPracticeSets";

type VocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type: "noun" | "verb" | "adjective" | "adverb" | "expression";
  priority: 1 | 2 | 3;
};

const NEW_VOCAB: Record<string, VocabItem[]> = {
  // === Il pranzo di famiglia ===
  cmo2xsvt60001l104uamsr933: [
    { word: "pranzo", definition: "A midday meal; lunch", type: "noun", priority: 3 },
    { word: "tagliare", definition: "To cut", type: "verb", priority: 3 },
    { word: "nonna", definition: "A grandmother", type: "noun", priority: 3 },
    { word: "piatto", definition: "A dish; a plate", type: "noun", priority: 3 },
    { word: "campanello", definition: "A doorbell", type: "noun", priority: 3 },
    { word: "marito", definition: "A husband", type: "noun", priority: 3 },
    { word: "annusare", definition: "To sniff; to smell", type: "verb", priority: 3 },
    { word: "bicchiere", definition: "A drinking glass", type: "noun", priority: 3 },
    { word: "brindisi", definition: "A toast (drinking)", type: "noun", priority: 3 },
    { word: "bambino", definition: "A child", type: "noun", priority: 3 },
    { word: "occhio", definition: "An eye", type: "noun", priority: 3 },
    { word: "orgoglioso", surface: "orgogliosa", definition: "Proud", type: "adjective", priority: 3 },
    { word: "cetriolo", surface: "cetrioli", definition: "A cucumber", type: "noun", priority: 2 },
    { word: "raccontare", surface: "raccontava", definition: "To tell; to narrate", type: "verb", priority: 2 },
    { word: "accogliere", surface: "accolse", definition: "To welcome", type: "verb", priority: 2 },
    { word: "chiacchiera", surface: "chiacchiere", definition: "A chat; chatter", type: "noun", priority: 2 },
    { word: "annuire", surface: "annuì", definition: "To nod", type: "verb", priority: 2 },
    { word: "urlare", surface: "urlarono", definition: "To yell; to shout", type: "verb", priority: 2 },
    { word: "affamato", surface: "affamati", definition: "Hungry; starving", type: "adjective", priority: 2 },
    { word: "avvolgere", surface: "avvolgeva", definition: "To wrap; to envelop", type: "verb", priority: 2 },
  ],

  // === Cacio e Pepe a Trastevere ===
  cmolrnlda000532s9ke3pqnyu: [
    { word: "formaggio", definition: "Cheese", type: "noun", priority: 3 },
    { word: "forchetta", definition: "A fork", type: "noun", priority: 3 },
    { word: "stradina", surface: "stradine", definition: "A small narrow street", type: "noun", priority: 3 },
    { word: "acciottolato", surface: "acciottolate", definition: "Cobbled; cobblestoned", type: "adjective", priority: 3 },
    { word: "suono", definition: "A sound", type: "noun", priority: 3 },
    { word: "assaggiare", surface: "assaggia", definition: "To taste", type: "verb", priority: 3 },
    { word: "anziano", definition: "Elderly; old", type: "adjective", priority: 3 },
    { word: "stretto", surface: "strette", definition: "Narrow", type: "adjective", priority: 3 },
    { word: "camminare", surface: "cammina", definition: "To walk", type: "verb", priority: 3 },
    { word: "ascoltare", surface: "ascolta", definition: "To listen", type: "verb", priority: 3 },
    { word: "sorridere", surface: "sorride", definition: "To smile", type: "verb", priority: 3 },
    { word: "raccontare", surface: "racconta", definition: "To tell; to narrate", type: "verb", priority: 3 },
    { word: "cameriere", definition: "A waiter", type: "noun", priority: 2 },
    { word: "accogliente", definition: "Cozy; welcoming", type: "adjective", priority: 2 },
    { word: "nascere", surface: "nasce", definition: "To arise; to be born", type: "verb", priority: 2 },
    { word: "sperare", surface: "spero", definition: "To hope", type: "verb", priority: 2 },
    { word: "pensare", surface: "pensa", definition: "To think", type: "verb", priority: 2 },
    { word: "sedersi", surface: "si siede", definition: "To sit down", type: "verb", priority: 2 },
    { word: "scrivere", definition: "To write", type: "verb", priority: 2 },
    { word: "pieno", surface: "piena", definition: "Full", type: "adjective", priority: 2 },
  ],

  // === Quartieri Spagnoli, pizza margherita ===
  cmolsbuwa000d32s9a5mvwfrc: [
    { word: "forno", definition: "An oven", type: "noun", priority: 3 },
    { word: "farina", definition: "Flour", type: "noun", priority: 3 },
    { word: "leggero", surface: "leggera", definition: "Light; not heavy", type: "adjective", priority: 3 },
    { word: "impasto", definition: "Dough", type: "noun", priority: 3 },
    { word: "stendere", surface: "stende", definition: "To roll out; to spread", type: "verb", priority: 3 },
    { word: "muoversi", surface: "muovermi", definition: "To move; get moving", type: "verb", priority: 3 },
    { word: "fila", definition: "A line; a queue", type: "noun", priority: 3 },
    { word: "crescere", surface: "cresce", definition: "To grow", type: "verb", priority: 3 },
    { word: "rumore", definition: "Noise", type: "noun", priority: 3 },
    { word: "freddo", definition: "Cold", type: "adjective", priority: 3 },
    { word: "sollevato", definition: "Relieved", type: "adjective", priority: 3 },
    { word: "scaldare", surface: "scaldarsi", definition: "To heat up", type: "verb", priority: 3 },
    { word: "chiedere", surface: "chiede", definition: "To ask", type: "verb", priority: 2 },
    { word: "succedere", surface: "succede", definition: "To happen", type: "verb", priority: 2 },
    { word: "aspettare", surface: "aspetta", definition: "To wait", type: "verb", priority: 2 },
    { word: "tirare fuori", surface: "tira fuori", definition: "To pull out", type: "expression", priority: 2 },
    { word: "aggiustare", surface: "aggiusta", definition: "To fix; adjust", type: "verb", priority: 2 },
    { word: "maglietta", definition: "A T-shirt", type: "noun", priority: 2 },
    { word: "strano", definition: "Strange; odd", type: "adjective", priority: 2 },
    { word: "caldo", definition: "Hot; warm", type: "adjective", priority: 2 },
  ],

  // === Pizza Napoletana a Spaccanapoli ===
  cmomvbdkr000132cns4x546zd: [
    { word: "forno", definition: "An oven", type: "noun", priority: 3 },
    { word: "croccante", definition: "Crunchy; crispy", type: "adjective", priority: 3 },
    { word: "sottile", definition: "Thin", type: "adjective", priority: 3 },
    { word: "padrona", definition: "A female owner", type: "noun", priority: 3 },
    { word: "morso", definition: "A bite", type: "noun", priority: 3 },
    { word: "fame", definition: "Hunger", type: "noun", priority: 3 },
    { word: "cura", definition: "Care; attention", type: "noun", priority: 3 },
    { word: "caldo", definition: "Hot; warm", type: "adjective", priority: 3 },
    { word: "cuocere", surface: "cuoce", definition: "To cook", type: "verb", priority: 3 },
    { word: "riempire", surface: "riempie", definition: "To fill up", type: "verb", priority: 3 },
    { word: "assaggiare", surface: "assaggiarla", definition: "To taste", type: "verb", priority: 3 },
    { word: "gioia", definition: "Joy", type: "noun", priority: 3 },
    { word: "spiegare", definition: "To explain", type: "verb", priority: 2 },
    { word: "ridere", surface: "ridono", definition: "To laugh", type: "verb", priority: 2 },
    { word: "sorriso", definition: "A smile", type: "noun", priority: 2 },
    { word: "cuore", definition: "A heart", type: "noun", priority: 2 },
    { word: "pomeriggio", definition: "An afternoon", type: "noun", priority: 2 },
    { word: "giornata", definition: "A full day", type: "noun", priority: 2 },
    { word: "dolce", definition: "A sweet; a dessert", type: "noun", priority: 2 },
    { word: "cibo", definition: "Food", type: "noun", priority: 2 },
  ],

  // === Oltrarno, bistecca fiorentina ===
  cmomyotyr0001328dkfucstiz: [
    { word: "carne", definition: "Meat", type: "noun", priority: 3 },
    { word: "cuore", definition: "A heart", type: "noun", priority: 3 },
    { word: "estate", definition: "Summer (false friend)", type: "noun", priority: 3 },
    { word: "acquolina in bocca", definition: "Mouth-watering feeling", type: "expression", priority: 3 },
    { word: "non vedere l'ora", definition: "To look forward to", type: "expression", priority: 3 },
    { word: "all'aperto", definition: "Outdoors; in the open", type: "expression", priority: 3 },
    { word: "spiegare", surface: "spiega", definition: "To explain", type: "verb", priority: 3 },
    { word: "sembrare", surface: "sembrano", definition: "To seem", type: "verb", priority: 3 },
    { word: "diventare", surface: "diventa", definition: "To become", type: "verb", priority: 3 },
    { word: "giovane", definition: "Young", type: "adjective", priority: 3 },
    { word: "spesso", definition: "Often", type: "adverb", priority: 3 },
    { word: "sorridere", surface: "sorride", definition: "To smile", type: "verb", priority: 3 },
    { word: "tavolo", definition: "A table", type: "noun", priority: 2 },
    { word: "bocca", definition: "A mouth", type: "noun", priority: 2 },
    { word: "sera", definition: "An evening", type: "noun", priority: 2 },
    { word: "consigliare", surface: "consiglieresti", definition: "To advise; recommend", type: "verb", priority: 2 },
    { word: "portare", surface: "porta", definition: "To bring; to carry", type: "verb", priority: 2 },
    { word: "aspettare", surface: "aspetta", definition: "To wait", type: "verb", priority: 2 },
    { word: "ridere", surface: "ridono", definition: "To laugh", type: "verb", priority: 2 },
    { word: "raccontare", surface: "racconta", definition: "To tell; to narrate", type: "verb", priority: 2 },
  ],

  // === Pesto a Boccadasse ===
  cmp71z04w000132j0dtgter54: [
    { word: "mare", definition: "Sea", type: "noun", priority: 3 },
    { word: "barca", surface: "barche", definition: "A boat", type: "noun", priority: 3 },
    { word: "legno", definition: "Wood", type: "noun", priority: 3 },
    { word: "libero", definition: "Free; available", type: "adjective", priority: 3 },
    { word: "grembiule", definition: "An apron", type: "noun", priority: 3 },
    { word: "pescatore", definition: "A fisherman", type: "noun", priority: 3 },
    { word: "rete", definition: "A net", type: "noun", priority: 3 },
    { word: "cesto", definition: "A basket", type: "noun", priority: 3 },
    { word: "pesce", definition: "Fish", type: "noun", priority: 3 },
    { word: "sabbia", definition: "Sand", type: "noun", priority: 3 },
    { word: "scarpa", surface: "scarpe", definition: "A shoe", type: "noun", priority: 3 },
    { word: "orologio", definition: "A watch; a clock", type: "noun", priority: 3 },
    { word: "correre", surface: "corre", definition: "To run", type: "verb", priority: 2 },
    { word: "cane", definition: "A dog", type: "noun", priority: 2 },
    { word: "lento", definition: "Slow", type: "adjective", priority: 2 },
    { word: "lontano", definition: "Far away", type: "adjective", priority: 2 },
    { word: "veloce", definition: "Fast; quick", type: "adjective", priority: 2 },
    { word: "aglio", definition: "Garlic", type: "noun", priority: 2 },
    { word: "piede", surface: "piedi", definition: "A foot", type: "noun", priority: 2 },
    { word: "restare", definition: "To stay; remain", type: "verb", priority: 2 },
  ],
};

async function main() {
  const apply = process.argv.includes("--apply");

  const ids = Object.keys(NEW_VOCAB);
  console.log(`\nTarget stories: ${ids.length}`);
  for (const id of ids) {
    const story = await prisma.journeyStory.findUnique({
      where: { id },
      select: { slug: true, title: true, level: true },
    });
    if (!story) {
      console.error(`  ✗ ${id} NOT FOUND`);
      continue;
    }
    const items = NEW_VOCAB[id];
    const p3 = items.filter((i) => i.priority === 3).length;
    const p2 = items.filter((i) => i.priority === 2).length;
    console.log(
      `  ${story.level} | ${story.slug.padEnd(45)} | ${items.length} items (P3=${p3}, P2=${p2})`,
    );
  }

  if (!apply) {
    console.log("\n[dry-run] pass --apply to write to DB + rebuild practice sets");
    return;
  }

  console.log("\nWriting vocab + rebuilding practice sets...");
  for (const id of ids) {
    const items = NEW_VOCAB[id];
    const story = await prisma.journeyStory.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!story) continue;

    await prisma.journeyStory.update({
      where: { id },
      data: { vocab: items as never },
    });

    const result = await buildAndPersistStoryPracticeSet(id, true);
    console.log(`  ✓ ${story.slug} → vocab updated, practice ${result.status} (${"count" in result ? result.count : "-"} exercises)`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
