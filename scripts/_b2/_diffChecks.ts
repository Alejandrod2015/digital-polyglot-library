/** Que checks del validador canonico cambian entre dos versiones de una historia
 *  (mismo contexto minimo): npx tsx scripts/_b2/_diffChecks.ts <a.json> <b.json> <slug> */
import fs from "node:fs";
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
(async () => {
  const { validateGeneratedStory } = await import("../../src/lib/validateGeneratedStory");
  const [fa, fb, slug] = process.argv.slice(2);
  const pick = (f: string) => (JSON.parse(fs.readFileSync(f, "utf8")) as any[]).find((s) => s.slug === slug);
  const run = async (d: any) => {
    const r = await validateGeneratedStory({ title: d.title, synopsis: d.synopsis, text: d.text, vocab: d.vocab, arcType: d.arcType } as any,
      { language: "ES", level: "b2", variant: "LATAM", topic: d.topic, journeyTitles: [], existing: [] } as any);
    return new Map(r.checks.map((c: any) => [c.id, `${c.status}${c.detail ? ": " + String(c.detail).slice(0, 110) : ""}`]));
  };
  const A = await run(pick(fa)), B = await run(pick(fb));
  console.log(`checks: ${A.size} -> ${B.size}`);
  for (const id of new Set([...A.keys(), ...B.keys()]))
    if (A.get(id)?.split(":")[0] !== B.get(id)?.split(":")[0]) console.log(`${id}\n   antes:   ${A.get(id) ?? "(no evaluado)"}\n   despues: ${B.get(id) ?? "(no evaluado)"}`);
})();
