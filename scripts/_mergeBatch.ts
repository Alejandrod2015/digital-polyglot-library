/** Junta el borrador nuevo con las historias viejas que aún no se reescriben,
 *  para poder validar la tanda ENTERA (el gate mira el journey completo). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { readFileSync, writeFileSync } from "fs";
const p = new PrismaClient();
async function main() {
  const [nuevo, out] = process.argv.slice(2);
  const drafts = JSON.parse(readFileSync(nuevo, "utf8"));
  const clave = new Set(drafts.map((s: any) => `${s.topic}#${s.slotIndex}`));
  const j = await p.journey.findUnique({ where: { id: "cmsyrge55000732u9oiu8wue3" }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmsyrge55000732u9oiu8wue3", text: { not: null } } });
  const orden = j?.topics ?? [];
  const viejas = rows.filter((r) => !clave.has(`${r.topic}#${r.slotIndex}`))
    .map((r) => ({ topic: r.topic, slotIndex: r.slotIndex, title: r.title, arcType: (r as any).arcType, synopsis: (r as any).synopsis, text: r.text, vocab: r.vocab }));
  const todas = [...drafts, ...viejas].sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  writeFileSync(out, JSON.stringify(todas, null, 1));
  console.log(`${todas.length} historias · ${drafts.length} nuevas`);
  await p.$disconnect();
}
main();
