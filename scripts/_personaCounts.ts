import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function main() {
  const signups = await prisma.betaSignup.findMany({
    where: {
      NOT: [
        { email: { contains: "betatest", mode: "insensitive" } },
        { email: { contains: "postmigration", mode: "insensitive" } },
        { email: { contains: "example.com", mode: "insensitive" } },
      ],
    },
    select: {
      email: true,
      motivation: true,
      applicationReason: true,
      topicInterests: true,
      clerkUserId: true,
      currentLevel: true,
    },
  });
  const levelCounts = new Map<string, number>();
  for (const s of signups) {
    const k = s.currentLevel ?? "(null)";
    levelCounts.set(k, (levelCounts.get(k) ?? 0) + 1);
  }
  console.log("Distribución de currentLevel:");
  for (const [k, v] of [...levelCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${JSON.stringify(k)}: ${v}`);
  const nonBeginner = signups.filter((s) => s.currentLevel && s.currentLevel !== "Beginner").length;
  console.log(`Por encima de "Beginner" exacto: ${nonBeginner} de ${signups.length}`);

  const accountsWithId = signups.filter((s) => s.clerkUserId).length;
  const userIds = signups.map((s) => s.clerkUserId).filter((x): x is string => !!x);
  const vocabCounts = await prisma.userMetric.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, eventType: "vocab_clicked" },
    _count: { _all: true },
  });
  const vocabByUser = new Map(vocabCounts.map((v) => [v.userId, v._count._all]));
  const totalVocab = vocabCounts.reduce((sum, v) => sum + v._count._all, 0);
  console.log(`Cuentas con clerkUserId: ${accountsWithId} | Toques totales (vocab_clicked): ${totalVocab}\n`);

  const byMotivation = new Map<string, typeof signups>();
  for (const s of signups) {
    const key = s.motivation ?? "(null)";
    if (!byMotivation.has(key)) byMotivation.set(key, []);
    byMotivation.get(key)!.push(s);
  }

  console.log(`Total BetaSignup: ${signups.length}\n`);

  const sorted = [...byMotivation.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [motivation, rows] of sorted) {
    const accounts = rows.filter((r) => r.clerkUserId).length;
    const vocabTouches = rows.reduce((sum, r) => sum + (r.clerkUserId ? vocabByUser.get(r.clerkUserId) ?? 0 : 0), 0);
    console.log(`${motivation}: ${rows.length} personas, ${accounts} cuentas, ${vocabTouches} toques`);
  }

  function cardStats(label: string, rows: typeof signups) {
    const accounts = rows.filter((r) => r.clerkUserId).length;
    const vocabTouches = rows.reduce((sum, r) => sum + (r.clerkUserId ? vocabByUser.get(r.clerkUserId) ?? 0 : 0), 0);
    console.log(`\n=== ${label}: ${rows.length} de ${signups.length}, ${accounts} cuentas, ${vocabTouches} toques ===`);
    for (const r of rows) {
      console.log(`  [motivation=${JSON.stringify(r.motivation)}] [cuenta=${r.clerkUserId ? "si" : "no"}] ${JSON.stringify(r.applicationReason)}`);
    }
  }

  cardStats("EL VIAJERO (Travel)", signups.filter((s) => s.motivation === "Travel"));
  cardStats(
    "EL AMIGO (Family connection + casa en España)",
    signups.filter((s) => s.motivation === "Family connection" || s.motivation === "Holiday home in Spain and I wish to talk to neighbours"),
  );
  cardStats("EL EXPAT (Move abroad)", signups.filter((s) => s.motivation === "Move abroad"));
  cardStats(
    "EL OXIDADO (Keep up my level + maintain degree)",
    signups.filter((s) => s.motivation === "Keep up my level" || s.motivation === "To maintain my degree in Spanish"),
  );
  cardStats("Work (candidata)", signups.filter((s) => s.motivation === "Work"));

  const paidEvents = await prisma.userMetric.findMany({
    where: { userId: { in: userIds }, eventType: { in: ["trial_converted", "trial_started", "trial_started_with_pm"] } },
    select: { userId: true, eventType: true },
  });
  console.log("\n--- Eventos de pago entre los 41 con cuenta ---");
  console.log(paidEvents);

  const known = ["Travel", "Family connection", "Just for fun", "Keep up my level", "Move abroad", "Work"];
  console.log("\n--- Other (texto libre en motivation) ---");
  const otherRows = signups.filter((s) => s.motivation && !known.includes(s.motivation));
  for (const r of otherRows) {
    console.log(`  motivation=${JSON.stringify(r.motivation)} reason=${JSON.stringify(r.applicationReason)}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
