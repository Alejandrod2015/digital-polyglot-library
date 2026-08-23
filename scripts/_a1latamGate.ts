import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories, type JourneyStoryInput } from "@/lib/validateJourneyStories";
const p = new PrismaClient();
(async () => {
  const ids = process.argv.slice(2);
  const real = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  for (const id of ids) {
    const j = await p.journey.findUnique({ where: { id } });
    if (!j) { console.log(`?? ${id}`); continue; }
    const orden = j.topics;
    const filas = (await p.journeyStory.findMany({ where: { journeyId: id },
      select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true } }))
      .sort((a,b) => (orden.indexOf(a.topic)-orden.indexOf(b.topic)) || (a.slotIndex-b.slotIndex));
    const todas: JourneyStoryInput[] = filas.filter((f) => String(f.text ?? "").trim())
      .map((f) => ({ slug: f.slug ?? `${f.topic}#${f.slotIndex}`, title: f.title ?? "", text: String(f.text),
                     vocab: f.vocab as never, language: j.language, level: j.levels[0] }));
    console.log(`\n===== ${j.name} ${j.language}/${j.variant} ${JSON.stringify(j.levels)} (${todas.length} historias)`);
    for (const c of validateJourneyStories(todas, { language: j.language, level: j.levels[0], realPeople: real }))
      console.log(`  ${c.status === "pass" ? "ok  " : c.status === "fail" ? "FAIL" : c.status === "report" ? "MIDE" : "SIN "} [${c.id}] ${(c.detail ?? "").slice(0, 300)}`);
  }
  await p.$disconnect();
})();
