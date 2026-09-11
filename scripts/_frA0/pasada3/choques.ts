// SOLO LECTURA. Plazas nuevas de la palanca 2 contra todo el vocab frances de
// otros journeys (palabra y superficie) y contra la lista A1-A2.
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { FRENCH_A1_A2_LEMMAS } from "@/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const ESTE = "cmtwo6cys0007j8yzg6ni3fsc";
const strip = (w: string) => w.toLowerCase().replace(/’/g, "'").replace(/^(le |la |les |l'|se |s')/, "").trim();
const C = ["ici","très","bien","quoi","où","alors","aussi","après","quand","encore","tout","loin","doucement"];
(async () => {
  const other: any[] = await p.journeyStory.findMany({ where: { journey: { language: "french" }, journeyId: { not: ESTE } }, select: { vocab: true, journey: { select: { status: true, typeSlug: true } } } as any });
  const m = new Map<string, string[]>();
  for (const s of other) for (const v of (s.vocab ?? []) as any[]) for (const k of new Set([strip(String(v.word)), strip(String(v.surface ?? v.word))])) {
    const e = `${s.journey.typeSlug}/${s.journey.status}/${v.type}${v.anchor ? "/ancla" : ""} (${v.word})`;
    m.set(k, [...new Set([...(m.get(k) ?? []), e])]);
  }
  for (const c of C) console.log(c.padEnd(12), FRENCH_A1_A2_LEMMAS.has(strip(c)) ? "lista" : "FUERA", (m.get(strip(c)) ?? []).join("; "));
  await p.$disconnect();
})();
