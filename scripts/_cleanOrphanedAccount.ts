// Ejecuta el borrado que el webhook user.deleted no llegó a hacer.
// Usa la MISMA función que el endpoint de "borrar mi cuenta", así que no hay
// una segunda ruta de borrado que pueda divergir.
//   npx tsx scripts/_cleanOrphanedAccount.ts <userId>          (solo informa)
//   npx tsx scripts/_cleanOrphanedAccount.ts <userId> --borrar (borra)
import { config } from "dotenv";
config({ path: ".env" });
import Module from "module";
import { PrismaClient } from "../src/generated/prisma";

// `src/lib/prisma.ts` abre con `import "server-only"`, un sello deliberado para
// que ningún client component arrastre prisma al navegador. Ese sello también
// impide cargarlo desde un script. Lo neutralizo SOLO aquí, en memoria, para
// poder llamar a la función de borrado real en vez de reescribir sus diez
// deleteMany: una segunda ruta de borrado es exactamente lo que el comentario
// de deleteUserData.ts advierte que no se haga.
const resolver = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })
  ._resolveFilename;
(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  request: string,
  ...args: unknown[]
) {
  if (request === "server-only") return resolver.call(this, "util", ...args);
  return resolver.call(this, request, ...args);
};

const p = new PrismaClient();
const userId = process.argv[2];
const BORRAR = process.argv.includes("--borrar");

async function inventario(uid: string) {
  const [metrics, resume, favs, colls, libS, libB, ent, pref, stories, revoked] = await Promise.all([
    p.userMetric.count({ where: { userId: uid } }),
    p.continueListeningEntry.count({ where: { userId: uid } }),
    p.favorite.count({ where: { userId: uid } }),
    p.favoriteCollection.count({ where: { userId: uid } }),
    p.libraryStory.count({ where: { userId: uid } }),
    p.libraryBook.count({ where: { userId: uid } }),
    p.billingEntitlement.count({ where: { userId: uid } }),
    p.emailPreference.count({ where: { userId: uid } }),
    p.userStory.count({ where: { userId: uid } }),
    p.revokedUser.count({ where: { userId: uid } }),
  ]);
  return { metrics, resume, favs, colls, libS, libB, ent, pref, stories, revoked };
}

async function main() {
  if (!userId) {
    console.error("uso: _cleanOrphanedAccount.ts <userId> [--borrar]");
    process.exit(1);
  }
  const antes = await inventario(userId);
  console.log("ANTES:", JSON.stringify(antes));
  const total =
    antes.metrics + antes.resume + antes.favs + antes.colls + antes.libS +
    antes.libB + antes.ent + antes.pref + antes.stories;
  console.log(`filas de datos personales: ${total} · revocado: ${antes.revoked ? "sí" : "NO"}`);

  if (!BORRAR) {
    console.log("\n(solo informe; añade --borrar para ejecutar)");
    return;
  }

  // Misma función que /api/user/delete. Importada aquí dentro para que el
  // informe pueda correrse sin arrastrar el módulo con `server-only`.
  const { deleteAllUserData } = await import("../src/lib/deleteUserData");
  await deleteAllUserData(userId);

  const despues = await inventario(userId);
  console.log("DESPUES:", JSON.stringify(despues));
  const quedan =
    despues.metrics + despues.resume + despues.favs + despues.colls + despues.libS +
    despues.libB + despues.ent + despues.pref + despues.stories;
  console.log(
    quedan === 0 && despues.revoked === 1
      ? "\n✓ sin datos personales y sesión revocada"
      : `\n✗ quedan ${quedan} filas · revocado: ${despues.revoked}`
  );
}

main().finally(() => p.$disconnect());
