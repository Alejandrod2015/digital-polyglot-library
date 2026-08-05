// Scratch: exercises getPlayBetaState() against the real Play API.
// Read-only. The module opens an edit, reads tracks and testers, deletes it.
//
//   npx tsx scripts/_probePlayBeta.ts ../../.secrets/google-play-service-account.json
import { readFileSync } from "node:fs";

const sa = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = sa.client_email;
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = sa.private_key;
process.env.GOOGLE_PLAY_PACKAGE_NAME ??= "com.digitalpolyglot.app";
// Not created yet: set so the blocker wording can be read in context.
process.env.GOOGLE_PLAY_BETA_GROUP_EMAIL ??= "dpl-android-beta@googlegroups.com";

async function main() {
  const { getPlayBetaState } = await import("../src/lib/googlePlayBeta");
  console.log(JSON.stringify(await getPlayBetaState(), null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
