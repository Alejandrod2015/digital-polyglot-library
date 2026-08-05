// Read-only: what have we actually sent to a given applicant, per our own log.
import { existsSync, readFileSync } from "node:fs";
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const prisma = new PrismaClient();
  const needle = process.argv[2] ?? "";
  const signups = await prisma.betaSignup.findMany({
    where: { OR: [{ email: { contains: needle, mode: "insensitive" } },
                  { appleIdEmail: { contains: needle, mode: "insensitive" } }] },
    select: { id: true, firstName: true, email: true, appleIdEmail: true, status: true, personalNote: true },
  });
  for (const s of signups) {
    console.log(`\n${s.firstName ?? "-"}  <${s.email}>  apple=${s.appleIdEmail ?? "-"}  estado=${s.status}`);
    console.log(`  nota personal guardada: ${s.personalNote ? JSON.stringify(s.personalNote).slice(0, 90) : "(ninguna)"}`);
    const logs = await prisma.betaEmailLog.findMany({
      where: { signupId: s.id }, orderBy: { sentAt: "asc" },
      select: { kind: true, sentAt: true, providerId: true },
    });
    console.log(`  correos registrados: ${logs.length}`);
    for (const l of logs) {
      console.log(`    ${l.sentAt.toISOString().slice(0, 16)}  ${l.kind.padEnd(22)} resendId=${l.providerId ?? "(no guardado)"}`);
    }
  }
  await prisma.$disconnect();
})();
