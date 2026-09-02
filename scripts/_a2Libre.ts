/** Comprueba palabras contra la MISMA fuente que usa saveStory.ts: el vocab de
 *  los demas journeys del idioma, partido en mismo tipo (cero) y otro tipo (2). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
(async () => {
  const { filterSpanishWordsAtOrBelow } = await import("@/lib/cefr/spanishLevelJudge");
  const J = "cmtgelq560007j84n3ujx9bpd";
  const mio = await p.journey.findUnique({ where: { id: J }, select: { language: true, typeSlug: true } });
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: J } },
    select: { vocab: true, journey: { select: { typeSlug: true } } } });
  const duro = new Set<string>(), blando = new Set<string>();
  // MISMO prefiltro que saveStory.ts: la capa portable se reabre entre
  // journeys, asi que un verbo o un adjetivo de otro journey no bloquea.
  const PORTABLES = new Set(["verb", "adjective", "adverb", "expression"]);
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) {
    if (!v?.word) continue;
    if (PORTABLES.has(String(v.type ?? "").toLowerCase())) continue;
    (r.journey?.typeSlug === mio!.typeSlug ? duro : blando).add(lema(String(v.word)));
  }
  const propias = await p.journeyStory.findMany({ where: { journeyId: J }, select: { vocab: true } });
  for (const r of propias) for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) duro.add(lema(String(v.word)));
  const ws = process.argv.slice(2);
  const { aboveLevel } = await filterSpanishWordsAtOrBelow(ws, "a2");
  const alto = new Set((aboveLevel as any[]).map((a) => a.word));
  for (const w of ws) {
    const l = lema(w); const t: string[] = [];
    if (duro.has(l)) t.push("YA ENSEÑADA (mismo tipo, cero)");
    if (blando.has(l)) t.push("otro tipo (max 2)");
    if (alto.has(w)) t.push("FUERA DE A2");
    console.log(`${w.padEnd(16)} ${t.length ? t.join(" · ") : "LIBRE"}`);
  }
})().finally(() => p.$disconnect());
