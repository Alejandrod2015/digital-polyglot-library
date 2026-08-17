import { config } from "dotenv"; config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { filterSpanishWordsAtOrBelow } from "../src/lib/cefr/spanishLevelJudge";
const JID = "cmovi4cvi000032q37a4823h3";
// very common function words / closed-class we never want to flag
const STOP = new Set("el la los las un una unos unas y o u pero que de del a al en con por para se su sus mi mis tu tus le les lo me te nos no sí ni como más muy ya también acá ahí allá aquí allí cuando donde quien qué cómo cuánto cuál es son está están estoy estás fue era eran ser estar hay he ha han has había hubo soy somos eres yo tú él ella ellos ellas usted ustedes nosotros este esta estos estas eso esa ese esas esos esto aquel aquella todo toda todos todas algo alguien nada nadie cada otro otra otros otras mismo misma tan tanto si sin sobre entre hasta desde hacia tras durante según ante bajo cabe contra so vos te lo ".split(/\s+/));
function tokenize(t: string): string[] {
  return (t.toLowerCase().match(/[a-záéíóúñü]+/g) ?? []).filter(w => w.length > 2 && !STOP.has(w));
}
async function run() {
  const p = new PrismaClient();
  const rows = await p.journeyStory.findMany({ where: { journeyId: JID, level: "a1" }, select: { text: true } });
  const counts = new Map<string, number>();
  for (const r of rows) for (const w of tokenize(r.text ?? "")) counts.set(w, (counts.get(w) ?? 0) + 1);
  const words = [...counts.keys()];
  const { aboveLevel } = await filterSpanishWordsAtOrBelow(words, "a1");
  const above = (aboveLevel as any[]).map(a => ({ word: String(a.word).toLowerCase(), lvl: a.judgedLevel ?? "?" }));
  above.sort((a, b) => (counts.get(b.word)! - counts.get(a.word)!) || a.word.localeCompare(b.word));
  console.log(`Total tokens únicos (content): ${words.length}`);
  console.log(`Fuera de A1 según juez (lista+caché, default C2): ${above.length}\n`);
  console.log(above.map(a => `${a.word} [${a.lvl}] (${counts.get(a.word)})`).join("\n"));
  await p.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
