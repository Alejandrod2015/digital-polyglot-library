import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { getTesterState } from "../src/lib/appStoreConnect";
const p = new PrismaClient();

async function main() {
  const rows = await p.betaSignup.findMany({
    where: { platform: "ios", ascTesterId: { not: null }, status: { in: ["invited", "accepted"] } },
    select: { email: true, status: true, ascTesterId: true },
  });
  const cuenta: Record<string, number> = {};
  for (const r of rows) {
    const st = (await getTesterState(r.ascTesterId!)) ?? "null";
    const k = `${r.status} -> apple:${st}`;
    cuenta[k] = (cuenta[k] ?? 0) + 1;
    if (r.email.includes("benjihar")) console.log(`BEN: nuestro=${r.status}  apple=${st}`);
  }
  console.log("");
  for (const [k, v] of Object.entries(cuenta).sort()) console.log(`  ${k}: ${v}`);
}
main().finally(() => p.$disconnect());
