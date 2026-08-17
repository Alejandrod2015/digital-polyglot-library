import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Item = { slug: string; word: string; sentence: string; answer: string; options: string[]; tr: string[] };
const ITEMS: Item[] = [
  { slug: "duzen-auf-eigene-gefahr", word: "schwitzen", answer: "schwitzen",
    sentence: "Paul: Deshalb schwitzen wir alle vor der ersten Mail.",
    options: ["schwitzen", "sitzen", "blitzen", "spitzen"], tr: ["to sweat", "to sit", "to flash", "to sharpen"] },
  { slug: "gute-besserung-im-oktober", word: "der Nacken", answer: "Nacken",
    sentence: "Der Nacken meldet sich schon beim Aufwachen.",
    options: ["Nacken", "Backen", "Hacken", "packen"], tr: ["nape / neck", "cheeks", "heels", "to pack"] },
  { slug: "ein-antrag-auf-freizeit", word: "der Verein", answer: "Verein",
    sentence: "Timo: Dann brauchst du einen Verein.",
    options: ["Verein", "allein", "Schein", "Wein"], tr: ["club", "alone", "note / glow", "wine"] },
  { slug: "sonntags-schliesst-sogar-berlin", word: "die Schraube", answer: "Schraube",
    sentence: "Oder eine Schraube für das Regal?",
    options: ["Schraube", "Traube", "Haube", "Laube"], tr: ["screw", "grape", "hood", "arbor"] },
  { slug: "bewerbungsgespraech-mit-katze", word: "thronen", answer: "thront",
    sentence: "Auf dem Sofa thront eine graue Katze und mustert die Bewerber einzeln.",
    options: ["thront", "wohnt", "lohnt", "gewohnt"], tr: ["sits enthroned", "lives", "is worth it", "accustomed"] },
  { slug: "zustaendig-ist-ein-anderes-amt", word: "der Schalter", answer: "Schalter",
    sentence: "Eine Stunde Wartezeit, ein neuer Schalter, dasselbe Lächeln.",
    options: ["Schalter", "Falter", "Halter", "Alter"], tr: ["counter / switch", "moth", "holder", "age"] },
  { slug: "im-keller-wohnt-die-hausordnung", word: "der Haken", answer: "Haken",
    sentence: "Der Haken hängt im Keller; mehr verrate ich nicht.",
    options: ["Haken", "Laken", "Kraken", "backen"], tr: ["hook / catch", "bed sheet", "octopuses", "to bake"] },
  { slug: "mit-freundlichen-gruessen-das-treppenhaus", word: "das Pfand", answer: "Pfand",
    sentence: "Und Pfand zählt nicht; Pfand ist kein Müll, Pfand ist Währung.",
    options: ["Pfand", "Sand", "Rand", "Brand"], tr: ["deposit", "sand", "edge", "fire"] },
  { slug: "ein-brief-kuendigt-briefe-an", word: "die Mahnung", answer: "Mahnung",
    sentence: "Timo: Sagt jede, bis zur ersten Mahnung.",
    options: ["Mahnung", "Ahnung", "Warnung", "Wohnung"], tr: ["reminder / dunning", "clue / idea", "warning", "apartment"] },
  { slug: "zwei-meinungen-zu-einem-ruecken", word: "die Salbe", answer: "Salbe",
    sentence: "Nadia: Die Apothekerin schwört auf die Salbe, du schwörst auf Quark.",
    options: ["Salbe", "Schwalbe", "Narbe", "halbe"], tr: ["ointment", "swallow (bird)", "scar", "half"] },
  { slug: "der-spaeti-in-der-weserstrasse", word: "die Laube", answer: "Laube",
    sentence: "Der verkrümelt sich bei dem Wetter in seine Laube.",
    options: ["Laube", "Taube", "Haube", "Traube"], tr: ["arbor / shed", "pigeon", "hood", "grape"] },
  { slug: "feierabend-ist-ein-versprechen", word: "überleben", answer: "überlebe",
    sentence: "Das überlebe ich.",
    options: ["überlebe", "überlege", "übergebe", "erlebe"], tr: ["I survive", "I consider", "I hand over", "I experience"] },
  { slug: "wir-muessen-mal", word: "der Kern", answer: "Kern",
    sentence: "Small Talk ist die Schale, der Stammtisch ist der Kern.",
    options: ["Kern", "Stern", "gern", "fern"], tr: ["core", "star", "gladly", "far"] },
  { slug: "die-mit-der-thermoskanne", word: "die Schlange", answer: "Schlange",
    sentence: "Vor dem Bürgeramt steht die Schlange; ganz hinten wartet Mira, angekommen vor drei Tagen.",
    options: ["Schlange", "Stange", "Zange", "lange"], tr: ["queue / snake", "pole / bar", "pliers", "long"] },
  { slug: "zwei-stempel-bis-zur-existenz", word: "der Puffer", answer: "Puffer",
    sentence: "Nadia: Drei Nummern Puffer.",
    options: ["Puffer", "Koffer", "Kupfer", "Pfeffer"], tr: ["buffer", "suitcase", "copper", "pepper"] },
  { slug: "feedback-auf-deutsch", word: "der Beweis", answer: "Beweis",
    sentence: "Brandt: Sind der Beweis, dass ich den dritten ernst meine.",
    options: ["Beweis", "Preis", "Kreis", "leis"], tr: ["proof", "price", "circle", "quiet / soft"] },
  { slug: "ganz-berlin-wartet-auf-einen-mord", word: "der Gärtner", answer: "Gärtner",
    sentence: "Nadia: Ich nehme den Gärtner.",
    options: ["Gärtner", "Partner", "Wärter", "Härter"], tr: ["gardener", "partner", "attendant", "harder"] },
  { slug: "endgegner-auslaenderbehoerde", word: "der Flur", answer: "Flur",
    sentence: "Der Flur der Ausländerbehörde riecht nach Automatenkaffee und Weltgeschichte.",
    options: ["Flur", "Uhr", "Spur", "Kur"], tr: ["hallway", "clock", "trace", "spa cure"] },
  { slug: "blumen-giessen-ist-vertrauenssache", word: "füttern", answer: "fütterst",
    sentence: "Und fütterst den Kater?",
    options: ["fütterst", "kletterst", "zitterst", "flüsterst"], tr: ["you feed", "you climb", "you tremble", "you whisper"] },
  { slug: "umzug-ohne-aufzug", word: "die Schramme", answer: "Schramme",
    sentence: "Die Schramme an der Tür war schon vor mir da, die erbst du offiziell.",
    options: ["Schramme", "Flamme", "Amme", "Gramm"], tr: ["scratch", "flame", "wet nurse", "gram"] },
];

function selfCheck(it: Item): string | null {
  if (it.options.length !== 4) return "options!=4";
  if (it.tr.length !== 4) return "tr!=4";
  if (it.options[0] !== it.answer) return "options[0]!==answer";
  if (new Set(it.options).size !== 4) return "dup options";
  if (!it.sentence.includes(it.answer)) return `answer '${it.answer}' not in sentence`;
  return null;
}

async function run() {
  const j = await p.journey.findFirst({ where: { name: "Expat", language: "german" }, select: { id: true } });
  const stories = await p.journeyStory.findMany({
    where: { journeyId: j!.id, status: "published" },
    select: { id: true, slug: true, audioFragments: true, audioSegments: true },
  });
  const bySlug = new Map(stories.map((s) => [s.slug, s]));
  let ok = 0, skip = 0, fail = 0;
  for (const it of ITEMS) {
    const chk = selfCheck(it);
    if (chk) { console.log(`FAIL ${it.slug}: ${chk}`); fail++; continue; }
    const story = bySlug.get(it.slug);
    if (!story) { console.log(`FAIL ${it.slug}: story not found`); fail++; continue; }
    const frags = (story.audioFragments as any[]) || [];
    const segs = (story.audioSegments as any[]) || [];
    const voiceId = frags.find((f) => f?.voiceId)?.voiceId || null;
    const segMatch = segs.some((g) => (g.text || "").trim() === it.sentence.trim());
    if (!voiceId) { console.log(`FAIL ${it.slug}: no narrator voiceId`); fail++; continue; }
    if (!segMatch) { console.log(`FAIL ${it.slug}: sentence not an exact segment`); fail++; continue; }

    const set = await p.storyPracticeSet.findUnique({ where: { storyId: story.id }, select: { id: true } });
    if (!set) { console.log(`FAIL ${it.slug}: no practice set`); fail++; continue; }
    const existing = await p.storyPracticeExercise.findFirst({ where: { setId: set.id, type: "listen_choose" }, select: { id: true } });
    if (existing) { console.log(`skip ${it.slug}: already has listen_choose`); skip++; continue; }
    const maxOrder = await p.storyPracticeExercise.aggregate({ where: { setId: set.id }, _max: { orderIndex: true } });
    const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;

    const payload = {
      prompt: "Which word did you hear?",
      answer: it.answer,
      options: it.options,
      optionTranslations: it.tr,
      language: "german",
      audioClip: { storySlug: it.slug, storySource: "user", sentence: it.sentence, targetWord: it.answer, language: "german", voiceId },
    };

    if (!APPLY) { console.log(`DRY ${it.slug}: '${it.answer}' order=${orderIndex} voice=${voiceId}`); ok++; continue; }
    await p.storyPracticeExercise.create({
      data: {
        setId: set.id, orderIndex, type: "listen_choose", word: it.word, sentence: it.sentence,
        audioUrl: null, payload, featured: false, language: "german",
      },
      select: { id: true },
    });
    console.log(`OK ${it.slug}: inserted '${it.answer}' order=${orderIndex}`);
    ok++;
  }
  console.log(`\n${APPLY ? "APPLIED" : "DRY-RUN"} ok=${ok} skip=${skip} fail=${fail} of ${ITEMS.length}`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); }).finally(() => p.$disconnect());
