// SOLO LECTURA. Comprobacion del encargo: falla si alguna entrada `c` de la
// capa de french-friends-france-a1 no es un trozo real. Cuenta:
//  - sola: c.es es la palabra sola Y c.en es la definicion global (g) intacta
//    o cortada, el patron exacto del defecto original (un trozo real de una
//    palabra, con su ingles propio, NO cuenta: "Non." / "No." es correcto)
//  - noLiteral: c.es no aparece literal en titulo + texto de la historia
//  - largo: c.es pasa de 8 palabras
//  - sinPalabra: c.es no contiene la palabra tocada
//  - enCortado: c.en es un prefijo de la definicion global (g), no una traduccion
//  - enLargo: c.en pasa de N+3 palabras del trozo
//  - enAjeno: c.en no es la traduccion escrita para ESE trozo en piezas*.txt
//   npx tsx scripts/_frA1F/glosas/mideC.ts [--detalle]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../../src/generated/prisma";
import { extractStoryPlainText } from "../../../src/lib/storyPlainText";
import { TAPPABLE, glossKeyCandidates } from "../../../src/lib/tapGlossKey";
const p = new PrismaClient();
const B = "french-friends-france-a1";
const norm = (s: string) => s.replace(/’/g, "'").replace(/\s+/g, " ").trim();
(async () => {
  const det = process.argv.includes("--detalle");
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const global = (rows.find((r) => !r.slug)!.glosses) as Record<string, { g: string }>;
  const hist = rows.filter((r) => r.slug);
  const st = await p.journeyStory.findMany({ where: { slug: { in: hist.map((h) => h.slug) } }, select: { slug: true, title: true, text: true } });
  const txt = new Map(st.map((s) => [s.slug!, norm(`${s.title}\n${extractStoryPlainText(s.text ?? "")}\n${s.text ?? ""}`)]));
  const cnt: Record<string, number> = { total: 0, sola: 0, noLiteral: 0, largo: 0, sinPalabra: 0, enCortado: 0, enLargo: 0, enAjeno: 0 };
  const tr = new Map<string, string>(); let sl = "";
  for (const f of fs.readdirSync("scripts/_frA1F/glosas").filter((x) => /^piezas\d+\.txt$/.test(x)))
    for (const l of fs.readFileSync(`scripts/_frA1F/glosas/${f}`, "utf8").split("\n")) {
      if (l.startsWith("## ")) sl = l.slice(3).trim(); else if (l.includes("|||")) { const [a, b] = l.split("|||").map((x) => norm(x)); tr.set(`${sl}\t${a}`, b); }
    }
  const malas = new Set<string>();
  const n = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  for (const h of hist) {
    const capa = h.glosses as Record<string, { c?: { es: string; en: string } }>;
    for (const [k, v] of Object.entries(capa)) {
      if (!v.c) continue;
      cnt.total++;
      const es = norm(v.c.es), en = norm(v.c.en), id = `${h.slug}:${k}`;
      const fallos: string[] = [];
      if (!txt.get(h.slug)!.includes(es)) fallos.push("noLiteral");
      if (n(es) > 8) fallos.push("largo");
      const toks = (es.match(TAPPABLE) ?? []).flatMap((t) => [t.toLowerCase().replace(/’/g, "'"), ...glossKeyCandidates(t)]);
      if (!toks.includes(k)) fallos.push("sinPalabra");
      const g = (global[k]?.g ?? "").toLowerCase();
      const esSola = n(es) === 1 && es.toLowerCase().replace(/[^\p{L}'-]/gu, "") === k;
      if (esSola && g && (g === en.toLowerCase() || g.startsWith(en.toLowerCase()))) fallos.push("sola");
      if (esSola && g && en.length > 0 && g.startsWith(en.toLowerCase()) && en.toLowerCase() !== es.toLowerCase()) fallos.push("enCortado");
      if (n(en) > n(es) + 3) fallos.push("enLargo");
      if (tr.get(`${h.slug}\t${es}`) !== en) fallos.push("enAjeno");
      for (const f of fallos) cnt[f]++;
      if (fallos.length) { malas.add(id); if (det) console.log(`${id}\t${fallos.join(",")}\t${es} / ${en}`); }
    }
  }
  console.log(JSON.stringify({ historias: hist.length, ...cnt, entradasMalas: malas.size }));
  if (malas.size) process.exitCode = 1;
  await p.$disconnect();
})();
