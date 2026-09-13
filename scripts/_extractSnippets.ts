/** Para cada historia del bundle, extrae { palabra: snippet_alemán } para toda
 *  palabra tocable que tenga glosa global. Snippet = oración que la contiene,
 *  recortada a <=8 palabras alrededor del target si la oración es más larga.
 *  Salida: un JSON por slug en el directorio dado. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const TAPPABLE = /\p{L}[\p{L}\p{M}'-]*/gu;

function recorta(frase: string, palabra: string): string {
  const toks = frase.split(/\s+/);
  const idx = toks.findIndex((t) => t.toLowerCase().replace(/[^\p{L}\p{M}'-]/gu, "") === palabra);
  if (idx < 0) return frase.split(/\s+/).slice(0, 8).join(" ");
  if (toks.length <= 8) return frase;
  const start = Math.max(0, idx - 3);
  const end = Math.min(toks.length, start + 8);
  return toks.slice(start, end).join(" ");
}

async function main() {
  const [bundle, outdir] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const global = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  const gset = new Set(Object.keys(global!.glosses as Record<string, unknown>));
  const bundleRow = global!;
  for (const slug of bundleRow.slugs) {
    const story = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
    const plain = `${story!.title}. ${story!.text}`.replace(/<[^>]+>/g, " ");
    const sentences = plain.split(/(?<=[.!?”])\s+/).map((s) => s.trim()).filter(Boolean);
    const out: Record<string, string> = {};
    for (const sent of sentences) {
      for (const m of sent.matchAll(TAPPABLE)) {
        const w = m[0].toLowerCase();
        if (!gset.has(w) || out[w]) continue;
        out[w] = recorta(sent, w);
      }
    }
    fs.writeFileSync(path.join(outdir, `${slug}.json`), JSON.stringify(out, null, 1));
    console.log(`${slug}: ${Object.keys(out).length} snippets`);
  }
  await p.$disconnect();
}
main();
