// Scratch: drives the Android beta helpers against the real Play API.
//
//   npx tsx scripts/_probePlayBeta.ts <service-account.json>            # read only
//   npx tsx scripts/_probePlayBeta.ts <service-account.json> --attach   # attaches the group
//
// Without --attach nothing is written: the module opens an edit, reads tracks
// and testers, and deletes the edit.
import { existsSync, readFileSync } from "node:fs";

const sa = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = sa.client_email;
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = sa.private_key;

// The group and package live in .env.local; read them rather than restating
// them here, so this script cannot drift from what the server actually uses.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*(GOOGLE_PLAY_[A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { getPlayBetaState, attachTesterGroup } = await import("../src/lib/googlePlayBeta");

  if (process.argv.includes("--attach")) {
    console.log("attaching:", JSON.stringify(await attachTesterGroup(), null, 2));
  }
  console.log(JSON.stringify(await getPlayBetaState(), null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
