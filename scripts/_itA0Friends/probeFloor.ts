// Prueba los detectores IT de validateJourneyStories contra un volcado: el
// Friends IT A0 de julio (A0 en presente) sirve de control de falsos positivos.
import { readFileSync } from "fs";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const k of process.argv.slice(3)) {
  const stories = (d[k] ?? d).map((s: any, i: number) => ({ slug: s.slug ?? `${k}-${i}`, title: s.title, text: s.text, topic: s.topic, vocab: s.vocab ?? [] }));
  const out = validateJourneyStories(stories, { language: "IT", level: "A0" } as any);
  for (const c of out as any[]) if (/a0-floor|character-intro|opening-shape|elderly|cast|introduction/.test(c.id)) console.log(k, c.id, c.status ?? c.ok, String(c.detail ?? "").slice(0, 600));
}
