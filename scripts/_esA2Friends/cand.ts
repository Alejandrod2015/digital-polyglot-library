// Solo lectura: clasifica candidatas de vocab por tema contra la lista ES A2 y lo ensenado en el pool spain.
import fs from "node:fs";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const cand: Record<string, string> = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const norm = (w: string) => w.toLowerCase().trim().replace(/^(el|la|los|las|un|una)\s+/, "");
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
const trav = new Map<string, string>(), trvPort = new Set<string>(), fr = new Set<string>(), otros = new Set<string>();
for (const j of d.js) for (const s of j.stories) for (const v of (s.vocab ?? [])) {
  if (!v?.word) continue; const w = norm(v.word); const t = String(v.type ?? "").toLowerCase();
  if (j.language !== "spanish") continue;
  if (j.variant !== "spain") { otros.add(w); continue; }
  if (j.typeSlug === "relationships") fr.add(w);
  else if (PORT.has(t)) trvPort.add(w); else trav.set(w, j.levels.join());
}
const topics = new Map(d.topics.map((t: any) => [t.slug, t.label]));
for (const [tema, lista] of Object.entries(cand)) {
  const [slug] = tema.split(" ");
  console.log(`\n## ${tema}  slug en Topic: ${topics.has(slug) ? "EXISTE (" + topics.get(slug) + ")" : "libre"}`);
  const cub: Record<string, string[]> = { "libre": [], "reabrible(FriendsA1 o portable)": [], "BLOQ Traveler": [], "FUERA lista": [] };
  for (const raw of lista.split(",").map((x) => x.trim()).filter(Boolean)) {
    const w = norm(raw);
    if (!isSpanishUpToLevel(w, "a2")) cub["FUERA lista"].push(raw);
    else if (trav.has(w)) cub["BLOQ Traveler"].push(`${raw}(${trav.get(w)})`);
    else if (fr.has(w) || trvPort.has(w)) cub["reabrible(FriendsA1 o portable)"].push(raw);
    else cub["libre"].push(raw);
  }
  for (const [k, v] of Object.entries(cub)) console.log(`  ${k} [${v.length}]: ${v.join(", ")}`);
}
