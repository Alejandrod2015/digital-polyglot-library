// Solo lectura: propone el trozo de contexto (c.es) de cada entrada de cada historia del A0 PT-BR:
// la clausula literal de su oracion (titulo incluido), partida en tramos de 6 palabras como mucho.
// Escribe una hoja por historia: trozo -> palabras que cubre, con su glosa, para traducir y revisar.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const B = "portuguese-traveler-brazil-a0";
const tok = (s: string) => (s.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/gu) ?? []);
function trozos(oracion: string): string[] {
  const out: string[] = [];
  for (const cl of oracion.split(/\s*[,;:“”]\s*|\s+(?=—)/).map((c) => c.replace(/^[\s.!?]+|[\s.!?]+$/g, "")).filter(Boolean)) {
    const ws = cl.split(/\s+/);
    if (ws.length <= 6) { out.push(cl); continue; }
    const n = Math.ceil(ws.length / 5);
    const tam = Math.ceil(ws.length / n);
    for (let i = 0; i < ws.length; i += tam) out.push(ws.slice(i, i + tam).join(" "));
  }
  return out;
}
async function main() {
  const dir = process.argv[2]; fs.mkdirSync(dir, { recursive: true });
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B, NOT: { slug: "" } } });
  const hist = await p.journeyStory.findMany({ where: { journeyId: "cmtvpqsfv000832hgemzk20cl" }, select: { slug: true, title: true, text: true, topic: true, slotIndex: true } });
  let totT = 0, totE = 0;
  for (const f of filas) {
    const h = hist.find((x) => x.slug === f.slug)!;
    const g = f.glosses as Record<string, { g: string; t: string }>;
    const oraciones = [h.title!, ...h.text!.replace(/\n+/g, " ").split(/(?<=[.!?”])\s+/)].map((o) => o.trim()).filter(Boolean);
    const hoja: Record<string, { oracion: string; palabras: Record<string, string> }> = {};
    const asignada = new Set<string>();
    for (const o of oraciones) for (const t of trozos(o)) {
      for (const w of tok(t)) {
        if (!g[w] || asignada.has(w)) continue;
        asignada.add(w);
        (hoja[t] ??= { oracion: o, palabras: {} }).palabras[w] = `${g[w].g} [${g[w].t}]`;
      }
    }
    const sin = Object.keys(g).filter((w) => !asignada.has(w));
    fs.writeFileSync(`${dir}/${h.topic}-${h.slotIndex}-${f.slug}.json`, JSON.stringify({ slug: f.slug, sinTrozo: sin, trozos: hoja }, null, 1));
    totT += Object.keys(hoja).length; totE += asignada.size;
    if (sin.length) console.log(`${f.slug}: sin trozo -> ${sin.join(", ")}`);
  }
  console.log(`hojas: ${filas.length} · trozos distintos: ${totT} · entradas cubiertas: ${totE}`);
}
main().finally(() => p.$disconnect());
