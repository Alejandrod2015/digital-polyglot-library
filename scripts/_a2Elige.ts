/** Dado el TEXTO de una historia, devuelve las palabras que ya estan en el
 *  cuerpo Y estan libres segun el gate. Se elige de ahi, en vez de inventar
 *  plazas y descubrir despues que estaban gastadas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module"; import * as fs from "fs";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
(async () => {
  const [fichero, idx] = process.argv.slice(2);
  const { SPANISH_A1_A2_LEMMAS } = await import("@/lib/cefr/spanishA1A2");
  const { filterSpanishWordsAtOrBelow } = await import("@/lib/cefr/spanishLevelJudge");
  const J = "cmtgelq560007j84n3ujx9bpd";
  const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } }, journeyId: { not: J } },
    select: { vocab: true, journey: { select: { typeSlug: true, levels: true } } } });
  const duro = new Set<string>(), blando = new Set<string>();
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) {
    if (!v?.word) continue;
    const portable = PORT.has(String(v.type ?? "").toLowerCase());
    const mismoTipo = r.journey?.typeSlug === "traveler";
    const mismoNivel = (r.journey?.levels ?? []).some((l:any)=>String(l).toLowerCase()==="a2");
    if (portable && mismoTipo) continue;
    if (!portable && mismoTipo && !mismoNivel) continue;
    (mismoTipo ? duro : blando).add(lema(String(v.word)));
  }
  for (const r of await p.journeyStory.findMany({ where: { journeyId: J }, select: { vocab: true } }))
    for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) duro.add(lema(String(v.word)));
  const curada = new Set([...SPANISH_A1_A2_LEMMAS].map((w) => lema(String(w))));
  const d = JSON.parse(fs.readFileSync(fichero, "utf8"));
  const st = d[Number(idx) || 0];
  const formas = [...new Set((st.text.match(/\p{L}+/gu) ?? []) as string[])].filter((w) => w.length > 3);
  const cand = formas.filter((w) => curada.has(lema(w)) && !duro.has(lema(w)));
  const { aboveLevel } = await filterSpanishWordsAtOrBelow(cand, "a2");
  const alto = new Set((aboveLevel as any[]).map((a) => a.word));
  const ok = cand.filter((w) => !alto.has(w));
  console.log(`${st.title}: ${ok.length} palabras del cuerpo libres y en nivel`);
  console.log(ok.join(", "));
  console.log(`\nblandas (max 2): ${ok.filter((w) => blando.has(lema(w))).join(", ") || "ninguna"}`);
})().finally(() => p.$disconnect());
