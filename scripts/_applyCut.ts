/**
 * Aplica un recorte a una historia: dado el texto nuevo (arg file), poda el
 * vocab a los ítems cuyo surface sigue en el cuerpo, verifica cobertura de
 * glosses, y actualiza text/vocab/wordCount/vocabCount. NO genera audio.
 * Si la historia ya tiene audio, lo limpia (el recorte lo desincroniza).
 * Usage: tsx scripts/_applyCut.ts <slug> <newTextFile>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const prisma = new PrismaClient();
const TOK = /\p{L}+(?:-\p{L}+)*/gu;
(async () => {
  const slug = process.argv[2];
  const text = fs.readFileSync(process.argv[3], "utf8").trim();
  const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { id: true, vocab: true, audioStatus: true } }) as any;
  const low = text.toLowerCase();
  const surf = (v: any) => (v.surface && v.surface !== "undefined" ? v.surface : v.word);
  const kept = (s.vocab as any[]).filter((v) => low.includes(surf(v).toLowerCase()));
  const dropped = (s.vocab as any[]).filter((v) => !low.includes(surf(v).toLowerCase()));
  // gloss coverage
  const bundle = JSON.parse(fs.readFileSync("src/data/tapGlosses/german-expat.json", "utf8"));
  const cov = new Set(Object.keys(bundle.glosses));
  const miss = [...new Set([...text.matchAll(TOK)].map((m) => m[0].toLowerCase()))].filter((t) => !cov.has(t));
  const wc = text.split(/\s+/).length;
  console.log(`${slug}: ${wc}w | vocab ${s.vocab.length}→${kept.length} (drop: ${dropped.map((v)=>v.word).join(", ")||"—"})`);
  if (miss.length) { console.log(`  ✗ GLOSS uncovered: ${miss.join(", ")}`); process.exit(1); }
  const data: any = { text, vocab: kept, wordCount: wc, vocabCount: kept.length };
  if (s.audioStatus === "ready") { data.audioUrl = null; data.audioStatus = "draft"; data.audioSegments = undefined; data.audioWordTimings = undefined; data.audioFragments = undefined; data.audioFilename = null; console.log("  (audio viejo limpiado)"); }
  await prisma.journeyStory.update({ where: { id: s.id }, data });
  console.log("  ✓ aplicado");
})().finally(() => prisma.$disconnect());
