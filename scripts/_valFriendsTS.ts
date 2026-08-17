// Neutraliza el guard `server-only` para poder correr el validador canónico fuera de Next.
import { createRequire } from "module";
const req = createRequire(__filename);
try { const p = req.resolve("server-only"); (req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import * as fs from "fs";
import { validateGeneratedStory } from "@/lib/validateGeneratedStory";
(async () => {
  const data = JSON.parse(fs.readFileSync("scripts/_friendsT1_data.json", "utf8"));
  for (const d of data) {
    const payload = { title: d.title, synopsis: d.synopsis, text: d.text, vocab: d.vocab, arcType: d.arcType };
    const r = await validateGeneratedStory(payload as any, { language: "ES", level: "c1", topic: d.topic, variant: "LATAM", journeyTitles: [], existing: [] });
    console.log(`\n=== ${d.topic}#${d.slotIndex} "${d.title}"  ok=${r.ok}  pass=${r.summary.pass} warn=${r.summary.warn} fail=${r.summary.fail}`);
    for (const c of r.checks) if (c.status !== "pass") console.log(`   ${c.status.toUpperCase()}  [${c.id}] ${c.label}${c.detail ? " :: " + c.detail : ""}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
