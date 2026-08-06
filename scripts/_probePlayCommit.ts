// Scratch diagnostic: is the 403 about committing AT ALL, or about the track?
//
// Commits an edit with NO changes in it. If that also 403s, the service account
// simply cannot commit and the tester group is a red herring. If it succeeds,
// the permission works and the problem is specific to `edits.testers`.
import { readFileSync } from "node:fs";

const sa = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = sa.client_email;
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = sa.private_key;
process.env.GOOGLE_PLAY_PACKAGE_NAME ??= "com.digitalpolyglot.app";

const BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

async function main() {
  const { getGooglePlayAccessToken } = await import("../src/lib/googlePlay");
  const { access_token } = await getGooglePlayAccessToken();
  const h = { Authorization: `Bearer ${access_token}`, Accept: "application/json" };
  const app = `${BASE}/${encodeURIComponent(process.env.GOOGLE_PLAY_PACKAGE_NAME!)}`;

  const ins = await fetch(`${app}/edits`, { method: "POST", headers: h });
  const insBody = await ins.text();
  console.log("edits.insert:", ins.status, insBody.slice(0, 200));
  if (!ins.ok) return;
  const id = JSON.parse(insBody).id as string;

  const commit = await fetch(`${app}/edits/${id}:commit`, { method: "POST", headers: h });
  console.log("empty commit:", commit.status, (await commit.text()).slice(0, 300));

  await fetch(`${app}/edits/${id}`, { method: "DELETE", headers: h }).catch(() => undefined);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
