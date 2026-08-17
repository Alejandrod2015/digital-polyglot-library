import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { filterSpanishWordsAtOrBelow } from "../src/lib/cefr/spanishLevelJudge";
const JID = "cmqp6hal8000032cb4ywfs0gc"; // ES LATAM A1
const STOP = new Set("el la los las un una unos unas y o u pero que de del a al en con por para se su sus mi mis tu tus le les lo me te nos no sí ni como más muy ya también acá ahí allá aquí allí cuando donde quien qué cómo cuánto cuál es son está están estoy estás fue era eran ser estar hay he ha han has había hubo soy somos eres yo tú él ella ellos ellas usted ustedes nosotros este esta estos estas eso esa ese esas esos esto aquel aquella todo toda todos todas algo alguien nada nadie cada otro otra otros otras mismo misma tan tanto si sin sobre entre hasta desde hacia tras durante según ante bajo cabe contra so vos te lo".split(/\s+/));
const tok = (t: string) => (t.toLowerCase().match(/[a-záéíóúñü]+/g) ?? []).filter(w => w.length > 2 && !STOP.has(w));
(async () => {
  const p = new PrismaClient();
  const rows = await p.journeyStory.findMany({ where: { journeyId: JID, level: "a1" }, select: { slug: true, text: true } });
  console.log(`Historias A1: ${rows.length}`);
  const counts = new Map<string, number>();
  for (const r of rows) for (const w of tok(r.text ?? "")) counts.set(w, (counts.get(w) ?? 0) + 1);
  const words = [...counts.keys()];
  const { aboveLevel } = await filterSpanishWordsAtOrBelow(words, "a1");
  const above = (aboveLevel as any[]).map(a => ({ word: String(a.word).toLowerCase(), lvl: a.judgedLevel ?? "?", n: counts.get(String(a.word).toLowerCase()) ?? 0 }));
  above.sort((a, b) => (b.n - a.n) || a.word.localeCompare(b.word));
  // bucket by level; A1 cap allows up to A2/B1 (i+2). Flag B2+ as real offenders.
  const hard = above.filter(a => /^(b2|c1|c2)$/i.test(a.lvl));
  console.log(`Tokens únicos (content): ${words.length}`);
  console.log(`Por encima de A1 (juez): ${above.length}  |  B2+ (offenders reales por i+2): ${hard.length}\n`);
  console.log("=== B2+ (revisar) ===");
  console.log(hard.map(a => `${a.word} [${a.lvl}] x${a.n}`).join("\n") || "(ninguno)");
  console.log("\n=== A2/B1 (permitido por i+2, informativo) ===");
  console.log(above.filter(a => /^(a2|b1)$/i.test(a.lvl)).map(a => `${a.word} [${a.lvl}] x${a.n}`).join(", "));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
