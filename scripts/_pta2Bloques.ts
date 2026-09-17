/** SOLO LECTURA. Los bloques que el LECTOR pinta (no los parrafos escritos) y
 *  que plaza de vocab cae en cada uno: es lo que mide
 *  narrator-block-distribution, y a ojo no se ve. */
// Neutraliza `server-only` igual que saveStory.ts y cierraTema.ts: la cadena
// de imports del lector pasa por prisma.ts, que lo trae.
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = {
    id: p, filename: p, loaded: true, exports: {},
  };
} catch { /* noop */ }

import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const historias = Array.isArray(d) ? d : d.stories;
for (const s of historias) {
  const blocks = renderedParagraphs(String(s.text));
  const vocab = (s.vocab ?? []) as Array<{ word: string; surface?: string }>;
  console.log(`\n== ${s.slug} · ${blocks.length} bloques renderizados`);
  blocks.forEach((b: string, i: number) => {
    const dentro = vocab.filter((v) => b.includes(v.surface ?? v.word)).map((v) => v.surface ?? v.word);
    console.log(`  bloque ${i + 1} (${dentro.length}): ${dentro.join(" ") || "-"}`);
    console.log(`    ${b.slice(0, 90)}...`);
  });
}
