/** Alinea la fila GLOBAL del bundle con lo que ya se leyo por historia: la
 *  global no tiene frase donde caer, asi que su sentido tiene que ser el que
 *  quedo tras leer las ocurrencias reales. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient(); const B = "spanish-traveler-latam-a2";
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const porHistoria = new Map<string, { g: string; t?: string }>();
  for (const r of rows) {
    if (!r.slug) continue;
    for (const [k, v] of Object.entries<any>(r.glosses ?? {})) {
      if (v?.rev === true) porHistoria.set(k.toLowerCase(), { g: v.g, t: v.t });
    }
  }
  const glob = rows.find((r) => !r.slug)!;
  const g: any = { ...(glob.glosses as any ?? {}) };
  let alineadas = 0, huerfanas = 0;
  for (const [k, v] of Object.entries<any>(g)) {
    if (v?.rev !== false) continue;
    const real = porHistoria.get(k.toLowerCase());
    if (real) { g[k] = { ...v, g: real.g, ...(real.t ? { t: real.t } : {}), rev: true }; alineadas++; }
    else { g[k] = { ...v, rev: true }; huerfanas++; }  // la palabra ya no sale en ninguna historia
  }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: g } });
  console.log(`global: ${alineadas} alineadas con su uso real · ${huerfanas} sin ocurrencia viva`);
})().finally(() => p.$disconnect());
