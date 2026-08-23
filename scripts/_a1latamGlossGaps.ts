/** Vuelca TODAS las formas del A1 latam que aun no tienen glosa en ningun
 *  bundle de espanol, con la frase donde salen, para poder escribirlas
 *  mirando el contexto y no el diccionario. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const DIR = path.resolve(__dirname, "../src/data/tapGlosses");
const FAM = ["spanish-friends","spanish-friends-argentina","spanish-friends-colombia","spanish-friends-mexico",
  "spanish-friends-spain-a0","spanish-traveler-latam","spanish-traveler-mexico-a0","talking-points-es"];
(async () => {
  const ya = new Set<string>();
  for (const f of FAM) {
    const b = JSON.parse(fs.readFileSync(path.join(DIR, `${f}.json`), "utf8"));
    for (const k of Object.keys(b.glosses)) ya.add(k.toLowerCase());
  }
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 }, select: { title: true, text: true } });
  const falta = new Map<string, string>();
  for (const s of st) {
    for (const fuente of [s.title ?? "", (s.text ?? "").replace(/\n+/g, " ")]) {
      for (const frase of fuente.split(/(?<=[.!?”])\s+/)) {
        for (const m of frase.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) {
          const k = m[0].toLowerCase();
          if (ya.has(k) || falta.has(k)) continue;
          falta.set(k, frase.trim().slice(0, 90));
        }
      }
    }
  }
  console.log(`${falta.size} formas sin glosa\n`);
  for (const [k, frase] of [...falta].sort()) console.log(`${k}\t${frase}`);
  await p.$disconnect();
})();
