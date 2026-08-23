import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
async function main() {
  const b = JSON.parse(fs.readFileSync("src/data/tapGlosses/french-expat-lyon.json", "utf8"));
  const st = await p.journeyStory.findMany({ where: { slug: { in: b.slugs } }, select: { title: true, text: true, vocab: true } });
  const toks = new Set<string>();
  for (const s of st) for (const t of [s.title ?? "", s.text ?? ""])
    for (const m of t.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) toks.add(m[0].toLowerCase());
  const otros = JSON.parse(fs.readFileSync("src/data/tapGlosses/french-traveler.json", "utf8")).glosses;
  const desdeVocab: Record<string, { g: string; t: string }> = {};
  for (const s of st) for (const v of ((s.vocab as Array<{ word: string; surface?: string; type?: string; definition: string }>) ?? [])) {
    const k = (v.surface ?? v.word).toLowerCase();
    if (!otros[k] && toks.has(k)) desdeVocab[k] = { g: `${v.definition} (${v.word})`, t: v.type ?? "other" };
  }
  const faltan = [...toks].filter((t) => !otros[t] && !desdeVocab[t]).sort();
  fs.writeFileSync(process.argv[2], JSON.stringify({ desdeVocab, faltan }, null, 1));
  console.log(`tokens ${toks.size} · del hermano ${[...toks].filter((t) => otros[t]).length} · del vocab ${Object.keys(desdeVocab).length} · a mano ${faltan.length}`);
}
main().finally(() => p.$disconnect());
