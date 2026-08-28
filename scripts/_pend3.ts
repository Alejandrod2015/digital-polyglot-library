import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    include: { stories: { select: { slug: true } } },
  });
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, slugs: true, glosses: true } });
  const dueno = new Map<string, string>();
  for (const f of filas) if (f.slug === "") for (const s of f.slugs) dueno.set(s, f.bundle);
  const conCapa = new Set<string>();
  for (const f of filas) {
    if (f.slug === "") continue;
    const g = f.glosses as Record<string, { c?: unknown }>;
    if (Object.values(g).some((e) => e.c)) conCapa.add(`${f.bundle}::${f.slug}`);
  }
  const filas2: string[][] = [];
  for (const j of js) {
    const n = j.stories.length;
    const hechas = j.stories.filter((s) => {
      const b = dueno.get(s.slug);
      return b && conCapa.has(`${b}::${s.slug}`);
    }).length;
    const bundles = [...new Set(j.stories.map((s) => dueno.get(s.slug) ?? "-"))].join(",");
    filas2.push([
      j.status === "active" ? "live" : "draft",
      `${j.name} ${j.language} ${j.country ?? ""} ${(j.levels ?? []).join("/")}`.trim(),
      `${hechas}/${n}`,
      bundles,
    ]);
  }
  filas2.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  for (const f of filas2) console.log(f[0].padEnd(6), f[2].padEnd(7), f[1].padEnd(42), f[3]);
  await p.$disconnect();
})();
