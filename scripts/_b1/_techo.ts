/**
 * ?Cuanto puede subir la escalera de este journey, como MUCHO?
 *
 * El limite no es la prosa: es que la regla de cero solape deja fuera del pool
 * casi todo el tejido conectivo del espanol. Esto mide dos cosas:
 *
 *   1. de los tokens de contenido de MIS 21 cuerpos, cuantos podrian ser clave
 *      (estan en el pool) y cuantos estan prohibidos por otro journey;
 *   2. cuantas de las claves del journey CONTROL (Friends ES/argentina A0, que
 *      da 3,01 sin re-ensenar) estarian hoy prohibidas para mi.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const pool = new Set(fs.readFileSync("scripts/_b1/pool-limpio.txt", "utf8").split(/\r?\n/).filter(Boolean));
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const poolLema = new Set([...pool].map(lema));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}{3,}/gu) ?? []);
const VACIAS = new Set("que con los las del una unos unas por para pero como cuando donde este esta esto esos esas aquel sin sus nos les muy mas menos todo toda todos todas nada nadie algo alguien desde hasta entre sobre bajo tras ante segun ella ellos ellas usted eres somos son era eran fue fueron ser estar esta estan estaba estaban hay habia han has hemos ese esa aqui alli ahora luego tambien tampoco porque aunque".split(" ").map(lema));
(async () => {
  const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
  let dentro = 0, fuera = 0;
  for (const s of S) {
    for (const w of new Set(tok(s.text))) {
      const l = lema(w);
      if (VACIAS.has(l)) continue;
      if (poolLema.has(l)) dentro++; else fuera++;
    }
  }
  console.log(`MIS 21 CUERPOS: ${dentro} tokens distintos podrian ser clave, ${fuera} estan fuera del pool`);
  console.log(`  techo teorico: ${(dentro / S.length).toFixed(1)} claves por cuerpo si enseñara TODO lo poolable`);
  console.log(`  la escalera pide 52,5 claves por cuerpo para la media 2,5\n`);

  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmt5vx8du000732fjgkwi59ks" },
    select: { vocab: true },
  });
  const claves = new Set<string>();
  for (const r of rows) for (const v of ((r.vocab as Array<{word?:string}> ?? []))) if (v?.word) claves.add(String(v.word));
  const prohibidas = [...claves].filter((k) => !poolLema.has(lema(k)));
  console.log(`CONTROL (Friends ES/argentina A0, 3,01 sin re-enseñar): ${claves.size} claves`);
  console.log(`  ${prohibidas.length} de ellas (${Math.round(100 * prohibidas.length / claves.size)}%) estarian HOY prohibidas para este B1`);
  console.log(`  muestra: ${prohibidas.slice(0, 25).join(", ")}`);
})().finally(() => p.$disconnect());
