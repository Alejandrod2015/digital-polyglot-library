// Puts an ALREADY UPLOADED bundle on a track as a DRAFT release.
//
//   npx tsx scripts/_setPlayTrackRelease.ts <key.json> <versionCode> [--track alpha]
//
// Draft on purpose: a draft release is staged and NOT sent to Google review,
// which is the difference between preparing a release and publishing one. It
// is also the only status a draft app accepts outside the internal track
// ("Only releases with status draft may be created on draft app").
import { readFileSync } from "node:fs";

const [, , keyPath, versionCodeArg] = process.argv;
const trackIdx = process.argv.indexOf("--track");
const TRACK = trackIdx > -1 ? process.argv[trackIdx + 1] : "alpha";

const sa = JSON.parse(readFileSync(keyPath, "utf8"));
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = sa.client_email;
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = sa.private_key;
process.env.GOOGLE_PLAY_PACKAGE_NAME ??= "com.digitalpolyglot.app";

const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
  process.env.GOOGLE_PLAY_PACKAGE_NAME!,
)}`;

async function main() {
  const { getGooglePlayAccessToken } = await import("../src/lib/googlePlay");
  const { access_token } = await getGooglePlayAccessToken();
  const h = { Authorization: `Bearer ${access_token}`, Accept: "application/json" };

  const ins = await fetch(`${API}/edits`, { method: "POST", headers: h });
  if (!ins.ok) throw new Error(`edits.insert ${ins.status}: ${(await ins.text()).slice(0, 300)}`);
  const editId = (JSON.parse(await ins.text()) as { id: string }).id;

  let committed = false;
  try {
    const res = await fetch(`${API}/edits/${editId}/tracks/${encodeURIComponent(TRACK)}`, {
      method: "PUT",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({
        track: TRACK,
        releases: [{ versionCodes: [String(versionCodeArg)], status: "draft" }],
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`tracks.update ${res.status}: ${body.slice(0, 400)}`);
    console.log("track staged:", body.slice(0, 400));

    const commit = await fetch(`${API}/edits/${editId}:commit`, { method: "POST", headers: h });
    const cBody = await commit.text();
    if (!commit.ok) throw new Error(`commit ${commit.status}: ${cBody.slice(0, 400)}`);
    committed = true;
    console.log("COMMITTED (draft release, NOT sent for review)");
  } finally {
    if (!committed) {
      await fetch(`${API}/edits/${editId}`, { method: "DELETE", headers: h }).catch(() => undefined);
      console.log("(edit discarded, nothing changed)");
    }
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
