// Rehace la capa `c` de portuguese-traveler-brazil-b1 donde describia una version
// vieja de las historias. Dos pasos:
//  1. capas/<slug>.json: trozo literal del texto actual, escrito con writeGlossLayer.
//  2. HUERFANAS: entradas de la capa cuya palabra ya no sale en la historia; se
//     borra la entrada entera. Se niega si la palabra aparece en el texto.
//   npx tsx scripts/_ptB1T/glosas/aplica.ts [--dry]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "../../../src/generated/prisma";
import { extractStoryPlainText } from "../../../src/lib/storyPlainText";
import { TAPPABLE, glossKeyCandidates } from "../../../src/lib/tapGlossKey";
const p = new PrismaClient();
const B = "portuguese-traveler-brazil-b1", J = "cmtrcpgso00073232h8vaf7na", D = "scripts/_ptB1T/glosas/capas";
const HUERFANAS: Record<string, string[]> = {
  "a-dor-nao-e-doenca": ["era", "estrada", "idioma", "professora", "quem"],
  "a-lousa-e-nenhum-livro": ["era", "quem"],
  "a-passagem-ja-comprada": ["ali", "turista"],
  "nada-minha-filha": ["chegado", "professora", "viagem"],
  "um-generico-ate-segunda": ["era", "professora"],
  "um-papel-que-ja-nao-vale": ["era", "professora"],
};
const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
(async () => {
  const dry = process.argv.includes("--dry");
  const slugs = [...new Set([...Object.keys(HUERFANAS), ...fs.readdirSync(D).map((f) => f.replace(/\.json$/, ""))])];
  const st = await p.journeyStory.findMany({ where: { journeyId: J, slug: { in: slugs } }, select: { slug: true, title: true, text: true } });
  const txt = new Map(st.map((s) => [s.slug!, norm(`${s.title}\n${extractStoryPlainText(s.text ?? "")}\n${s.text ?? ""}`)]));
  const malas: string[] = [];
  for (const s of slugs) {
    const t = txt.get(s);
    if (!t) { malas.push(`${s}: no es historia del journey`); continue; }
    const enTexto = new Set([...(t.match(TAPPABLE) ?? []).flatMap((x) => [x.toLowerCase(), ...glossKeyCandidates(x)]), ...[...t.matchAll(/\p{L}[\p{L}\p{M}'-]*/gu)].map((m) => m[0].toLowerCase())]);
    for (const w of HUERFANAS[s] ?? []) if (enTexto.has(w)) malas.push(`${s}: ${w} sale en el texto, no se borra`);
    if (!fs.existsSync(`${D}/${s}.json`)) continue;
    for (const [w, c] of Object.entries(JSON.parse(fs.readFileSync(`${D}/${s}.json`, "utf8")) as Record<string, { es: string; en: string }>)) {
      if (!t.includes(norm(c.es))) malas.push(`${s}:${w} no sale literal: ${c.es}`);
      if (c.es.split(/\s+/).length > 8) malas.push(`${s}:${w} pasa de 8 palabras`);
      if (!enTexto.has(w)) malas.push(`${s}:${w} no sale en la historia`);
    }
  }
  if (malas.length) { console.error(malas.join("\n")); process.exit(1); }
  if (dry) { console.log("dry: todo cuadra, nada escrito"); return p.$disconnect(); }
  for (const s of slugs) {
    if (fs.existsSync(`${D}/${s}.json`)) console.log(execFileSync("npx", ["tsx", "scripts/writeGlossLayer.ts", B, s, `${D}/${s}.json`], { encoding: "utf8" }).trim());
    if (!HUERFANAS[s]) continue;
    const fila = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: s } } }))!;
    const g = fila.glosses as Record<string, unknown>;
    for (const w of HUERFANAS[s]) { delete g[w]; console.log(`${s}\t${w}\tborrada`); }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: s } }, data: { glosses: g as never } });
  }
  await p.$disconnect();
})();
