/** Que pildoras de vocab caen en cada bloque RENDERIZADO (el lector reagrupa la
 *  prosa narrada de tres en tres oraciones, no respeta los parrafos de autor).
 *  Es lo que miden `narrator-block-distribution` y `narrator-block-cluster`, y
 *  sin verlo no hay forma de saber que palabra hay que mover. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import * as fs from "fs";
import { renderedParagraphs } from "@/lib/readerParagraphs";
const D = JSON.parse(fs.readFileSync("scripts/_a1latamV3.json", "utf8"));
for (const slug of process.argv.slice(2)) {
  const s = D.find((x: { slug: string }) => x.slug === slug);
  if (!s) { console.log(`?? ${slug}`); continue; }
  const bloques = renderedParagraphs(String(s.text));
  console.log(`\n### ${s.title}  (${bloques.length} bloques)`);
  for (const [i, b] of bloques.entries()) {
    const dentro = (s.vocab as Array<Record<string, string>>)
      .map((v) => v.surface ?? v.word).filter((w) => b.includes(w));
    console.log(`  B${i + 1} (${dentro.length}): ${dentro.join(", ")}`);
    console.log(`      ${b.slice(0, 150)}`);
  }
}
