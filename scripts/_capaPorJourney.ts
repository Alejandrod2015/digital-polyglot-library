/** Cuantas historias de cada journey vivo o borrador tienen capa de contexto.
 *  El bundle se deduce del `slugs` de la fila global, igual que el lector. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany();
  const deSlug = new Map<string, string>();
  for (const f of filas) if (f.slug === "") for (const s of f.slugs) deSlug.set(s, f.bundle);
  const conCapa = new Set(filas.filter((f) => f.slug !== "" &&
    Object.values(f.glosses as Record<string, { c?: unknown }>).some((e) => e.c)).map((f) => `${f.bundle}|${f.slug}`));
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true,
      stories: { select: { slug: true } } },
  });
  for (const j of js) {
    const slugs = j.stories.map((s) => s.slug).filter(Boolean) as string[];
    const con = slugs.filter((s) => { const b = deSlug.get(s); return b && conCapa.has(`${b}|${s}`); }).length;
    const bundles = [...new Set(slugs.map((s) => deSlug.get(s)).filter(Boolean))];
    console.log([j.status === "active" ? "LIVE" : "DRAFT", j.name, `${j.language}/${j.variant}`,
      j.levels.join("/") || "-", `${con}/${slugs.length}`, bundles.join(",") || "-"].join("|"));
  }
  await p.$disconnect();
})();
