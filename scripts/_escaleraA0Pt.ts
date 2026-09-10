// Solo lectura: la escalera de recirculacion del Traveler PT-BR A0 nuevo medida como la mide el gate, sobre todas las historias escritas.
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories } from "../src/lib/validateJourneyStories";
const p = new PrismaClient();
async function main() {
  const j = await p.journey.findUniqueOrThrow({ where: { id: "cmtvpqsfv000832hgemzk20cl" }, select: { topics: true } });
  const rows = (await p.journeyStory.findMany({ where: { journeyId: "cmtvpqsfv000832hgemzk20cl" }, select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true } }))
    .filter((r) => r.text).sort((a, b) => j.topics.indexOf(a.topic) - j.topics.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  const stories = rows.map((r) => ({ slug: r.slug!, title: r.title!, text: r.text!, language: "PT", level: "A0", vocab: r.vocab as any, topic: r.topic }));
  const r: any = validateJourneyStories(stories, { language: "PT", level: "A0", complete: true } as any);
  const checks: any[] = Array.isArray(r) ? r : (r.checks ?? []);
  const c = checks.find((x) => x.id === "journey-vocab-recirculation");
  console.log(`${stories.length} historias · ${c?.status}: ${String(c?.detail ?? "").slice(0, 400)}`);
}
main().finally(() => p.$disconnect());
