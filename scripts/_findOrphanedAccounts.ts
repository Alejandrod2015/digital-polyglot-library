// Busca cuentas borradas en Clerk que aún conservan datos personales en la BD,
// o sea los borrados que el webhook user.deleted no llegó a ejecutar.
//
// Un userId sólo cuenta como huérfano si NO existe en la instancia de
// producción NI en la de desarrollo. Sin esa segunda comprobación, las cuentas
// de prueba (y la del propio dueño, que vive en la instancia dev) saldrían como
// huérfanas y se borrarían datos legítimos.
//
// Sólo informa. No borra nada.
//   npx tsx scripts/_findOrphanedAccounts.ts
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { readFileSync } from "fs";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const PROD_ENV_FILE = process.argv[2];

function leerClave(file: string, name: string): string | null {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\n]+)"?`));
      if (m) return m[1].trim();
    }
  } catch {
    return null;
  }
  return null;
}

async function existe(clerk: ReturnType<typeof createClerkClient>, id: string): Promise<boolean> {
  try {
    await clerk.users.getUser(id);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const devKey = process.env.CLERK_SECRET_KEY ?? "";
  const prodKey = PROD_ENV_FILE ? leerClave(PROD_ENV_FILE, "CLERK_SECRET_KEY") : null;
  console.log("clave dev :", devKey ? devKey.slice(0, 7) + "…" : "AUSENTE");
  console.log("clave prod:", prodKey ? prodKey.slice(0, 7) + "…" : "AUSENTE");
  if (!prodKey || !devKey) {
    console.error("\nHacen falta las dos claves. Uso: _findOrphanedAccounts.ts <archivo-env-prod>");
    process.exit(1);
  }
  const dev = createClerkClient({ secretKey: devKey });
  const prod = createClerkClient({ secretKey: prodKey });

  // Todo userId que tenga cualquier dato personal en la base.
  const grupos = await Promise.all([
    p.userMetric.findMany({ select: { userId: true }, distinct: ["userId"] }),
    p.favorite.findMany({ select: { userId: true }, distinct: ["userId"] }),
    p.favoriteCollection.findMany({ select: { userId: true }, distinct: ["userId"] }),
    p.libraryBook.findMany({ select: { userId: true }, distinct: ["userId"] }),
    p.libraryStory.findMany({ select: { userId: true }, distinct: ["userId"] }),
    p.userStory.findMany({ select: { userId: true }, distinct: ["userId"] }),
    p.continueListeningEntry.findMany({ select: { userId: true }, distinct: ["userId"] }),
    p.billingEntitlement.findMany({ select: { userId: true }, distinct: ["userId"] }),
  ]);
  const ids = Array.from(new Set(grupos.flat().map((r) => r.userId))).filter(Boolean);
  console.log(`\nuserIds con datos en la BD: ${ids.length}`);

  const huerfanos: string[] = [];
  for (const id of ids) {
    if (await existe(prod, id)) continue;
    if (await existe(dev, id)) continue;
    huerfanos.push(id);
  }

  if (!huerfanos.length) {
    console.log("\n✓ ninguna cuenta huérfana: todos los userIds con datos existen en Clerk");
    return;
  }
  console.log(`\n⚠ ${huerfanos.length} cuenta(s) huérfana(s):`);
  for (const id of huerfanos) {
    const [metrics, favs, libS, libB, revoked] = await Promise.all([
      p.userMetric.count({ where: { userId: id } }),
      p.favorite.count({ where: { userId: id } }),
      p.libraryStory.count({ where: { userId: id } }),
      p.libraryBook.count({ where: { userId: id } }),
      p.revokedUser.count({ where: { userId: id } }),
    ]);
    console.log(
      `  ${id}  metrics:${metrics} favs:${favs} libS:${libS} libB:${libB} revocado:${revoked ? "sí" : "NO"}`
    );
  }
  console.log("\nLimpieza: npx tsx scripts/_cleanOrphanedAccount.ts <userId> --borrar");
}

main().finally(() => p.$disconnect());
