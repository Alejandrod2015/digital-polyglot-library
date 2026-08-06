// Scratch: lists every bundle already uploaded to Play, so a new versionCode
// can be chosen without burning one. Play rejects a repeated or lower code
// permanently, so this runs before any build, not after.
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
  if (!ins.ok) {
    console.log("edits.insert failed:", ins.status, (await ins.text()).slice(0, 200));
    return;
  }
  const id = (JSON.parse(await ins.text()) as { id: string }).id;

  try {
    for (const kind of ["bundles", "apks"]) {
      const res = await fetch(`${app}/edits/${id}/${kind}`, { headers: h });
      const body = await res.text();
      console.log(`\n== ${kind} (${res.status})`);
      if (res.ok) {
        const list = (JSON.parse(body) as Record<string, Array<{ versionCode?: number }>>)[kind] ?? [];
        console.log(list.map((b) => b.versionCode).sort((a, b) => (a ?? 0) - (b ?? 0)).join(", ") || "(none)");
      } else {
        console.log(body.slice(0, 250));
      }
    }
  } finally {
    await fetch(`${app}/edits/${id}`, { method: "DELETE", headers: h }).catch(() => undefined);
  }
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
