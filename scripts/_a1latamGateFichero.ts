/** El gate de conjunto sobre el BORRADOR `_a1latamV3.json`, sin pasar por la
 *  base. Hace falta porque `saveStory --dry` mezcla lo nuevo con las filas que
 *  siguen en la base y el resultado de conjunto sale sin sentido. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories, type JourneyStoryInput } from "@/lib/validateJourneyStories";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt5vxwgd0007324oesy195k8" } });
  const real = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const D = JSON.parse(fs.readFileSync("scripts/_a1latamV3.json", "utf8"));
  const todas: JourneyStoryInput[] = D.map((s: Record<string, unknown>) => ({
    slug: s.slug, title: s.title, text: s.text, vocab: s.vocab,
    language: j!.language, level: j!.levels[0],
  }));
  let fails = 0;
  for (const c of validateJourneyStories(todas, { language: j!.language, level: j!.levels[0], realPeople: real })) {
    if (c.status === "fail") fails++;
    console.log(`  ${c.status === "pass" ? "ok  " : c.status === "fail" ? "FAIL" : c.status === "report" ? "INFORMA" : "SIN "} [${c.id}] ${(c.detail ?? "").slice(0, 260)}`);
  }
  console.log(`\n${fails} reglas en rojo`);
  await p.$disconnect();
})();
