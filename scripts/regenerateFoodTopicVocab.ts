/**
 * One-off: regenerate vocab + practice sets + audio for the 6 stories
 * in the "food-everyday-life" topic of the Italian journey, applying
 * the new vocab selection rules (priority 1-3, no loanwords, no dup
 * lemmas, POS balance in P3, productive-vs-receptive split). Vocab
 * was hand-curated by Claude per story because OpenAI quota is
 * exhausted; rebuild reuses the production pipeline via
 * buildAndPersistStoryPracticeSet so audio gets pre-rendered through
 * Piper on Modal.
 *
 * P3 distribution target (12 items): ~5 nouns / ~4 verbs / ~2 adj /
 * ~1 expression. P3 items must be PRODUCTIVE A1 (the learner should
 * be able to say/write/recall them, not just recognize). Specialized
 * scene-specific nouns go to P2 (receptive).
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
    // P3 productive A1: 5n / 4v / 2adj / 1expr
    { word: "pranzo", definition: "A midday meal; lunch", type: "noun", priority: 3 },
    { word: "nonna", definition: "A grandmother", type: "noun", priority: 3 },
    { word: "marito", definition: "A husband", type: "noun", priority: 3 },
    { word: "bicchiere", definition: "A drinking glass", type: "noun", priority: 3 },
    { word: "bambino", surface: "bambini", definition: "A child", type: "noun", priority: 3 },
    { word: "pensare", surface: "pensava", definition: "To think", type: "verb", priority: 3 },
    { word: "tagliare", surface: "tagliava", definition: "To cut", type: "verb", priority: 3 },
    { word: "aiutare", surface: "aiuti", definition: "To help", type: "verb", priority: 3 },
    { word: "ridere", surface: "rise", definition: "To laugh", type: "verb", priority: 3 },
    { word: "caldo", surface: "calda", definition: "Warm; hot", type: "adjective", priority: 3 },
    { word: "pieno", surface: "piena", definition: "Full", type: "adjective", priority: 3 },
    { word: "sentirsi a casa", surface: "Si sentiva a casa", definition: "To feel at home", type: "expression", priority: 3 },
    // P2 receptive / scene-specific
    { word: "campanello", definition: "A doorbell", type: "noun", priority: 2 },
    { word: "brindisi", definition: "A toast (drinking)", type: "noun", priority: 2 },
    { word: "chiacchiera", surface: "chiacchiere", definition: "A chat; chatter", type: "noun", priority: 2 },
    { word: "cetriolo", surface: "cetrioli", definition: "A cucumber", type: "noun", priority: 2 },
    { word: "annusare", surface: "annusò", definition: "To sniff", type: "verb", priority: 2 },
    { word: "accogliere", surface: "accolse", definition: "To welcome", type: "verb", priority: 2 },
    { word: "urlare", surface: "urlarono", definition: "To yell; to shout", type: "verb", priority: 2 },
    { word: "orgoglioso", surface: "orgogliosa", definition: "Proud", type: "adjective", priority: 2 },
  ],

  // === Cacio e Pepe a Trastevere ===
  cmolrnlda000532s9ke3pqnyu: [
    // P3 productive A1: 5n / 4v / 2adj / 1expr
    { word: "formaggio", definition: "Cheese", type: "noun", priority: 3 },
    { word: "piatto", definition: "A dish; a plate", type: "noun", priority: 3 },
    { word: "forchetta", definition: "A fork", type: "noun", priority: 3 },
    { word: "uomo", definition: "A man", type: "noun", priority: 3 },
    { word: "stradina", surface: "stradine", definition: "A small narrow street", type: "noun", priority: 3 },
    { word: "camminare", surface: "cammina", definition: "To walk", type: "verb", priority: 3 },
    { word: "ascoltare", surface: "ascolta", definition: "To listen", type: "verb", priority: 3 },
    { word: "chiedere", surface: "chiede", definition: "To ask", type: "verb", priority: 3 },
    { word: "prendere", surface: "prende", definition: "To take", type: "verb", priority: 3 },
    { word: "piccolo", surface: "piccola", definition: "Small; little", type: "adjective", priority: 3 },
    { word: "anziano", definition: "Elderly; old", type: "adjective", priority: 3 },
    { word: "ho bisogno di", definition: "I need", type: "expression", priority: 3 },
    // P2 receptive / scene-specific
    { word: "cameriere", definition: "A waiter", type: "noun", priority: 2 },
    { word: "suono", definition: "A sound", type: "noun", priority: 2 },
    { word: "sorridere", surface: "sorride", definition: "To smile", type: "verb", priority: 2 },
    { word: "raccontare", surface: "racconta", definition: "To tell; to narrate", type: "verb", priority: 2 },
    { word: "parlare", surface: "Parla", definition: "To speak", type: "verb", priority: 2 },
    { word: "sperare", surface: "spero", definition: "To hope", type: "verb", priority: 2 },
    { word: "stretto", surface: "strette", definition: "Narrow", type: "adjective", priority: 2 },
    { word: "acciottolato", surface: "acciottolate", definition: "Cobbled", type: "adjective", priority: 2 },
  ],

  // === Quartieri Spagnoli, pizza margherita ===
  cmolsbuwa000d32s9a5mvwfrc: [
    // P3 productive A1: 5n / 4v / 2adj / 1expr
    { word: "forno", definition: "An oven", type: "noun", priority: 3 },
    { word: "donna", definition: "A woman", type: "noun", priority: 3 },
    { word: "farina", definition: "Flour", type: "noun", priority: 3 },
    { word: "fila", definition: "A line; a queue", type: "noun", priority: 3 },
    { word: "rumore", definition: "Noise", type: "noun", priority: 3 },
    { word: "aprire", surface: "apre", definition: "To open", type: "verb", priority: 3 },
    { word: "mettere", surface: "mette", definition: "To put; to place", type: "verb", priority: 3 },
    { word: "aspettare", surface: "aspetta", definition: "To wait", type: "verb", priority: 3 },
    { word: "sentire", surface: "sente", definition: "To feel; to hear", type: "verb", priority: 3 },
    { word: "leggero", surface: "leggera", definition: "Light; not heavy", type: "adjective", priority: 3 },
    { word: "freddo", definition: "Cold", type: "adjective", priority: 3 },
    { word: "all'improvviso", definition: "Suddenly", type: "expression", priority: 3 },
    // P2 receptive / scene-specific
    { word: "impasto", definition: "Dough", type: "noun", priority: 2 },
    { word: "maglietta", definition: "A T-shirt", type: "noun", priority: 2 },
    { word: "lavorare", definition: "To work", type: "verb", priority: 2 },
    { word: "stendere", surface: "stende", definition: "To roll out; to spread", type: "verb", priority: 2 },
    { word: "muoversi", surface: "muovermi", definition: "To move oneself", type: "verb", priority: 2 },
    { word: "tirare fuori", surface: "tira fuori", definition: "To pull out", type: "expression", priority: 2 },
    { word: "strano", definition: "Strange; odd", type: "adjective", priority: 2 },
    { word: "sollevato", definition: "Relieved", type: "adjective", priority: 2 },
  ],

  // === Pizza Napoletana a Spaccanapoli ===
  cmomvbdkr000132cns4x546zd: [
    // P3 productive A1: 5n / 5v / 1adj / 1expr (story is adj-light, push verbs)
    { word: "sole", definition: "The sun", type: "noun", priority: 3 },
    { word: "cielo", definition: "The sky", type: "noun", priority: 3 },
    { word: "lavoro", definition: "Work; job", type: "noun", priority: 3 },
    { word: "tempo", definition: "Time; weather", type: "noun", priority: 3 },
    { word: "cibo", definition: "Food", type: "noun", priority: 3 },
    { word: "fare", surface: "fa", definition: "To do; to make", type: "verb", priority: 3 },
    { word: "volere", surface: "vogliamo", definition: "To want", type: "verb", priority: 3 },
    { word: "dare", surface: "dà", definition: "To give", type: "verb", priority: 3 },
    { word: "provare", definition: "To try; to taste", type: "verb", priority: 3 },
    { word: "spiegare", definition: "To explain", type: "verb", priority: 3 },
    { word: "piccolo", surface: "piccola", definition: "Small; little", type: "adjective", priority: 3 },
    { word: "ogni giorno", definition: "Every day", type: "expression", priority: 3 },
    // P2 receptive / scene-specific
    { word: "padrona", definition: "A female owner", type: "noun", priority: 2 },
    { word: "fame", definition: "Hunger", type: "noun", priority: 2 },
    { word: "morso", definition: "A bite", type: "noun", priority: 2 },
    { word: "segno", definition: "A sign", type: "noun", priority: 2 },
    { word: "sorriso", definition: "A smile", type: "noun", priority: 2 },
    { word: "cuocere", surface: "cuoce", definition: "To cook", type: "verb", priority: 2 },
    { word: "riempire", surface: "riempie", definition: "To fill up", type: "verb", priority: 2 },
    { word: "croccante", definition: "Crunchy; crispy", type: "adjective", priority: 2 },
  ],

  // === Oltrarno, bistecca fiorentina ===
  cmomyotyr0001328dkfucstiz: [
    // P3 productive A1: 5n / 4v / 2adj / 1expr
    { word: "carne", definition: "Meat", type: "noun", priority: 3 },
    { word: "tavolo", definition: "A table", type: "noun", priority: 3 },
    { word: "bocca", definition: "A mouth", type: "noun", priority: 3 },
    { word: "vino", surface: "vin santo", definition: "Wine", type: "noun", priority: 3 },
    { word: "cena", definition: "Dinner; supper", type: "noun", priority: 3 },
    { word: "mangiare", definition: "To eat", type: "verb", priority: 3 },
    { word: "portare", surface: "porta", definition: "To bring; to carry", type: "verb", priority: 3 },
    { word: "sembrare", surface: "sembrano", definition: "To seem", type: "verb", priority: 3 },
    { word: "conoscere", surface: "conosciamo", definition: "To know (a person)", type: "verb", priority: 3 },
    { word: "giovane", definition: "Young", type: "adjective", priority: 3 },
    { word: "bello", surface: "bellissimo", definition: "Beautiful; nice", type: "adjective", priority: 3 },
    { word: "spesso", definition: "Often", type: "adverb", priority: 3 },
    // P2 receptive / scene-specific
    { word: "acquolina in bocca", definition: "Mouth-watering feeling", type: "expression", priority: 2 },
    { word: "all'aperto", definition: "Outdoors; in the open", type: "expression", priority: 2 },
    { word: "non vedere l'ora", definition: "To look forward to", type: "expression", priority: 2 },
    { word: "estate", definition: "Summer (false friend)", type: "noun", priority: 2 },
    { word: "cuore", definition: "A heart", type: "noun", priority: 2 },
    { word: "diventare", surface: "diventa", definition: "To become", type: "verb", priority: 2 },
    { word: "raccontare", surface: "racconta", definition: "To tell; to narrate", type: "verb", priority: 2 },
    { word: "consigliare", surface: "consiglieresti", definition: "To advise; recommend", type: "verb", priority: 2 },
  ],

  // === Pesto a Boccadasse ===
  cmp71z04w000132j0dtgter54: [
    // P3 productive A1: 5n / 4v / 2adj / 1expr
    { word: "mattina", definition: "A morning", type: "noun", priority: 3 },
    { word: "mare", definition: "The sea", type: "noun", priority: 3 },
    { word: "acqua", definition: "Water", type: "noun", priority: 3 },
    { word: "casa", surface: "case", definition: "A house; home", type: "noun", priority: 3 },
    { word: "treno", definition: "A train", type: "noun", priority: 3 },
    { word: "bere", surface: "beve", definition: "To drink", type: "verb", priority: 3 },
    { word: "pagare", surface: "paga", definition: "To pay", type: "verb", priority: 3 },
    { word: "uscire", surface: "esce", definition: "To go out; exit", type: "verb", priority: 3 },
    { word: "finire", surface: "finisce", definition: "To finish", type: "verb", priority: 3 },
    { word: "vicino", definition: "Near; close", type: "adjective", priority: 3 },
    { word: "lontano", definition: "Far; distant", type: "adjective", priority: 3 },
    { word: "tutto bene", definition: "Everything OK?", type: "expression", priority: 3 },
    // P2 receptive / scene-specific
    { word: "barca", surface: "barche", definition: "A boat", type: "noun", priority: 2 },
    { word: "legno", definition: "Wood", type: "noun", priority: 2 },
    { word: "grembiule", definition: "An apron", type: "noun", priority: 2 },
    { word: "pescatore", definition: "A fisherman", type: "noun", priority: 2 },
    { word: "rete", definition: "A net", type: "noun", priority: 2 },
    { word: "cesto", definition: "A basket", type: "noun", priority: 2 },
    { word: "orologio", definition: "A watch; a clock", type: "noun", priority: 2 },
    { word: "lento", definition: "Slow", type: "adjective", priority: 2 },
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
    const byType = (t: string, p: number) =>
      items.filter((i) => i.type === t && i.priority === p).length;
    const p3n = byType("noun", 3);
    const p3v = byType("verb", 3);
    const p3a = byType("adjective", 3) + byType("adverb", 3);
    const p3e = byType("expression", 3);
    console.log(
      `  ${story.level} | ${story.slug.padEnd(45)} | P3: ${p3n}n+${p3v}v+${p3a}adj+${p3e}expr | total ${items.length}`,
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
