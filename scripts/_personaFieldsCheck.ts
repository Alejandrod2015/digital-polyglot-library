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
    select: { motivation: true, currentApps: true, weeklyHours: true, referralSource: true },
  });
  console.log(`Total: ${rows.length}`);
  console.log(`currentApps no vacio: ${rows.filter((r) => r.currentApps && r.currentApps.trim()).length}`);
  console.log(`weeklyHours no vacio: ${rows.filter((r) => r.weeklyHours && r.weeklyHours.trim()).length}`);
  console.log(`referralSource no vacio: ${rows.filter((r) => r.referralSource && r.referralSource.trim()).length}`);

  console.log("\n--- currentApps por grupo (VIAJERO/AMIGO/EXPAT/OXIDADO) ---");
  const groups: Record<string, string[]> = { VIAJERO: ["Travel"], AMIGO: ["Family connection", "Holiday home in Spain and I wish to talk to neighbours"], EXPAT: ["Move abroad"], OXIDADO: ["Keep up my level", "To maintain my degree in Spanish"] };
  for (const [name, motivations] of Object.entries(groups)) {
    const g = rows.filter((r) => r.motivation && motivations.includes(r.motivation));
    console.log(`\n${name} (${g.length}):`);
    for (const r of g) console.log(`  apps=${JSON.stringify(r.currentApps)} hours=${JSON.stringify(r.weeklyHours)}`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
