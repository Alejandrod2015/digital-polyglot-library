/** Reescribe las glosas de las plazas nuevas que traian el sentido de
 *  diccionario o el del journey de origen. `cen` cambia SOLO el ingles del
 *  trozo; el espanol no se toca, que es lo que mide gloss-context-real. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const B = "german-friends-a2";
const p = new PrismaClient();
type Cambio = { g?: string; t?: string; cen?: string };
(async () => {
  const d = JSON.parse(fs.readFileSync("scripts/_deA2/rev34fix.json", "utf8")) as
    { global: Record<string, Cambio>; porHistoria: Record<string, Record<string, Cambio>> };
  let n = 0;
  const aplica = (g: Record<string, any>, k: string, c: Cambio, donde: string) => {
    if (!g[k]) { console.error(`${donde}: no existe ${k}`); process.exit(1); }
    if (c.g) g[k].g = c.g;
    if (c.t) g[k].t = c.t;
    if (c.cen) { if (!g[k].c) { console.error(`${donde}/${k}: sin trozo`); process.exit(1); } g[k].c.en = c.cen; }
    n++;
  };
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } });
  const global = fila!.glosses as Record<string, any>;
  for (const [k, c] of Object.entries(d.global)) aplica(global, k, c, "global");
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: global as never } });
  for (const [slug, ws] of Object.entries(d.porHistoria)) {
    const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = f!.glosses as Record<string, any>;
    for (const [k, c] of Object.entries(ws)) aplica(g, k, c, slug);
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
  }
  console.log(`${n} entradas reescritas`);
  await p.$disconnect();
})();
