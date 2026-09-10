// Solo lectura: por cada plaza de vocab del Traveler PT-BR A0 nuevo, en cuantos cuerpos del journey aparece su surface.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const rows = (await p.journeyStory.findMany({ where: { journeyId: "cmtvpqsfv000832hgemzk20cl", NOT: { text: null } }, select: { slug: true, text: true, vocab: true, topic: true, slotIndex: true } }))
    .filter((r) => r.text);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const port = new Set(["verb", "adjective", "adverb", "expression"]);
  const out: string[] = [];
  for (const r of rows) for (const v of (r.vocab as any[])) {
    const sf = String(v.surface ?? v.word);
    const re = new RegExp(`(?<!\\p{L})${esc(sf)}(?!\\p{L})`, "iu");
    const n = rows.filter((x) => re.test(String(x.text))).length;
    out.push(`${n}\t${port.has(String(v.type)) ? "P" : "-"}\t${v.type}\t${sf}\t(${v.word})\t${r.slug}`);
  }
  out.sort((a, b) => Number(a.split("\t")[0]) - Number(b.split("\t")[0]));
  const ps = out.filter((l) => l.split("\t")[1] === "P");
  console.log(`plazas ${out.length} · portables por tipo ${ps.length} · media portables ${(ps.reduce((s, l) => s + Number(l.split("\t")[0]), 0) / ps.length).toFixed(2)} · una vez ${ps.filter((l) => l.startsWith("1\t")).length}`);
  console.log(out.join("\n"));
}
main().finally(() => p.$disconnect());
