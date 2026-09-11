// SOLO LECTURA. Journeys que recogeria _newbundle.ts y tamano de los bundles franceses.
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmtwo6cys0007j8yzg6ni3fsc" }, select: { language: true, variant: true, levels: true, status: true, typeSlug: true } });
  console.log("este:", j);
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] }, language: j!.language, variant: j!.variant, levels: { has: j!.levels[0] } }, select: { id: true, typeSlug: true, status: true, _count: { select: { stories: true } } } as any });
  console.log("recogeria _newbundle:", js);
  const b: any[] = await p.tapGlossSet.findMany({ where: { language: "french" }, select: { bundle: true, slug: true, glosses: true, slugs: true } });
  const g = new Map<string, { filas: number; global: number; slugs: number }>();
  for (const r of b) { const e = g.get(r.bundle) ?? { filas: 0, global: 0, slugs: 0 }; e.filas++; if (r.slug === "") { e.global = Object.keys(r.glosses ?? {}).length; e.slugs = r.slugs.length; } g.set(r.bundle, e); }
  console.log("bundles fr:", Object.fromEntries(g));
  console.log("ya existe french-friends-a0:", g.has("french-friends-a0"));
  await p.$disconnect();
})();
