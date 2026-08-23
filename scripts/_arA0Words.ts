/** Analiza los 21 cuerpos: por token, en cuantas historias aparece y si esta
 *  libre segun los buckets de vocab del espanol. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const MI_TIPO = "relationships";
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const STOP = new Set("el la los las un una unos unas de del a al y o que en con por para se su sus mi tu lo le les me te nos ni es son esta estan como mas pero si no ya lo".split(" "));

async function main() {
  const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{topic:string;slotIndex:number;text:string}>;
  const rows = await p.journeyStory.findMany({
    // El propio journey queda FUERA del cubo: desde que se guardaron las 21,
    // cada palabra que ensena volvia como DURO y el pool caia a 198.
    where: { journey: { language: "spanish", status: { not: "archived" } },
             journeyId: { not: "cmt5vx8du000732fjgkwi59ks" } },
    select: { vocab: true, journey: { select: { typeSlug: true } } },
  });
  const duro = new Set<string>(); const blando = new Set<string>();
  for (const r of rows) for (const v of ((r.vocab as Array<{word?:unknown}>|null) ?? [])) {
    if (!v?.word) continue;
    (r.journey?.typeSlug === MI_TIPO ? duro : blando).add(lema(String(v.word)));
  }
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const perStory = stories.map((s) => new Set(tok(s.text)));
  const freq = new Map<string, number>();
  for (const set of perStory) for (const w of set) freq.set(w, (freq.get(w) ?? 0) + 1);
  const estado = (w: string) => duro.has(lema(w)) ? "DURO" : blando.has(lema(w)) ? "blando" : "libre";
  const out: Record<string, unknown> = {};
  stories.forEach((s, i) => {
    const list = [...perStory[i]]
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => ({ w, n: freq.get(w)!, e: estado(w) }))
      .sort((a, b) => b.n - a.n || a.w.localeCompare(b.w));
    out[`${s.topic}#${s.slotIndex}`] = list;
  });
  fs.writeFileSync("/tmp/ar_words.json", JSON.stringify(out, null, 1));
  const libres = [...freq].filter(([w]) => estado(w) === "libre" && w.length > 2 && !STOP.has(w));
  console.log(`tokens distintos: ${freq.size} · libres: ${libres.length}`);
  const porN = new Map<number, number>();
  for (const [, n] of libres) porN.set(n, (porN.get(n) ?? 0) + 1);
  console.log("libres por nº de historias en que aparecen:");
  [...porN].sort((a,b)=>b[0]-a[0]).forEach(([n,c]) => console.log(`  ${String(n).padStart(2)} historias: ${c} palabras`));
  console.log("\nlibres mas repartidos:", libres.filter(([,n])=>n>=5).sort((a,b)=>b[1]-a[1]).map(([w,n])=>`${w}(${n})`).join(" "));
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
