/**
 * La tabla final del Traveler DE A0: una fila por historia, leyendo la BASE de
 * datos y no el fichero de trabajo. El reparto se saca de la lista fija de
 * secundarios del journey y no del heuristico de mayusculas, que en aleman
 * confunde cualquier sustantivo con un nombre propio.
 *
 *   npx tsx scripts/_deTable.ts <journeyId>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { quotedStats } from "./_quotedRatio";

const p = new PrismaClient();
const SECUNDARIOS = ["Elias", "Sophie", "Noah", "Emilia", "Leon", "Marie"];
const HERO = "Hannah";

async function main() {
  const jid = process.argv[2];
  const j = await p.journey.findUnique({ where: { id: jid }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: jid, NOT: { text: null } },
    select: { topic: true, slotIndex: true, title: true, slug: true, text: true, vocab: true },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const lemas = st.map((s) => ((s.vocab as { word: string; surface?: string }[]) ?? []));
  const cuerpos = st.map((s) => new Set(tok(String(s.text))));
  const clave = (v: { word: string; surface?: string }) =>
    (v.surface ?? v.word).toLowerCase().replace(/^(der|die|das)\s+/, "");

  console.log("| nº | historia | palabras | % citado | secundarios | cierre | vocab | vuelven | recoge |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  st.forEach((s, i) => {
    const text = String(s.text);
    const q = quotedStats(text);
    const sec = SECUNDARIOS.filter((n) => new RegExp(`\\b${n}`, "u").test(text));
    // El cierre: ultimo parrafo. "solo" = solo aparece la protagonista, o nadie.
    const ultimo = text.trim().split(/\n{2,}/).pop() ?? "";
    const conOtro = SECUNDARIOS.some((n) => ultimo.includes(n)) || /“/.test(ultimo);
    const cierre = conOtro ? "acompañada" : "sola";
    // Escalera: cuantas de sus plazas reaparecen mas adelante, y cuantas
    // recoge de historias anteriores.
    const mias = lemas[i].map(clave);
    const vuelven = mias.filter((w) => cuerpos.slice(i + 1).some((c) => c.has(w))).length;
    const recoge = lemas[i].filter((v) => cuerpos.slice(0, i).some((c) => c.has(clave(v)))).length;
    console.log(
      `| ${i + 1} | [${s.title}](http://localhost:3000/stories/${s.slug}) | ${q.total} | ${q.pct.toFixed(0)}% | ` +
      `${sec.join(", ") || "-"} | ${cierre} | ${lemas[i].length} | ${vuelven} | ${recoge} |`
    );
  });
  await p.$disconnect();
}
main();
