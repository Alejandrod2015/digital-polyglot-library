// SOLO LECTURA. Comprobacion del encargo (molde: scripts/_frA1F/glosas/mideC.ts):
// cuenta las entradas `c` de la capa de portuguese-traveler-brazil-b1 que no son
// un trozo real del texto ACTUAL de su historia.
//  - noLiteral: c.es no aparece literal en titulo + texto actual
//  - sola: c.es es la palabra sola y c.en es la definicion global (g) o un corte suyo.
//    No cuenta si la palabra ES un trozo entero del texto (una replica entre
//    comillas, “Mandei”, o la acotacion suelta tras ellas, ”, esclareceu.): ahi
//    no hay frase mas larga que darle (criterio de _frA1F/glosas/mideC.ts).
//  - largo: c.es pasa de 8 palabras
//  - sinPalabra: c.es no contiene la palabra tocada
//  - huerfana: la palabra ya no sale en la historia (entrada de texto viejo)
//   npx tsx scripts/_ptB1T/glosas/mideC.ts [--detalle]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../../src/generated/prisma";
import { extractStoryPlainText } from "../../../src/lib/storyPlainText";
import { TAPPABLE, glossKeyCandidates } from "../../../src/lib/tapGlossKey";
const p = new PrismaClient();
const B = "portuguese-traveler-brazil-b1", J = "cmtrcpgso00073232h8vaf7na";
const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const LINT = /\p{L}[\p{L}\p{M}'-]*/gu;
(async () => {
  const det = process.argv.includes("--detalle");
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const global = (rows.find((r) => !r.slug)!.glosses) as Record<string, { g: string }>;
  const hist = rows.filter((r) => r.slug);
  const st = await p.journeyStory.findMany({ where: { journeyId: J, slug: { in: hist.map((h) => h.slug) } }, select: { slug: true, title: true, text: true } });
  const txt = new Map(st.map((s) => [s.slug!, norm(`${s.title}\n${extractStoryPlainText(s.text ?? "")}\n${s.text ?? ""}`)]));
  const cnt: Record<string, number> = { total: 0, noLiteral: 0, sola: 0, largo: 0, sinPalabra: 0, huerfana: 0 };
  const malas = new Set<string>();
  const n = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  for (const h of hist) {
    const t = txt.get(h.slug);
    if (!t) { console.log(`SIN HISTORIA: ${h.slug}`); continue; }
    const enTexto = new Set([...(t.match(TAPPABLE) ?? []).flatMap((x) => [x.toLowerCase(), ...glossKeyCandidates(x)]), ...[...t.matchAll(LINT)].map((m) => m[0].toLowerCase())]);
    const capa = h.glosses as Record<string, { c?: { es: string; en: string } }>;
    for (const [k, v] of Object.entries(capa)) {
      if (!v.c) continue;
      cnt.total++;
      const es = norm(v.c.es), en = norm(v.c.en), id = `${h.slug}:${k}`;
      const f: string[] = [];
      if (!enTexto.has(k)) f.push("huerfana");
      if (!t.includes(es)) f.push("noLiteral");
      if (n(es) > 8) f.push("largo");
      const toks = [...(es.match(TAPPABLE) ?? []).flatMap((x) => [x.toLowerCase(), ...glossKeyCandidates(x)]), ...[...es.matchAll(LINT)].map((m) => m[0].toLowerCase())];
      if (!toks.includes(k)) f.push("sinPalabra");
      const g = (global[k]?.g ?? "").toLowerCase();
      const esSola = n(es) === 1 && es.toLowerCase().replace(/[^\p{L}'-]/gu, "") === k;
      const esc = es.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const trozoEntero = new RegExp(`(“|”, )${esc}[.?!,”]`, "u").test(t);
      if (esSola && !trozoEntero && g && en && g.startsWith(en.toLowerCase())) f.push("sola");
      for (const x of f) cnt[x]++;
      if (f.length) { malas.add(id); if (det) console.log(`${id}\t${f.join(",")}\t${es} / ${en}`); }
    }
  }
  console.log(JSON.stringify({ historias: hist.length, ...cnt, entradasMalas: malas.size }));
  if (malas.size) process.exitCode = 1;
  await p.$disconnect();
})();
