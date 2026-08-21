// Los pulgares del programa, separando lo de casa de lo de fuera.
//
//   npx tsx scripts/ratingsTable.ts
//
// Existe porque el 2026-08-21 se reportaron "6 pulgares" como senal de
// testers y los seis eran del equipo. Un total sin partir no vale nada.

import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";

const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { splitInternal } = await import("../src/lib/internalAccounts");
  const prisma = new PrismaClient();

  const rows = await prisma.storyRating.findMany({ orderBy: { createdAt: "desc" } });
  const { external, internal } = await splitInternal(rows, (r) => r.email);

  console.log(`pulgares totales : ${rows.length}`);
  console.log(`  de testers     : ${external.length}`);
  console.log(`  del equipo     : ${internal.length}  (excluidos)\n`);

  if (external.length === 0) {
    console.log("Ningun tester ha valorado todavia.");
  } else {
    const up = external.filter((r) => r.liked).length;
    console.log(`arriba ${up} / abajo ${external.length - up}\n`);
    for (const r of external) {
      console.log(
        `${r.createdAt.toISOString().slice(0, 16)}  ${r.liked ? "+" : "-"}  ${(r.surface ?? "story").padEnd(8)} ${(r.storySlug ?? "?").padEnd(34)} ${r.email ?? "?"}`,
      );
      if (r.comment) console.log(`     "${r.comment}"`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
