/** MEDICION 2026-09-24: gate de conjunto sobre TODOS los journeys en draft.
 *  Orden de temas = Journey.topics (nunca alfabetico). No escribe nada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories, type JourneyStoryInput } from "../src/lib/validateJourneyStories";
const p = new PrismaClient();

async function main() {
  const js = await p.journey.findMany({ where: { status: "draft" },
    select: { id: true, name: true, language: true, variant: true, levels: true, typeSlug: true, topics: true, city: true,
      stories: { select: { slug: true, title: true, text: true, topic: true, slotIndex: true, level: true, vocab: true } } } });
  const realPeople = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

  const out: any[] = [];
  for (const j of js) {
    const orden = (t: string | null) => { const i = j.topics.indexOf(t ?? ""); return i < 0 ? 99 : i; };
    const filas = j.stories.filter((s) => (s.text ?? "").length > 200)
      .sort((a, b) => (orden(a.topic) - orden(b.topic)) || (a.slotIndex - b.slotIndex));
    const nivel = j.levels[0] ?? "";
    const stories: JourneyStoryInput[] = filas.map((f) => ({
      slug: f.slug ?? `${f.topic}#${f.slotIndex}`, title: f.title ?? "", text: f.text!,
      vocab: f.vocab as never, language: j.language, level: f.level ?? nivel, topic: f.topic }));
    const meta = { id: j.id, lang: j.language, variant: j.variant, level: nivel, tipo: j.typeSlug,
      city: j.city, n: stories.length, plazas: j.topics.length * 3 };
    if (!stories.length) { out.push({ ...meta, checks: [], nota: "sin texto" }); continue; }
    let checks: any[] = [];
    try {
      checks = validateJourneyStories(stories, { language: j.language, level: nivel, realPeople,
        journeyId: j.id, journeyType: j.typeSlug, conjuntoCompleto: stories.length >= j.topics.length * 3,
        plazasTotales: j.topics.length * 3 } as any);
    } catch (e: any) { out.push({ ...meta, error: String(e?.message ?? e).slice(0, 300) }); continue; }
    out.push({ ...meta, checks: checks.map((c) => ({ id: c.id, status: c.status, detail: (c.detail ?? "").slice(0, 400), magnitud: c.magnitud })) });
  }
  fs.writeFileSync("/tmp/med-conjunto.json", JSON.stringify(out, null, 1));
  for (const o of out) {
    const f = (o.checks ?? []).filter((c: any) => c.status === "fail");
    const pend = (o.checks ?? []).filter((c: any) => c.status === "pending-set");
    const ni = (o.checks ?? []).filter((c: any) => c.status === "not-implemented");
    console.log(`\n== ${o.lang}/${o.variant} ${o.level} ${o.tipo} (${o.id}) n=${o.n}/${o.plazas} ${o.error ? "ERROR " + o.error : ""}`);
    console.log(`   fail=${f.length} pending-set=${pend.length} not-impl=${ni.length} total=${(o.checks ?? []).length}`);
    for (const c of f) console.log(`   FAIL [${c.id}] ${c.detail}`);
    if (pend.length) console.log(`   pend: ${pend.map((c: any) => c.id).join(", ")}`);
    if (ni.length) console.log(`   n/i : ${ni.map((c: any) => c.id).join(", ")}`);
  }
}
main().finally(() => p.$disconnect());
