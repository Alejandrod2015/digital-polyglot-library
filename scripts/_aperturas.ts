import fs from "fs";
import { validateJourneyStories } from "../src/lib/validateJourneyStories";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const r = validateJourneyStories(d.map((s: any) => ({ slug: s.slug ?? `${s.topic}#${s.slotIndex}`, title: s.title, text: s.text, vocab: s.vocab, language: "PT", level: "A1" })), { language: "PT", level: "A1", realPeople: [] });
for (const c of r) if (c.status !== "pass") console.log(`${c.id}: ${c.detail}`);
