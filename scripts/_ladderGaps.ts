/**
 * Qué plazas de vocabulario del journey salen una sola vez, y en qué cuerpos
 * cabrían. Es la lista de trabajo para subir `journey-vocab-recirculation`.
 *
 * Para cada plaza huérfana dice el tema donde se enseñó; el trabajo es meter
 * esa palabra en el texto de otras dos historias. Solo lectura.
 *
 *   npx tsx scripts/_ladderGaps.ts <journeyId> [--por-historia]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const head = (w: string) => (tok(w).sort((a, b) => b.length - a.length)[0] ?? "");

async function main() {
  const journeyId = process.argv[2];
  const j = await p.journey.findUnique({ where: { id: journeyId }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId, text: { not: null } },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const cuerpos = st.map((s) => new Set(tok(s.text!)));
  const enc = (w: string) => cuerpos.filter((c) => c.has(w)).length;

  let total = 0, suma = 0;
  const porHistoria = process.argv.includes("--por-historia");
  for (const [i, s] of st.entries()) {
    const items = (s.vocab as Array<{ word: string }>) ?? [];
    const huerfanas: string[] = [];
    for (const v of items) {
      const n = enc(head(v.word));
      total++; suma += n;
      if (n <= 1) huerfanas.push(v.word);
    }
    if (porHistoria) {
      console.log(`\n[${i + 1}] ${s.slug}  ${huerfanas.length}/${items.length} salen una sola vez`);
      console.log("   " + huerfanas.join(", "));
    }
  }
  // `--check <json>`: mide un lote candidato ANTES de guardarlo, y dice cuántas
  // plazas del banco toca cada cuerpo nuevo. Es la paleta con la que hay que
  // escribir cuando el journey no llega al suelo de recirculación.
  const ci = process.argv.indexOf("--check");
  if (ci > 0) {
    const cand = JSON.parse(require("fs").readFileSync(process.argv[ci + 1], "utf8")) as Array<{ topic: string; slotIndex: number; text: string; vocab: Array<{ word: string }> }>;
    const byKey = new Map(cand.map((c) => [`${c.topic}#${c.slotIndex}`, c]));
    const nuevos = st.map((s) => byKey.get(`${s.topic}#${s.slotIndex}`)?.text ?? s.text!);
    const cuerposN = nuevos.map((t) => new Set(tok(t)));
    const encN = (w: string) => cuerposN.filter((c) => c.has(w)).length;
    let tot = 0, sum = 0;
    for (const [i, s] of st.entries()) {
      const items = (byKey.get(`${s.topic}#${s.slotIndex}`)?.vocab ?? (s.vocab as Array<{ word: string }>)) ?? [];
      for (const v of items) { tot++; sum += encN(head(v.word)); }
    }
    const banco = new Set(st.flatMap((s) => ((s.vocab as Array<{ word: string }>) ?? []).map((v) => head(v.word))));
    console.log("plazas del banco que toca cada cuerpo nuevo:");
    nuevos.forEach((t, i) => {
      const n = [...new Set(tok(t))].filter((w) => banco.has(w)).length;
      console.log(`  ${String(i + 1).padStart(2)} ${st[i].slug}: ${n}`);
    });
    console.log(`\nCANDIDATO: media ${(sum / tot).toFixed(2)} encuentros por plaza`);
    await p.$disconnect();
    return;
  }
  console.log(`\nmedia ${(suma / total).toFixed(2)} encuentros por plaza · ${total} plazas`);
  // Cuánto falta: cada aparición extra sube la media en 1/total.
  const objetivo = 3;
  console.log(`para llegar a ${objetivo}: ${Math.ceil(objetivo * total - suma)} apariciones más en los cuerpos`);
  await p.$disconnect();
}
main();
