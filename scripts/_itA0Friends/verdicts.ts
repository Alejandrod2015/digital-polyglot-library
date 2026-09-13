// Compara el veredicto de validateJourneyStories antes (ef5e6eef^) y ahora
// sobre los journeys italianos existentes.
import { readFileSync } from "fs";
import { validateJourneyStories as ahora } from "../../src/lib/validateJourneyStories";
import { validateJourneyStories as antes } from "../../src/lib/_vjsBefore";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const topicOrder: Record<string, string[]> = {};
for (const k of ["friendsJul", "travA1", "travA2"]) {
  const stories = d[k].map((s: any, i: number) => ({ slug: `${k}-${i}`, title: s.title, text: s.text, topic: s.topic, vocab: s.vocab ?? [], language: "IT", level: k === "travA2" ? "A2" : k === "travA1" ? "A1" : "A0" }));
  const lvl = k === "travA2" ? "A2" : k === "travA1" ? "A1" : "A0";
  const a = antes(stories, { language: "IT", level: lvl, realPeople: ["Zzzz"] } as any);
  const b = ahora(stories, { language: "IT", level: lvl, realPeople: ["Zzzz"] } as any);
  const ids = new Set([...a, ...b].map((c) => c.id));
  const blocks = (xs: any[]) => xs.filter((c) => c.status === "fail" || c.status === "not-implemented").length;
  console.log(`\n== ${k} (${lvl}) bloqueantes antes ${blocks(a)} · ahora ${blocks(b)}`);
  for (const id of ids) {
    const x = a.find((c) => c.id === id)?.status, y = b.find((c) => c.id === id)?.status;
    if (x !== y) console.log(`   ${id}: ${x} -> ${y}`);
  }
}
