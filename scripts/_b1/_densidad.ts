/**
 * La densidad que pide la escalera: claves por palabra de cuerpo.
 * Compara el journey control (que la cumple) con este B1, y mira de que NIVEL
 * son las claves de cada uno. Solo lectura.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
function mide(nombre: string, cuerpos: string[], vocabs: Array<Array<{word:string;surface?:string|null}>>) {
  const claves = new Set<string>();
  const lemas: string[] = [];
  for (const v of vocabs) for (const x of v) { claves.add(String(x.surface ?? x.word).toLowerCase()); lemas.push(String(x.word)); }
  let pares = 0, palabras = 0;
  for (const t of cuerpos) {
    const c = new Set(tok(t));
    pares += [...claves].filter((k) => c.has(k)).length;
    palabras += t.trim().split(/\s+/).length;
  }
  const a1a2 = lemas.filter((w) => isSpanishUpToLevel(w, "a2")).length;
  console.log(`${nombre}`);
  console.log(`  ${cuerpos.length} cuerpos · ${palabras} palabras · ${claves.size} claves · ${pares} pares (clave,cuerpo)`);
  console.log(`  ${(pares / cuerpos.length).toFixed(1)} claves por cuerpo · ${(pares / palabras).toFixed(3)} claves por palabra`);
  console.log(`  ${Math.round(100 * a1a2 / lemas.length)}% de las plazas son vocabulario A1-A2\n`);
}
(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmt5vx8du000732fjgkwi59ks" }, select: { text: true, vocab: true } });
  const con = rows.filter((r) => String(r.text ?? "").trim());
  mide("CONTROL Friends ES/argentina A0 (escalera 3,01)",
    con.map((r) => String(r.text)), con.map((r) => (r.vocab as never) ?? []));
  const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
  mide("Traveler ES/spain B1 (escalera 1,16)", S.map((s: any) => s.text), S.map((s: any) => s.vocab));
  console.log("Para media 2,5 con 21 plazas por historia hacen falta 52,5 claves por cuerpo.");
  console.log("Con el tope de 170 palabras eso son 0,31 claves por palabra.");
})().finally(() => p.$disconnect());
