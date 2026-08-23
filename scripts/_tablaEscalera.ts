/** Tabla de recirculacion del DE A0 Traveler, con la MISMA clave y el mismo
 *  conteo que usa el gate `journey-vocab-recirculation`, para que el numero de
 *  la tabla y el del gate no puedan discrepar. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const J = "cmt0a8vb1000m32p1x7r5ba28";
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: any) => String(v.surface ?? v.word).toLowerCase()
  .replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");

(async () => {
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const orden: string[] = (j?.topics as string[]) ?? [];
  const ss = await p.journeyStory.findMany({ where: { journeyId: J },
    select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true } });
  ss.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const cuerpos = ss.map((s) => new Set(tok(s.text ?? "")));

  const todas: Array<{ n: number; slug: string; w: string; enc: number; donde: number[] }> = [];
  console.log("n\thistoria\tplazas\tmedia\t1 vez\t4 o mas");
  ss.forEach((s, i) => {
    const vs: any[] = (s.vocab as any[]) ?? [];
    const encs = vs.map((v) => {
      const k = clave(v);
      const donde: number[] = [];
      cuerpos.forEach((c, idx) => { if (c.has(k)) donde.push(idx + 1); });
      todas.push({ n: i + 1, slug: s.slug!, w: String(v.word), enc: donde.length, donde });
      return donde.length;
    });
    const media = encs.length ? encs.reduce((a, b) => a + b, 0) / encs.length : 0;
    console.log([i + 1, s.title, vs.length, media.toFixed(2),
      encs.filter((n) => n <= 1).length, encs.filter((n) => n >= 4).length].join("\t"));
  });

  const enc = todas.map((t) => t.enc);
  const media = enc.reduce((a, b) => a + b, 0) / enc.length;
  console.log(`\nTOTAL\tplazas ${enc.length}\tmedia ${media.toFixed(2)}\tliston 3.00`);
  const dist: Record<string, number> = {};
  for (const n of enc) { const k = n >= 4 ? "4+" : String(n); dist[k] = (dist[k] ?? 0) + 1; }
  console.log("reparto:", JSON.stringify(dist));
  const solas = todas.filter((t) => t.enc <= 1);
  console.log(`\nplazas que salen UNA sola vez (${solas.length}):`);
  for (const s of solas) console.log(`  h${s.n} ${s.w}`);

  // Corte en la historia 15: una plaza presentada despues casi no puede
  // reencontrarse, asi que la regla mira solo las de las 15 primeras.
  const pre15 = todas.filter((t) => t.n <= 15);
  const m15 = pre15.reduce((a, b) => a + b.enc, 0) / pre15.length;
  console.log(`\nplazas presentadas en h1-h15: ${pre15.length}, media ${m15.toFixed(2)}`);

  // Solape con el resto del catalogo vivo (tope 2).
  const otras = await p.journey.findMany({ where: { status: { not: "archived" }, id: { not: J } },
    select: { language: true, variant: true, levels: true, stories: { select: { vocab: true } } } });
  const mias = new Set(todas.map((t) => clave({ word: t.w })));
  const filas: string[] = [];
  for (const o of otras) {
    const suyas = new Set<string>();
    for (const st of o.stories) for (const v of ((st.vocab as any[]) ?? [])) suyas.add(clave(v));
    const comunes = [...mias].filter((w) => suyas.has(w));
    if (comunes.length) filas.push(`${o.language}/${o.variant} ${(o.levels ?? []).join("/")}\t${comunes.length}\t${comunes.slice(0, 12).join(", ")}`);
  }
  console.log("\nsolape con otros journeys (tope 2 por journey):");
  for (const f of filas.sort((a, b) => Number(b.split("\t")[1]) - Number(a.split("\t")[1]))) console.log("  " + f);
  await p.$disconnect();
})();
