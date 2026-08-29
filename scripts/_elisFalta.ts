/** Tokens con apostrofo del texto que resuelven a una entrada SIN trozo.
 *  El `_falta.ts` no los ve: mira las entradas de la capa, no los tokens del
 *  texto, y una clave entera como `jusqu'où` puede ganarle a la cola que si
 *  tiene trozo. npx tsx scripts/_elisFalta.ts <bundle> <textos.json> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { TAPPABLE, resolveGloss } from "../src/lib/tapGlossKey";
const p = new PrismaClient();
(async () => {
  const [bundle, fichero] = process.argv.slice(2);
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  const global = filas.find((f) => f.slug === "")!.glosses as Record<string, never>;
  const textos = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;
  let n = 0;
  for (const [slug, texto] of Object.entries(textos)) {
    const capa = (filas.find((f) => f.slug === slug)?.glosses ?? {}) as Record<string, never>;
    const mapa = { ...global, ...capa };
    const vistos = new Set<string>();
    for (const tok of texto.replace(/<[^>]+>/g, " ").match(TAPPABLE) ?? []) {
      if (!/['’]/.test(tok)) continue;
      const h = resolveGloss<{ c?: unknown }>(mapa, tok);
      if (!h || h.gloss.c) continue;
      const k = `${slug}|${h.token}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      console.log(`${slug} · ${tok} -> ${h.token}`);
      n++;
    }
  }
  console.log(`${n} tokens con apostrofo sin trozo`);
  await p.$disconnect();
})();
