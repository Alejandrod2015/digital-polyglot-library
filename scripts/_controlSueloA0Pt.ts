// Solo lectura: pasa el suelo A0 portugues (journey-a0-floor) por historias ya escritas, como control.
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import * as fs from "fs";
import { validateJourneyStories } from "../src/lib/validateJourneyStories";
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  const stories = d.map((s: any) => ({ slug: s.slug ?? `${s.topic}#${s.slotIndex}`, title: s.title, text: s.text, language: "PT", level: "A0", vocab: s.vocab, topic: s.topic }));
  const r: any = validateJourneyStories(stories, { language: "PT", level: "A0" });
  const checks: any[] = Array.isArray(r) ? r : (r.checks ?? []);
  const c = checks.find((x) => x.id === "journey-a0-floor");
  console.log(`== ${f.split("/").pop()}: ${c?.status ?? "?"}`);
  if (c?.detail) for (const l of String(c.detail).split(" | ")) console.log("   " + l);
}
