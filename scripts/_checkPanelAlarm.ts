// Read-only rehearsal of what /studio/beta will now show.
//
// The page itself needs a Studio session, so this exercises the same two
// inputs it renders from: our own status, and the state Apple actually holds.
// It reproduces the alarm rule rather than importing the component, so if the
// two ever drift this stops matching what the page says.
//
//   npx tsx scripts/_checkPanelAlarm.ts

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
  const { listGroupTesterStates } = await import("../src/lib/appStoreConnect");
  const { PrismaClient } = await import("../src/generated/prisma");
  const prisma = new PrismaClient();

  const states = await listGroupTesterStates();
  console.log(`Apple respondio con ${states.size} testers.`);
  if (states.size === 0) {
    console.log("Mapa vacio: el panel mostrara 'Apple unreachable' y el contador en '?', no en 0.");
  }

  // Same filter the panel applies. Without it the rehearsal reports a blocked
  // tester that is one of our own test rows, which is how the alarm nearly
  // shipped permanently switched on.
  const TEST_ROW = /betatest|postmigration|example\.com/i;
  const rows = (
    await prisma.betaSignup.findMany({
      orderBy: { createdAt: "asc" },
      select: { firstName: true, email: true, status: true, ascTesterId: true },
    })
  ).filter((r) => !TEST_ROW.test(r.email));

  let blocked = 0;
  console.log("");
  console.log("NOMBRE      NUESTRO     APPLE          ALARMA");
  console.log("-".repeat(78));
  for (const r of rows) {
    const apple = r.ascTesterId ? states.get(r.ascTesterId) : undefined;
    const appleState = !r.ascTesterId
      ? "(sin registrar)"
      : states.size === 0
        ? "UNREACHABLE"
        : (apple?.state ?? "GONE");

    let alarm: string | null = null;
    if (!r.ascTesterId) {
      alarm =
        r.status === "invited" || r.status === "accepted"
          ? "marcado como invitado y nunca registrado en Apple"
          : null;
    } else if (appleState === "GONE") {
      alarm = "Apple no reconoce el id que guardamos";
    } else if (appleState === "NOT_INVITED") {
      alarm = "Apple no ha enviado la invitacion";
    }
    if (alarm) blocked++;

    console.log(
      `${(r.firstName ?? "-").padEnd(11)} ${r.status.padEnd(11)} ${appleState.padEnd(14)} ${alarm ?? ""}`,
    );
  }

  console.log("");
  console.log(`"Blocked at Apple" mostraria: ${states.size === 0 ? "?" : blocked}`);
  await prisma.$disconnect();
})();
