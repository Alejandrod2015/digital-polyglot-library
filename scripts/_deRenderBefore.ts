/** Cuantos bloques partia el lector ANTES del arreglo del 2026-08-23, por
 *  journey. Reproduce el `splitSentences` viejo (sin la regla de la comilla
 *  abierta) para medir el alcance de lo que se arreglo. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

function splitViejo(raw: string): string[] {
  const text = raw.replace(/\s*\n+\s*/g, " ").trim();
  if (!text) return [];
  const parts = text.split(/(?<=[.!?…‽⁇⁉]["»”’]?)(?:\s+|$)/u);
  const clean = parts.map((s) => s.trim()).filter((s) => s.length > 0).filter((s) => /[\p{L}\p{N}]/u.test(s));
  const merged: string[] = [];
  for (const seg of clean) {
    if (merged.length > 0 && /^[\s,"'“”„«»)\]]*[\p{Ll}]/u.test(seg)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${seg}`; continue;
    }
    merged.push(seg);
  }
  return merged;
}
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

(async () => {
  const st = await p.journeyStory.findMany({
    where: { text: { not: null }, journey: { status: { not: "archived" } } },
    select: { slug: true, text: true, journey: { select: { language: true, variant: true, name: true, levels: true } } },
  });
  const porJ = new Map<string, { rotos: number; hist: Set<string>; total: number }>();
  for (const s of st) {
    const t = String(s.text);
    const k = `${s.journey?.language}/${s.journey?.variant} ${s.journey?.levels} ${s.journey?.name}`;
    if (!porJ.has(k)) porJ.set(k, { rotos: 0, hist: new Set(), total: 0 });
    const e = porJ.get(k)!; e.total++;
    for (const b of chunk(splitViejo(t), 3).map((x) => x.join(" "))) {
      for (const [abre, cierra] of [["“", "”"], ["«", "»"]]) {
        if (!t.includes(abre)) continue;
        if ((b.split(abre).length - 1) !== (b.split(cierra).length - 1)) { e.rotos++; e.hist.add(s.slug!); }
      }
    }
  }
  const filas = [...porJ].filter(([, v]) => v.rotos).sort((a, b) => b[1].rotos - a[1].rotos);
  let tot = 0, hist = 0;
  console.log("bloques  historias  journey");
  for (const [k, v] of filas) { tot += v.rotos; hist += v.hist.size; console.log(`${String(v.rotos).padStart(5)}    ${String(v.hist.size).padStart(3)}/${String(v.total).padEnd(3)}  ${k}`); }
  console.log(`\nTOTAL antes del arreglo: ${tot} bloques partidos en ${hist} historias de ${st.length}`);
  await p.$disconnect();
})();
