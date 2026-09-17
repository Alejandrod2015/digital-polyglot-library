/**
 * Escribe la capa de CONTEXTO de una historia del A2 PT.
 *
 *   npx tsx scripts/_pta2PonContexto.ts <slug> <trozos.json>
 *
 * `trozos.json` es { "<trozo en portugues>": "<el mismo trozo en ingles>" },
 * el fichero que saca `_pta2Trozos.ts <slug> --json` con los huecos por
 * rellenar. Cada palabra tocable que cae en un trozo recibe `c: {es, en}` con
 * ESE trozo; la primera aparicion manda, que es la que el lector toca.
 *
 * La fila de la historia PISA la global, asi que se parte de la global (g y t
 * intactos) y encima va el trozo. Lo que no se nombra se queda como estaba.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { trozosDe } from "./_pta2Trozos";

const B = "portuguese-traveler-brazil-a2";
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const p = new PrismaClient();

(async () => {
  const [slug, fichero] = process.argv.slice(2);
  if (!slug || !fichero) throw new Error("uso: _pta2PonContexto.ts <slug> <trozos.json>");
  const EN = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;

  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const global = (filas.find((f) => !f.slug)?.glosses ?? {}) as Record<string, { g?: string; t?: string }>;
  const previa = (filas.find((f) => f.slug === slug)?.glosses ?? {}) as Record<string, Record<string, unknown>>;

  const h = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
  if (!h) throw new Error(`no encuentro la historia ${slug}`);

  const salida: Record<string, Record<string, unknown>> = { ...previa };
  const vistas = new Set<string>();
  const sinTraducir: string[] = [];
  let escritas = 0;

  for (const t of trozosDe(`${h.title}. ${h.text}`)) {
    const en = EN[t];
    const dentro = [...new Set((t.toLowerCase().match(TOCABLE) ?? []))]
      .filter((w) => global[w] && !vistas.has(w));
    if (!dentro.length) continue;
    if (!en) { sinTraducir.push(t); continue; }
    for (const w of dentro) {
      vistas.add(w);
      salida[w] = { ...(global[w] ?? {}), ...(previa[w] ?? {}), c: { es: t, en } };
      escritas++;
    }
  }

  if (sinTraducir.length) {
    console.error(`FALTAN ${sinTraducir.length} trozo(s) sin traducir; no se escribe nada:`);
    for (const t of sinTraducir) console.error(`   ${t}`);
    process.exit(1);
  }

  await p.tapGlossSet.upsert({
    where: { bundle_slug: { bundle: B, slug } },
    update: { glosses: salida as never },
    create: { bundle: B, slug, language: "portuguese", variant: "brazil", slugs: [], glosses: salida as never },
  });
  console.log(`${slug}: ${escritas} palabras con su trozo`);
  await p.$disconnect();
})();
