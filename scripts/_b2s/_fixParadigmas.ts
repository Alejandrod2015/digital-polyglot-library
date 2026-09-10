/** Correcciones de la lectura de paradigmas del piloto (fila de la historia; la global no se toca). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const P = ["yo", "tú", "él, ella", "nosotros", "vosotros", "ellos"];
const tabla = (xs: string[]) => P.map((per, i) => [per, xs[i]]);
type Fix = { g?: string; t?: string; f?: unknown; sinF?: boolean };
const FIX: Record<string, Record<string, Fix>> = {
  "el-cafe-lo-pones-tu": {
    lleva: { g: "has been, for a length of time (llevar)" },
    pensaba: { g: "thought, expected (pensar)" },
  },
  "la-bolsa-como-prueba": {
    guarden: { f: tabla(["guarde", "guardes", "guarde", "guardemos", "guardéis", "guarden"]) },
    eligieran: { f: tabla(["eligiera", "eligieras", "eligiera", "eligiéramos", "eligierais", "eligieran"]) },
    conocían: { g: "knew, had known (conocer)" },
    compra: { g: "shopping, groceries", t: "noun", sinF: true },
  },
  "la-sobremesa-se-estira": {
    costara: { f: tabla(["costara", "costaras", "costara", "costáramos", "costarais", "costaran"]) },
    quedara: { f: tabla(["me quedara", "te quedaras", "se quedara", "nos quedáramos", "os quedarais", "se quedaran"]) },
    tendría: { f: tabla(["tendría", "tendrías", "tendría", "tendríamos", "tendríais", "tendrían"]) },
    subió: { g: "rose, came up (subir)" },
    seguía: { g: "was still, carried on (seguir)" },
    acercó: { g: "pulled closer, moved nearer (acercar)" },
  },
};
(async () => {
  const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, any>;
  for (const [slug, fx] of Object.entries(FIX)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    for (const [k, f] of Object.entries(fx)) {
      const e = { ...(glob[k] ?? {}), ...(g[k] ?? {}) };
      if (f.g) e.g = f.g;
      if (f.t) e.t = f.t;
      if (f.f) e.f = f.f;
      if (f.sinF) delete e.f;
      if (!e.c) throw new Error(`${slug}/${k}: sin trozo de contexto, no lo toco`);
      g[k] = e;
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
    console.log(`${slug}: ${Object.keys(fx).join(", ")}`);
  }
  await p.$disconnect();
})();
