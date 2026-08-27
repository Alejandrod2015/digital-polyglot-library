import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true,
              stories: { select: { slug: true, level: true } } },
  });
  const filas = await p.tapGlossSet.findMany({ select: { slug: true } });
  const conCapa = new Set(filas.filter((f) => f.slug !== "").map((f) => f.slug));
  const filasOut: string[] = [];
  for (const j of js) {
    const slugs = j.stories.map((s) => s.slug).filter(Boolean) as string[];
    const hechas = slugs.filter((s) => conCapa.has(s)).length;
    filasOut.push([
      (j.status === "active" ? "live" : "draft").padEnd(5),
      (j.name ?? "").slice(0, 10).padEnd(10),
      (j.language ?? "").slice(0, 10).padEnd(10),
      (j.variant ?? "").padEnd(9),
      (j.levels ?? []).join(",").padEnd(6),
      `${hechas}/${slugs.length}`.padStart(7),
    ].join(" "));
  }
  console.log(filasOut.sort().join("\n"));
  await p.$disconnect();
}
main();
