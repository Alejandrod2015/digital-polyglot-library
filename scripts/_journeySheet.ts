/**
 * Ficha por historia de un journey: lo que hay que mirar antes de dar por bueno
 * el texto. Solo lectura.
 *
 *   npx tsx scripts/_journeySheet.ts <journeyId>
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const W = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const QUOTE = /“[^”]*”/g;

async function main() {
  const journeyId = process.argv[2];
  const j = await p.journey.findUnique({ where: { id: journeyId }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId, NOT: { text: null } },
    select: { topic: true, slotIndex: true, title: true, text: true, vocab: true, status: true,
              coverUrl: true, audioUrl: true, practiceSet: { select: { id: true } } },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  // El reparto se saca del propio corpus, no de una lista fija: con los nombres
  // franceses escritos a mano, este script daba "sola" en las 21 de cualquier
  // journey alemán.
  //
  // En alemán TODO sustantivo va en mayúscula, así que la mayúscula no basta.
  // El filtro que sí vale en los cuatro idiomas del catálogo: un nombre propio
  // no lleva artículo delante. Si la palabra aparece alguna vez precedida de
  // der/die/das/ein/le/la/un/el/il..., es un sustantivo común y se descarta.
  const ART = /\b(der|die|das|den|dem|des|ein|eine|einen|einem|einer|le|la|les|un|une|des|du|el|los|las|il|lo|gli|zum|zur|im|am|beim|vom)\s+$/i;
  // Y solo cuentan las apariciones a MITAD de frase: a principio de oración
  // cualquier palabra va en mayúscula, y así se colaban "Der", "Elle", "Alors".
  const MID = /[\p{Ll}],?\s+$|[\p{Ll}]\s+$/u;
  const CAPS = /\p{Lu}\p{Ll}{2,}/gu;
  const conArticulo = new Set<string>();
  const cuenta = new Map<string, number>();
  for (const x of st) {
    const t = String(x.text ?? "");
    const vistos = new Set<string>();
    for (const m of t.matchAll(CAPS)) {
      const i = m.index ?? 0;
      const antes = t.slice(Math.max(0, i - 14), i);
      if (ART.test(antes)) { conArticulo.add(m[0]); continue; }
      if (MID.test(antes)) vistos.add(m[0]);
    }
    for (const w of vistos) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
  }
  const ranked = [...cuenta.entries()]
    .filter(([w, n]) => n >= 2 && !conArticulo.has(w))
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);
  const hero = ranked[0] ?? "";
  const CAST = ranked;
  // La escalera, en las mismas filas: sin esto la ficha mide el texto y deja
  // fuera lo que estamos arreglando, que es la repeticion de vocabulario.
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const depl = (w: string) => (w.length > 3 && /(?:es|s|x)$/.test(w) ? w.replace(/(?:es|s|x)$/, "") : w);
  const strip = (w: string) => w.replace(/^(le|la|les|l'|un|une|des|du|de)\s+/i, "").trim();
  const casa = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i >= 4; };
  const words = st.map((x) => tok(String(x.text)).map(depl));
  const taught = st.map((x) => ((x.vocab as Array<{ word: string }>) ?? []).map((v) => ({
    word: v.word, k: depl([...tok(strip(v.word))].sort((a, b) => b.length - a.length)[0] ?? ""),
  })));
  console.log("n|historia|palabras|%citado|personajes|cierra|vocab|vuelve|recoge|cuales vuelven");
  for (const [i, s] of st.entries()) {
    const t = String(s.text ?? "");
    const q = (t.match(QUOTE) ?? []).reduce((n, m) => n + W(m.replace(/[“”]/g, "")), 0);
    const quien = CAST.filter((c) => c !== hero && t.includes(c));
    // Ultima frase: dice como cierra y si Manon se queda sola.
    const last = t.trim().split(/\n\n/).pop() ?? "";
    const sola = !CAST.some((c) => c !== hero && last.includes(c));
    const vuelven = taught[i].filter((v) => words.slice(i + 1).some((arr) => arr.some((x) => casa(x, v.k))));
    const recoge = new Set<string>();
    for (let n = 0; n < i; n++) for (const v of taught[n]) if (words[i].some((x) => casa(x, v.k))) recoge.add(v.word);
    console.log([
      i + 1, s.title, W(t), `${((q / W(t)) * 100).toFixed(0)}%`,
      quien.length ? quien.join(", ") : "-",
      sola ? "sola" : "acompañada",
      (s.vocab as unknown[])?.length ?? 0,
      vuelven.length, recoge.size,
      vuelven.map((v) => v.word).join(", ") || "-",
    ].join("|"));
  }
  await p.$disconnect();
}
main();
