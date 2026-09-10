/** Borra las 13 huérfanas de verdad del B1 portugués, en los tres sitios:
 *  la fila de su historia, la fila global del bundle (solo si ya no la usa
 *  ninguna historia) y `scripts/_newGlosses.json`, que es la fuente. Quitarla
 *  de la base y dejarla en la fuente la resucita en la próxima reconstrucción.
 *
 *  La lista viene de `glossContextChunks.ts huerfanas` YA arreglado: el de
 *  antes se llevaba por delante expresiones vivas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const B = "portuguese-traveler-brazil-b1";
const FUENTE = "scripts/_newGlosses.json";
const MUERTAS: Array<[string, string[]]> = [
  ["a-caucao-volta-dia-trinta", ["corta"]],
  ["garoa-no-corredor", ["então"]],
  ["galeto-antes-do-preco", ["começa"]],
  ["dinheiro-na-mao-errada", ["faz", "some", "cidade"]],
  ["a-cota-do-dia", ["não", "frase", "lugar", "estava", "folheto"]],
  ["senha-b-quarenta-e-dois", ["teclea"]],
  ["deferido-no-diario", ["trâmite"]],
];

const p = new PrismaClient();

(async () => {
  for (const [slug, palabras] of MUERTAS) {
    const f = await p.tapGlossSet.findFirst({ where: { bundle: B, slug }, select: { glosses: true } });
    if (!f) { console.log(`sin fila: ${slug}`); continue; }
    const g = f.glosses as Record<string, unknown>;
    for (const w of palabras) delete g[w];
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
    console.log(`${slug}: -${palabras.length}`);
  }

  // La fila global es la union de lo que usan las historias. Solo se cae de
  // ahi la palabra que ya no usa NINGUNA: "trâmite" muere en deferido pero
  // sigue viva en senha-b, y "não" sigue en dieciocho historias.
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const enUso = new Set<string>();
  for (const f of filas) if (f.slug) for (const w of Object.keys(f.glosses as object)) enUso.add(w);
  const global = filas.find((f) => !f.slug);
  const gg = (global?.glosses ?? {}) as Record<string, unknown>;
  const candidatas = [...new Set(MUERTAS.flatMap(([, ws]) => ws))].filter((w) => !enUso.has(w) && gg[w]);
  for (const w of candidatas) delete gg[w];
  if (candidatas.length) {
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: gg as never } });
  }
  console.log(`fila global: -${candidatas.length} (${candidatas.join(", ") || "ninguna"})`);

  const fuente = JSON.parse(fs.readFileSync(FUENTE, "utf8")) as Record<string, Record<string, unknown>>;
  let nF = 0;
  for (const w of candidatas) if (fuente[B]?.[w]) { delete fuente[B][w]; nF++; }
  fs.writeFileSync(FUENTE, `${JSON.stringify(fuente, null, 2)}\n`);
  console.log(`${FUENTE}: -${nF}`);
  await p.$disconnect();
})();
