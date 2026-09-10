/** Mide un borrador de tema acortado SIN guardar: palabras (como el validador),
 *  habla citada, parrafos, plazas de vocab presentes, y el checker de journey
 *  sobre las 21 (las de la base con el tema sustituido), comparado con la base.
 *    npx tsx scripts/_b2/_mideCorto.ts scripts/_b2/t1corto.json */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";

const J = "cmtpls1l20007j8epwgcs6e1h";
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const quotedPct = (t: string) => {
  let inside = 0;
  for (const m of t.matchAll(/“([^”]*)”/g)) inside += words(m[1]);
  return (inside / words(t)) * 100;
};
const p = new PrismaClient();
(async () => {
  const borr = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true, typeSlug: true } });
  const orden = ((j?.topics ?? []) as any[]).map((t) => (typeof t === "string" ? t : t.slug ?? t.id));
  const db = await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, title: true, text: true, topic: true, slotIndex: true, vocab: true } });
  db.sort((a, b) => orden.indexOf(a.topic) - orden.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  const porSlug = new Map(borr.map((s) => [s.slug, s]));
  for (const s of borr) {
    const orig = db.find((d) => d.slug === s.slug)!;
    const faltan = ((s.vocab ?? []) as any[]).filter((v) => !s.text.toLowerCase().includes(String(v.surface ?? v.word).toLowerCase()));
    const pars = s.text.split(/\n{2,}/).length;
    console.log(`${s.slug}: ${words(orig.text)} -> ${words(s.text)} palabras · citada ${quotedPct(orig.text).toFixed(1)} -> ${quotedPct(s.text).toFixed(1)}% · ${pars} parrafos · titulo ${s.title === orig.title ? "igual" : "CAMBIADO"} · plazas sin superficie: ${faltan.map((v) => v.word).join(", ") || "ninguna"}`);
  }
  const mk = (arr: any[]) => arr.map((s) => ({ slug: s.slug, title: s.title, text: s.text, language: "ES", level: "b2", vocab: s.vocab as any, topic: s.topic }));
  const ctx = { language: "ES", level: "b2", conjuntoCompleto: true, journeyId: J, journeyType: j?.typeSlug ?? "traveler" };
  const antes = validateJourneyStories(mk(db), ctx);
  const despues = validateJourneyStories(mk(db.map((d) => porSlug.get(d.slug) ?? d)), ctx);
  for (const c of despues) {
    const a = antes.find((x) => x.id === c.id);
    const cambio = !a || a.status !== c.status || a.detail !== c.detail;
    if (c.status === "fail" || cambio)
      console.log(`[${a?.status ?? "-"} -> ${c.status}] ${c.id}${c.magnitud ? ` (${a?.magnitud?.valor} -> ${c.magnitud.valor}, mejor ${c.magnitud.mejor})` : ""}\n    ${(c.detail ?? "").slice(0, 400)}`);
  }
  await p.$disconnect();
})();
