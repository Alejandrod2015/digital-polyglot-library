/** Esqueleto de la capa de contexto: por cada palabra glosada de una historia,
 *  la frase donde sale por primera vez. Se rellena a mano el trozo y su ingles. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module"; import * as fs from "fs";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [bundle, slug, out] = process.argv.slice(2);
  const glob = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } }, select: { glosses: true } });
  const g = (glob!.glosses ?? {}) as Record<string, { g: string; t?: string }>;
  const st = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
  const texto = `${st!.title}. ${st!.text}`;
  const frases = texto.split(/(?<=[.?!”])\s+/).map((f) => f.trim()).filter(Boolean);
  const visto = new Map<string, string>();
  for (const f of frases)
    for (const m of f.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) {
      const k = m[0].toLowerCase();
      if (g[k] && !visto.has(k)) visto.set(k, f);
    }
  const skel: Record<string, any> = {};
  for (const [k, f] of visto) skel[k] = { global: g[k].g, tipo: g[k].t ?? "", frase: f, es: "", en: "" };
  fs.writeFileSync(out, JSON.stringify(skel, null, 1));
  console.log(`${slug}: ${visto.size} palabras glosadas · ${frases.length} frases -> ${out}`);
})().finally(() => p.$disconnect());
