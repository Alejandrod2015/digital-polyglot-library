/** SOLO LECTURA. Corre validateJourneyStories (b1) sobre un JSON de historias
 *  (la tanda de borradores) e imprime cada regla de conjunto con su detalle. */
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as unknown as { cache: Record<string, unknown> }).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch { /* noop */ }
import * as fs from "fs";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
import { isPortugueseA1A2 } from "../../src/lib/cefr/portugueseA1A2";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; title: string; text: string; topic: string; vocab: Array<{ word: string; surface?: string }> }>;
const checks = validateJourneyStories(
  d.map((s) => ({ slug: s.slug, title: s.title, text: s.text, language: "portuguese", level: "b1", vocab: s.vocab, topic: s.topic })),
  { language: "portuguese", level: "b1", variant: "brazil" },
);
for (const c of checks) console.log(`${c.status.toUpperCase().padEnd(15)} ${c.id}${c.detail ? "  · " + String(c.detail).slice(0, 200) : ""}`);
const tot = d.reduce((a, s) => a + s.vocab.length, 0);
const sobre = d.reduce((a, s) => a + s.vocab.filter((v) => !isPortugueseA1A2(v.word)).length, 0);
console.log(`vocab por encima de A1/A2: ${sobre}/${tot} (${Math.round((100 * sobre) / tot)}%, suelo 30%)`);
