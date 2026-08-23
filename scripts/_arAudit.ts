/** Audita las 21 del journey contra TODAS las reglas: imprime el estado de cada
 *  check del validador canonico por historia, no solo los fallos. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch { /* noop */ }
import * as fs from "fs";
import { validateGeneratedStory, extractStoryMotifs, extractProperNouns, type ExistingStorySummary } from "@/lib/validateGeneratedStory";

function summarize(d: any): ExistingStorySummary {
  const names = new Set<string>();
  for (const n of extractProperNouns(String(d.text))) names.add(n);
  const firstPara = String(d.text).split(/\n{2,}/)[0] ?? "";
  const firstSentence = (firstPara.split(/(?<=[.!?])\s/)[0] ?? firstPara).trim();
  return { title: d.title, arcType: d.arcType ?? null, vocabLemmas: (d.vocab ?? []).map((v: any) => String(v.word)),
    characterNames: [...names], openingFirstSentence: firstSentence, motifTags: extractStoryMotifs(String(d.text)) };
}
const titles = (JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[]).map((d) => d.title);
const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ctx = { language: "ES", level: "a0", variant: "argentina" };
const tally = new Map<string, { pass: number; warn: number; fail: number }>();
const existing: ExistingStorySummary[] = [];
async function main() {
for (const d of stories) {
  const r = await validateGeneratedStory({ title: d.title, synopsis: d.synopsis, text: d.text, vocab: d.vocab, arcType: d.arcType } as never,
    { ...ctx, topic: d.topic, journeyTitles: titles.filter((t) => t !== d.title), existing: [...existing] } as never);
  for (const c of r.checks) {
    const t = tally.get(c.id) ?? { pass: 0, warn: 0, fail: 0 };
    (t as never as Record<string, number>)[c.status] = ((t as never as Record<string, number>)[c.status] ?? 0) + 1;
    tally.set(c.id, t);
  }
  existing.push(summarize(d));
}
console.log(`checks distintos: ${tally.size}\n`);
for (const [id, t] of [...tally].sort()) {
  const marca = t.fail ? "FAIL" : t.warn ? "warn" : "ok  ";
  console.log(`${marca} ${id.padEnd(34)} pass ${String(t.pass).padStart(2)} warn ${String(t.warn).padStart(2)} fail ${String(t.fail).padStart(2)}`);
}
}
main();
