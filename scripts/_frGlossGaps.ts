import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as unknown as { cache: Record<string, unknown> }).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
import { getTapGlossesForSlug } from "../src/lib/tapGlosses";
const p = new PrismaClient();
const TAPPABLE = /\p{L}+(?:-\p{L}+)*/gu;
async function main() {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu" }, select: { slug: true, title: true, text: true } });
  const faltan = new Map<string, string>();
  for (const s of st) {
    const g = getTapGlossesForSlug(s.slug!); if (!g) continue;
    for (const src of [s.title ?? "", s.text ?? ""])
      for (const m of src.matchAll(TAPPABLE)) {
        const k = m[0].toLowerCase();
        if (!g[k]) {
          const i = (m.index ?? 0);
          faltan.set(k, src.slice(Math.max(0, i - 22), i + m[0].length + 12).replace(/\n/g, " "));
        }
      }
  }
  for (const [k, ctx] of [...faltan].sort()) console.log(`${k}\t…${ctx}…`);
  console.log(`\n${faltan.size} formas distintas`);
  await p.$disconnect();
}
main();
