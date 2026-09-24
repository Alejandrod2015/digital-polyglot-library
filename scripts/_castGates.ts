import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories } from "../src/lib/validateJourneyStories";
const p = new PrismaClient();
const CAST = ["journey-cast-protagonist-in-all", "journey-cast-fixed-max-two",
  "journey-cast-one-new-per-topic", "journey-cast-first-story-only-fixed", "journey-closing-alone"];

async function main() {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } },
    orderBy: [{ language: "asc" }, { levels: "asc" }],
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true, typeSlug: true,
      stories: { orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
        select: { slug: true, title: true, text: true, topic: true, level: true, vocab: true, audioUrl: true, coverUrl: true } } } });
  const out: any[] = [];
  for (const j of js) {
    const stories = j.stories.filter((s) => (s.text ?? "").length > 200).map((s) => ({
      slug: s.slug ?? "", title: s.title ?? "", text: s.text ?? "", language: j.language,
      level: s.level ?? j.levels[0] ?? "", topic: s.topic, vocab: (s.vocab as any) ?? null }));
    if (stories.length < 3) continue;
    let checks: any[] = [];
    try {
      checks = validateJourneyStories(stories as any, { language: j.language, level: j.levels[0] ?? "",
        journeyId: j.id, journeyType: j.typeSlug, conjuntoCompleto: stories.length >= 21, plazasTotales: 21 } as any);
    } catch (e: any) { out.push({ id: j.id, j: j.name, error: String(e).slice(0, 200) }); continue; }
    const rel = checks.filter((c) => CAST.includes(c.id));
    const fallan = rel.filter((c) => c.status === "fail").map((c) => ({ id: c.id, detalle: (c.detail ?? "").slice(0, 240) }));
    const pend = rel.filter((c) => c.status !== "fail" && c.status !== "pass").map((c) => `${c.id}:${c.status}`);
    out.push({ id: j.id, status: j.status, lang: j.language, variant: j.variant, level: j.levels.join("/"),
      tipo: j.name, n: stories.length,
      conAudio: j.stories.filter((s) => s.audioUrl).length, conPortada: j.stories.filter((s) => s.coverUrl).length,
      fallan, pend });
  }
  console.log(JSON.stringify(out, null, 1));
}
main().finally(() => p.$disconnect());
