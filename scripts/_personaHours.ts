import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.betaSignup.findMany({
    where: {
      NOT: [
        { email: { contains: "betatest", mode: "insensitive" } },
        { email: { contains: "postmigration", mode: "insensitive" } },
        { email: { contains: "example.com", mode: "insensitive" } },
      ],
    },
    select: { motivation: true, weeklyHours: true, currentLevel: true },
  });
  const groups: Record<string, string[]> = {
    VIAJERO: ["Travel"],
    AMIGO: ["Family connection", "Holiday home in Spain and I wish to talk to neighbours"],
    EXPAT: ["Move abroad"],
    OXIDADO: ["Keep up my level", "To maintain my degree in Spanish"],
  };
  for (const [name, motivations] of Object.entries(groups)) {
    const g = rows.filter((r) => r.motivation && motivations.includes(r.motivation));
    const hoursCounts: Record<string, number> = {};
    for (const r of g) hoursCounts[r.weeklyHours ?? "(vacio)"] = (hoursCounts[r.weeklyHours ?? "(vacio)"] ?? 0) + 1;
    const levelCounts: Record<string, number> = {};
    for (const r of g) levelCounts[r.currentLevel ?? "(vacio)"] = (levelCounts[r.currentLevel ?? "(vacio)"] ?? 0) + 1;
    console.log(`${name} (n=${g.length}) horas:`, hoursCounts, "niveles:", levelCounts);
  }
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
