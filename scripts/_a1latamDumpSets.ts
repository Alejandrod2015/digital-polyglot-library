/** Vuelca los sets de practica del A1 latam de la BASE a `scripts/_sets/<slug>.json`,
 *  que es de donde lee `_genPracticeClips.ts`.
 *
 *  Hace falta porque estos sets se sembraron directos a la base y nunca dejaron
 *  su JSON, y sin el fichero el generador de clips muere con ENOENT. Es el paso
 *  1 del pipeline de [[project_practice_db_native_sets_pipeline]]. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const DIR = path.resolve(__dirname, "_sets");
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { id: true, slug: true, practiceSet: { select: { exercises: true } } } });
  let total = 0;
  for (const s of st) {
    const ex = (s.practiceSet?.exercises ?? []).sort((a, b) => a.order - b.order);
    if (!ex.length) { console.error(`${s.slug}: sin ejercicios`); continue; }
    const fuera = ex.map((e) => ({
      type: e.type, word: e.word, sentence: e.sentence ?? "",
      payload: e.payload, ...(e.featured ? { featured: true } : {}),
    }));
    fs.writeFileSync(path.join(DIR, `${s.slug}.json`), JSON.stringify(fuera, null, 2), "utf8");
    total += ex.length;
    console.log(`${s.slug}: ${ex.length}`);
  }
  console.log(`\n${total} ejercicios volcados a scripts/_sets/`);
  await p.$disconnect();
})();
