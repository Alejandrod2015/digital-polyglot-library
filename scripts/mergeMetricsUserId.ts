/**
 * CLI para fusionar la actividad de dos cuentas de Clerk que son la misma
 * persona, SOLO para que las métricas del Studio dejen de contarla dos
 * veces. Lógica compartida con el botón "Fusionar" de
 * `/studio/beta` en `src/lib/mergeMetricsUserId.ts` (ver ahí el detalle de
 * qué tablas toca y cómo resuelve los `@@unique`).
 *
 *   npx tsx scripts/mergeMetricsUserId.ts <aliasUserId> <canonicalUserId>
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { mergeMetricsUserId } from "../src/lib/mergeMetricsUserId";

const prisma = new PrismaClient();

async function run() {
  const [alias, canon] = process.argv.slice(2);
  if (!alias || !canon) {
    console.error("uso: npx tsx scripts/mergeMetricsUserId.ts <aliasUserId> <canonicalUserId>");
    process.exit(1);
  }
  const result = await mergeMetricsUserId(prisma, alias, canon);
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}
run().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
