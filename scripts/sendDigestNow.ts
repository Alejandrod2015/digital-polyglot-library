/**
 * One-shot: builds and sends the weekly digest immediately, using the
 * same code path as the Monday 08:00 UTC cron. For previewing the
 * rendered email without waiting for the schedule.
 *
 * Run with: npx tsx scripts/sendDigestNow.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { sendWeeklyDigest } = await import("../src/lib/weeklyDigest");
  const result = await sendWeeklyDigest();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
