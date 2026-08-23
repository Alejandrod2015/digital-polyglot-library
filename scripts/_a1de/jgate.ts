import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const m = __req.resolve("server-only"); __req.cache[m] = { id: m, filename: m, loaded: true, exports: {} } as never; } catch {}
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
import fs from "fs";
const file = process.argv[2];
const rows = JSON.parse(fs.readFileSync(file, "utf8"));
const ORDER = ["food-everyday-life","home-family","meeting-new-people","places-getting-around","community-celebrations","nature-adventure","legends-folklore"];
rows.sort((a: any, b: any) => (ORDER.indexOf(a.topic) - ORDER.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
const todas = rows.map((r: any) => ({ slug: r.slug, title: r.title, text: r.text, vocab: r.vocab, language: "DE", level: "a1" }));
const jc = validateJourneyStories(todas, { language: "DE", level: "a1", realPeople: [] });
for (const c of jc) console.log(`${c.status === "pass" ? "ok  " : c.status === "fail" ? "FAIL" : "SIN-IMPL"} [${c.id}] ${c.detail ?? ""}`);
