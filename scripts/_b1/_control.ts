/** Control: cuantas claves del journey lleva CADA cuerpo, en un journey que
 *  ya cumple la escalera sin re-ensenar nada. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
(async () => {
  const id = process.argv[2];
  const rows = await p.journeyStory.findMany({ where: { journeyId: id }, select: { slug: true, text: true, vocab: true } });
  const con = rows.filter((r) => String(r.text ?? "").trim());
  const claves = new Set<string>();
  for (const r of con) for (const v of ((r.vocab as Array<{word:string;surface?:string}> ?? [])))
    claves.add(String(v.surface ?? v.word).toLowerCase());
  console.log(`${con.length} cuerpos · ${claves.size} claves distintas`);
  let tot = 0;
  for (const r of con) {
    const c = new Set(tok(String(r.text ?? "")));
    const n = [...claves].filter((k) => c.has(k)).length;
    tot += n;
    const w = String(r.text).trim().split(/\s+/).length;
    console.log(`  ${String(n).padStart(3)} claves de ${claves.size} · ${w}w · ${(new Set(tok(String(r.text)))).size} tokens distintos · ${r.slug}`);
  }
  console.log(`media de claves por cuerpo: ${(tot / con.length).toFixed(1)}`);
})().finally(() => p.$disconnect());
