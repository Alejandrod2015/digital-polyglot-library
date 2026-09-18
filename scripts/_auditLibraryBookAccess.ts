// Solo lectura. Cruza cada fila LibraryBook con la regla nueva de
// /api/mobile/book/[slug] (decideMobileBookAccess) para saber cuantos
// usuarios con fila perderian el acceso al libro tras el commit 71fad818.
//
//   npx tsx scripts/_auditLibraryBookAccess.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
import { decideMobileBookAccess } from "../src/lib/mobileBookAccess";

async function run() {
  const key = process.env.CLERK_SECRET_KEY ?? "";
  console.log(`instancia Clerk: ${key.startsWith("sk_live_") ? "LIVE" : key.startsWith("sk_test_") ? "DEV" : "desconocida"}`);
  const clerk = createClerkClient({ secretKey: key });
  const rows = await prisma.libraryBook.findMany({
    select: { userId: true, bookId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const entitlements = await prisma.billingEntitlement.findMany({
    where: { userId: { in: userIds } },
  });
  const entByUser = new Map(entitlements.map((e) => [e.userId, e]));

  let ok = 0;
  const denied: string[] = [];
  const missingUsers: string[] = [];
  for (const row of rows) {
    let user: Awaited<ReturnType<typeof clerk.users.getUser>> | null = null;
    try {
      user = await clerk.users.getUser(row.userId);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const msg = err instanceof Error ? err.message : String(err);
      if (status === 404) {
        missingUsers.push(`${row.userId} ${row.bookId}`);
        continue;
      }
      console.error(`Clerk rechazo la consulta (status ${status ?? "?"}): ${msg}`);
      console.error(`clave usada: ${(process.env.CLERK_SECRET_KEY ?? "").slice(0, 8)}...`);
      process.exit(2);
    }
    const allowed = decideMobileBookAccess({
      publicMetadata: user.publicMetadata,
      entitlement: entByUser.get(row.userId) ?? null,
      userCreatedAtMs: user.createdAt,
      bookSlug: row.bookId,
    });
    if (allowed) ok += 1;
    else {
      const email = user.primaryEmailAddress?.emailAddress ?? "?";
      const plan = (user.publicMetadata as Record<string, unknown>)?.plan ?? "-";
      denied.push(`${row.bookId} | ${email} | plan=${plan} | fila ${row.createdAt.toISOString().slice(0, 10)}`);
    }
  }

  console.log(`filas LibraryBook: ${rows.length} | usuarios: ${userIds.length}`);
  console.log(`siguen con acceso: ${ok}`);
  console.log(`PERDERIAN acceso: ${denied.length}`);
  for (const d of denied) console.log(`  ${d}`);
  console.log(`usuario ya no existe en Clerk: ${missingUsers.length}`);
  for (const m of missingUsers) console.log(`  ${m}`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
