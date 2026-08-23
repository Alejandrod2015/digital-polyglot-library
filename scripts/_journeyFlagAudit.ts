// Auditoría: journeys vivos y en borrador, con su variante (la que decide la
// bandera del selector) y los niveles reales de sus historias.
import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: {
      id: true, name: true, language: true, variant: true, levels: true,
      typeSlug: true, status: true,
      stories: { select: { level: true }, take: 60 },
    },
    orderBy: [{ language: "asc" }, { status: "asc" }],
  });
  for (const r of rows) {
    const cefrs = Array.from(new Set(r.stories.map((s) => s.level ?? "-"))).sort();
    console.log(
      [
        r.status === "active" ? "live " : "draft",
        (r.language ?? "-").padEnd(11),
        (r.name ?? "-").padEnd(15),
        `variant=${r.variant ?? "-"}`.padEnd(20),
        `levels=${(r.levels ?? []).join(",") || "-"}`.padEnd(16),
        `historias=${cefrs.join(",")}`,
      ].join(" "),
    );
  }
  console.log(`\ntotal: ${rows.length}`);
  await prisma.$disconnect();
}

void main();
