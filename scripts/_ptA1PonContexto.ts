/** Escribe el contexto que faltaba en "a-areia-queima-os-pes" (PT-BR A1):
 *  meio-dia y guarda-sol vivian solo en la fila global, sin `c` propio. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const B = "portuguese-traveler-brazil-a1";
const SLUG = "a-areia-queima-os-pes";

const CTX: Record<string, { es: string; en: string }> = {
  "meio-dia": { es: "sol de meio-dia", en: "midday sun" },
  "guarda-sol": { es: "guarda-sol de um casal", en: "a couple's beach umbrella" },
};

(async () => {
  const glob = (await p.tapGlossSet.findUniqueOrThrow({
    where: { bundle_slug: { bundle: B, slug: "" } },
    select: { glosses: true },
  })).glosses as any;
  const row = await p.tapGlossSet.findUniqueOrThrow({
    where: { bundle_slug: { bundle: B, slug: SLUG } },
    select: { glosses: true },
  });
  const g: any = { ...(row.glosses as any ?? {}) };
  for (const [k, c] of Object.entries(CTX)) {
    if (!glob[k]) throw new Error(`${k} no esta en la fila global de ${B}`);
    g[k] = { ...(g[k] ?? { g: glob[k].g, t: glob[k].t }), c };
  }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: SLUG } }, data: { glosses: g } });
  console.log(`contexto escrito: ${Object.keys(CTX).join(", ")}`);
})().finally(() => p.$disconnect());
