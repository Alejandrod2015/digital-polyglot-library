import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const TOK = /\p{L}+(?:-\p{L}+)*/u;
const JOURNEY = "cmroo4w4v0000324ow1o9qlcp";
const TOPICS = ["berlin", "hamburg", "koeln", "muenchen", "dortmund", "leipzig", "stuttgart"];
const OK = new Set(["verb", "noun", "adjective", "adverb", "pronoun", "preposition", "conjunction", "article", "number", "expression", "other"]);

(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: JOURNEY, NOT: { title: null } }, select: { slug: true, text: true, topic: true, slotIndex: true } });
  rows.sort((a: any, b: any) => TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  const slugs = rows.map((r: any) => r.slug);

  const merged: Record<string, any> = {};
  for (let i = 1; i <= 13; i++) {
    const part = JSON.parse(fs.readFileSync(`scripts/_friendsDE_gloss_chunk_${i}.json`, "utf8"));
    for (const [k, v] of Object.entries(part)) merged[k.toLowerCase().normalize("NFC")] = v;
  }

  const toks = new Set<string>();
  for (const r of rows) if (r.text) for (const chunk of (r.text as string).split(/\s+/)) { const m = chunk.toLowerCase().match(TOK); if (m) toks.add(m[0].normalize("NFC")); }

  const glosses: Record<string, any> = {};
  const uncovered: string[] = [], badType: string[] = [], emdash: string[] = [];
  for (const t of toks) {
    const g = merged[t];
    if (!g || !g.g || !g.t) { uncovered.push(t); continue; }
    if (!OK.has(g.t)) badType.push(`${t}=${g.t}`);
    if (String(g.g).includes("—")) emdash.push(t);
    glosses[t] = { g: String(g.g), t: String(g.t) };
  }
  console.log(`slugs: ${slugs.length} | tokens: ${toks.size} | glosses: ${Object.keys(glosses).length}`);
  console.log(`UNCOVERED: ${uncovered.length}`, uncovered.slice(0, 60));
  console.log(`BAD TYPE: ${badType.length}`, badType.slice(0, 30));
  console.log(`EM-DASH: ${emdash.length}`, emdash.slice(0, 20));
  if (uncovered.length === 0 && badType.length === 0 && emdash.length === 0) {
    fs.writeFileSync("src/data/tapGlosses/german-friends.json", JSON.stringify({ slugs, glosses }, null, 1));
    console.log("WROTE src/data/tapGlosses/german-friends.json");
  } else {
    console.log("NOT written: fix uncovered/badType/em-dash first");
  }
})().finally(() => p.$disconnect());
