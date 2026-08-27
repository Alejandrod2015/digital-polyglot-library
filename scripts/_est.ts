import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const b = process.argv[2];
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: b, slug: "" } } });
  if (!g) { console.log("bundle no existe"); return; }
  const hechas = (await p.tapGlossSet.findMany({ where: { bundle: b, NOT: { slug: "" } }, select: { slug: true, glosses: true } }))
    .filter((f) => Object.values(f.glosses as Record<string, { c?: unknown }>).some((e) => e.c)).map((f) => f.slug);
  console.log(`${b}: ${Object.keys(g.glosses as object).length} glosas, ${g.slugs.length} historias, ${g.language}/${g.variant}`);
  console.log("con capa:", hechas.length);
  const ss = await p.journeyStory.findMany({ where: { slug: { in: g.slugs } }, select: { title: true, text: true } });
  const w = new Set<string>();
  for (const s of ss) for (const t of `${s.title} ${s.text}`.toLowerCase().match(/\p{L}+/gu) ?? []) w.add(t);
  console.log("palabras distintas:", w.size);
  console.log("\nejemplo:\n" + (ss[0]?.text ?? "").slice(0, 260));
  await p.$disconnect();
})();
