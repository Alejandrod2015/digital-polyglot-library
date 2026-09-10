/** Corrige FILAS (y dos celdas de tendria) dentro de los bloques de modo; el bloque se conserva, asi
 *  que buildGlossMoods sin --force no lo rehace. Ver la tarea del generador (clitico de objeto). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const P = ["yo", "tú", "él, ella", "nosotros", "vosotros", "ellos"];
const filas = (xs: string[]) => P.map((per, i) => [per, xs[i]]);
const FIX: Record<string, Record<string, (f: any) => void>> = {
  "la-bolsa-como-prueba": {
    guarden: (f) => { f.rows = filas(["guarde", "guardes", "guarde", "guardemos", "guardéis", "guarden"]); f.lemma = "guardar"; },
    eligieran: (f) => { f.rows = filas(["eligiera", "eligieras", "eligiera", "eligiéramos", "eligierais", "eligieran"]); },
  },
  "la-sobremesa-se-estira": {
    costara: (f) => { f.rows = filas(["costara", "costaras", "costara", "costáramos", "costarais", "costaran"]); },
    quedara: (f) => { f.rows[4] = ["vosotros", "os quedarais"]; },
    tendría: (f) => { f.head = [["present", "me tengo"], ["conditional", "me tendría"]]; f.here = 0; f.rows = filas(["tendría", "tendrías", "tendría", "tendríamos", "tendríais", "tendrían"]); },
  },
};
(async () => {
  for (const [slug, fx] of Object.entries(FIX)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    for (const [k, fn] of Object.entries(fx)) {
      if (!g[k]?.f?.mood) throw new Error(`${slug}/${k}: no es un bloque de modo, no lo toco`);
      const f = JSON.parse(JSON.stringify(g[k].f)); fn(f); g[k] = { ...g[k], f };
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
    console.log(`${slug}: ${Object.keys(fx).join(", ")}`);
  }
  await p.$disconnect();
})();
