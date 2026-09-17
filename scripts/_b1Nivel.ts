/**
 * Dice que palabras pasan `vocab-level-frequency` en B1 (ES). Usa las MISMAS
 * listas curadas que el juez del validador (`isSpanishUpToLevel`) mas su cache
 * gratuita; el juez no llama a ningun LLM, asi que esto da el mismo veredicto.
 *   npx tsx scripts/_b1Nivel.ts --file /tmp/lista.txt
 */
import * as fs from "fs";
import * as path from "path";
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";

const CACHE = path.join(process.cwd(), "src/lib/cefr/cache/spanish-llm-cache.json");
let cache: Record<string, string> = {};
try { cache = JSON.parse(fs.readFileSync(CACHE, "utf-8")); } catch { /* sin cache */ }
const ORDER = ["a1", "a2", "b1", "b2", "c1", "c2"];
const okCache = (w: string) => {
  const v = cache[w.toLowerCase()];
  return typeof v === "string" && ORDER.indexOf(v.toLowerCase()) <= ORDER.indexOf("b1");
};

const i = process.argv.indexOf("--file");
const words = i >= 0
  ? fs.readFileSync(process.argv[i + 1], "utf-8").split("\n").map((s) => s.trim()).filter(Boolean)
  : process.argv.slice(2);

const ok = words.filter((w) => isSpanishUpToLevel(w, "b1" as any) || okCache(w));
const no = words.filter((w) => !(isSpanishUpToLevel(w, "b1" as any) || okCache(w)));
console.log(`PASAN B1 (${ok.length}):\n  ${ok.join(", ")}\n`);
console.log(`FUERA (${no.length}):\n  ${no.join(", ")}`);
