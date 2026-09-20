// Esqueleto de autoria: por historia, las apariciones sin trozo de palabras de
// contenido, con su frase, para rellenar la lista de trozos.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
import { uncoveredOccurrences, glossChunks, type GlossChunk } from "../src/lib/tapGlossChunk";
const prisma = new PrismaClient();
const CONTENIDO = new Set(["noun", "verb", "adjective", "adverb", "expression"]);
const [bundle, outDir] = process.argv.slice(2);
(async () => {
  const rows = await prisma.tapGlossSet.findMany({ where: { bundle, NOT: { slug: "" } } });
  const stories = await prisma.journeyStory.findMany({ where: { slug: { in: rows.map((r) => r.slug) } }, select: { slug: true, title: true, text: true } });
  const bySlug = new Map(stories.map((s) => [s.slug, s]));
  let total = 0;
  const resumen: string[] = [];
  for (const r of rows) {
    const st = bySlug.get(r.slug)!;
    const texto = `${st.title}\n${extractStoryPlainText(st.text)}`;
    const g = r.glosses as Record<string, { g: string; t: string; c?: GlossChunk; cs?: GlossChunk[] }>;
    const out: Record<string, unknown> = {};
    const lineas: string[] = [];
    for (const [w, e] of Object.entries(g)) {
      if (!e.c || !CONTENIDO.has(e.t)) continue;
      const sin = uncoveredOccurrences(w, texto, e);
      if (!sin.length) continue;
      total += sin.length;
      const frases = sin.map((o) => {
        const ini = Math.max(texto.lastIndexOf("\n", o.at), texto.lastIndexOf(". ", o.at) + 1, 0);
        const fins = [texto.indexOf("\n", o.at), texto.indexOf(". ", o.at)].filter((i) => i >= 0);
        const fin = fins.length ? Math.min(...fins) + 1 : texto.length;
        return texto.slice(ini, fin).trim();
      });
      out[w] = [...glossChunks(e), ...frases.map((f) => ({ es: f, en: "" }))];
      lineas.push(`${w} [${e.t}] g="${e.g}"  ya: ${glossChunks(e).map((c) => `"${c.es}"`).join(" / ")}\n` + frases.map((f) => `    - ${f}`).join("\n"));
    }
    if (Object.keys(out).length) {
      fs.writeFileSync(`${outDir}/${r.slug}.json`, JSON.stringify(out, null, 2));
      fs.writeFileSync(`${outDir}/${r.slug}.txt`, `# ${st.title}\n\n${texto}\n\n## huecos\n${lineas.join("\n")}\n`);
    }
    resumen.push(`${r.slug}: ${Object.keys(out).length} palabras`);
  }
  console.log(resumen.join("\n")); console.log("apariciones de contenido sin trozo:", total);
  await prisma.$disconnect();
})();
