/**
 * SOLO LECTURA. Corre el validador canonico sobre una historia YA publicada del
 * Traveler PT-BR A1, una vez declarandola a1 y otra b1, para ver que checks
 * existen en cada nivel. No escribe nada en la base.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch { /* noop */ }
import * as fs from "fs";
import { validateGeneratedStory } from "@/lib/validateGeneratedStory";

const st = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))[0];
const base = { title: st.title, synopsis: st.synopsis, text: st.text, vocab: st.vocab, arcType: st.arcType };

async function run(level: string) {
  const r = await validateGeneratedStory(JSON.stringify(base), {
    language: "PT", level, variant: "brazil", topic: st.topic, narratorStyle: true,
  } as never);
  const ids = r.checks.map((c: { id: string; status: string }) => `${c.id}:${c.status}`);
  console.log(`\n=== level=${level} : ${r.checks.length} checks, ok=${r.ok}`);
  console.log(ids.join("  "));
  return new Set(r.checks.map((c: { id: string }) => c.id));
}

async function main() {
  const a1 = await run("a1");
  const b1 = await run("b1");
  console.log("\nEN a1 Y NO EN b1:", [...a1].filter((x) => !b1.has(x)).join(", ") || "(ninguno)");
  console.log("EN b1 Y NO EN a1:", [...b1].filter((x) => !a1.has(x)).join(", ") || "(ninguno)");
}
main().catch((e) => console.error(String(e).slice(0, 1500)));
