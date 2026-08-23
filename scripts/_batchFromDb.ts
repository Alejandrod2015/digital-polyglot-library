/**
 * Vuelca las 21 historias del journey a UN fichero, aplicando encima las
 * ediciones sueltas que haya en el scratchpad. El gate de journey es todo o
 * nada, asi que las correcciones solo entran si se guardan juntas.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";
const p = new PrismaClient();
const J = "cmsyrge55000732u9oiu8wue3";
async function main() {
  const [out, dir] = process.argv.slice(2);
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: J, text: { not: null } } });
  const orden = j?.topics ?? [];
  rows.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const edits = new Map<string, any>();
  if (dir) for (const f of readdirSync(dir).filter((x) => /^(one8-|vara)/.test(x) && x.endsWith(".json"))) {
    for (const s of JSON.parse(readFileSync(path.join(dir, f), "utf8"))) edits.set(`${s.topic}#${s.slotIndex}`, s);
  }
  const todas = rows.map((r) => {
    const e = edits.get(`${r.topic}#${r.slotIndex}`);
    return { topic: r.topic, slotIndex: r.slotIndex, title: e?.title ?? r.title, arcType: e?.arcType ?? (r as any).arcType,
             synopsis: e?.synopsis ?? (r as any).synopsis, text: e?.text ?? r.text, vocab: e?.vocab ?? r.vocab };
  });
  writeFileSync(out, JSON.stringify(todas, null, 1));
  console.log(`${todas.length} historias · ${edits.size} con edicion aplicada`);
  await p.$disconnect();
}
main();
