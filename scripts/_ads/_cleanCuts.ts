/** Scratch: segmentos que SE PUEDEN cortar limpios (la voz empieza y acaba
 *  donde dice el segmento, con silencio a los lados) y llevan jerga.
 *  Uso: _cleanCuts.ts <variant> [maxHistorias] */
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const p = new PrismaClient();
const DIR = "/tmp/claude-501/dpl-ads/audio";
type Seg = { index: number; text: string; startSec: number; endSec: number; normalizedText: string };
type V = { word: string; type?: string };

function runs(file: string): Array<[number, number]> {
  const out = execFileSync("npx", ["tsx", "scripts/_ads/_speechRuns.ts", file, "0", "400"], { maxBuffer: 1 << 26 }).toString();
  return out.trim().split("\n").filter(Boolean).map((l) => {
    const m = l.match(/voz ([0-9.]+) -> ([0-9.]+)/)!;
    return [Number(m[1]), Number(m[2])] as [number, number];
  });
}

async function main() {
  const variant = process.argv[2], limit = Number(process.argv[3] ?? 25), jname = process.argv[4], jlevel = process.argv[5];
  const rows = await p.journeyStory.findMany({
    where: { audioUrl: { not: null }, journey: { language: "spanish", variant, status: { in: ["active", "draft"] }, ...(jname ? { name: jname } : {}), ...(jlevel ? { levels: { has: jlevel } } : {}) } },
    select: { title: true, audioUrl: true, audioSegments: true, vocab: true },
    take: limit,
  });
  mkdirSync(DIR, { recursive: true });
  for (const r of rows) {
    const segs = (r.audioSegments as unknown as Seg[]) ?? [];
    const vocab = (r.vocab as unknown as V[]) ?? [];
    const cands = segs.filter((s) => {
      const d = s.endSec - s.startSec;
      if (d < 1.5 || d > 3.8) return false;
      return vocab.some((v) => ["expression", "slang", "adjective", "noun", "verb"].includes((v.type ?? "").toLowerCase()) && (s.normalizedText ?? "").includes(v.word.toLowerCase()));
    });
    if (!cands.length) continue;
    const name = (r.audioUrl!.split("/").pop() ?? "a.mp3").replace(/[^\w.-]/g, "_");
    const file = `${DIR}/${name}`;
    if (!existsSync(file)) { const res = await fetch(r.audioUrl!); writeFileSync(file, Buffer.from(await res.arrayBuffer())); }
    const R = runs(file);
    for (const s of cands) {
      const hit = R.find((x) => x[0] - s.startSec > -0.35 && x[0] - s.startSec < 1.4 && Math.abs(x[1] - s.endSec) < 0.35);
      if (!hit) continue;
      const v = vocab.find((v) => (s.normalizedText ?? "").includes(v.word.toLowerCase()) && ["expression", "slang", "adjective", "noun", "verb"].includes((v.type ?? "").toLowerCase()))!;
      console.log(`${(hit[1] - hit[0]).toFixed(2)}s  ${hit[0].toFixed(2)}->${hit[1].toFixed(2)}  [${v.type}] ${v.word}  ${r.title}#${s.index}  ${s.text}`);
    }
  }
  await p.$disconnect();
}
main();
