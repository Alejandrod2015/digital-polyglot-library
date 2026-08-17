import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const BOUND = /(?<=[.!?…]["'”’»“)\]]*)\s+(?=[„«"'“¿¡A-ZÄÖÜÑÀÈÉÌÒÙ0-9])/u;
const split = (t: string) => t.split(BOUND).map((s) => s.trim()).filter(Boolean);

async function main() {
  const texts: string[] = [];
  const sets = await p.storyPracticeSet.findMany({ where: { story: { status: "published" } }, select: { exercises: { select: { sentence: true, payload: true } } } });
  for (const s of sets) for (const ex of s.exercises) {
    const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
    for (const c of [ex.sentence, ac?.sentence]) if (typeof c === "string" && c.trim()) texts.push(c.trim());
  }
  const favs = await p.favorite.findMany({ select: { exampleSentence: true } });
  for (const f of favs) if (f.exampleSentence?.trim()) texts.push(f.exampleSentence.trim());
  const seen = new Set<string>();
  const sents: string[] = [];
  for (const t of texts) for (const s of split(t)) if (!seen.has(s)) { seen.add(s); sents.push(s); }
  sents.sort((a, b) => b.length - a.length);
  console.log("TOP 10 ORACIONES individuales más largas:\n");
  sents.slice(0, 10).forEach((s, i) => console.log(`${i + 1}. [${s.length}] ${s}\n`));
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
