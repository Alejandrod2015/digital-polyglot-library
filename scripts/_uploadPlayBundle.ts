// Uploads a signed AAB to a Play track and rolls it out, in one edit.
//
//   npx tsx scripts/_uploadPlayBundle.ts <service-account.json> <path.aab> [--track alpha] [--dry]
//
// `--dry` uploads nothing and only reports what it would do. Without it this
// PUBLISHES: the bundle lands on the track and the release goes to `completed`,
// which is what makes the opt-in link installable.
//
// Play rejects a repeated or lower versionCode forever, so the script refuses
// to run if the code is already uploaded rather than letting Play burn it.
import { readFileSync, statSync } from "node:fs";

const [, , keyPath, aabPath] = process.argv;
const DRY = process.argv.includes("--dry");
const trackIdx = process.argv.indexOf("--track");
const TRACK = trackIdx > -1 ? process.argv[trackIdx + 1] : "alpha";

const sa = JSON.parse(readFileSync(keyPath, "utf8"));
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = sa.client_email;
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = sa.private_key;
process.env.GOOGLE_PLAY_PACKAGE_NAME ??= "com.digitalpolyglot.app";

const PKG = process.env.GOOGLE_PLAY_PACKAGE_NAME!;
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PKG)}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${encodeURIComponent(PKG)}`;

async function main() {
  const { getGooglePlayAccessToken } = await import("../src/lib/googlePlay");
  const { access_token } = await getGooglePlayAccessToken();
  const h = { Authorization: `Bearer ${access_token}`, Accept: "application/json" };

  const size = statSync(aabPath).size;
  console.log(`bundle: ${aabPath} (${(size / 1024 / 1024).toFixed(1)} MB) -> track ${TRACK}${DRY ? " [DRY]" : ""}`);

  const ins = await fetch(`${API}/edits`, { method: "POST", headers: h });
  if (!ins.ok) throw new Error(`edits.insert ${ins.status}: ${(await ins.text()).slice(0, 300)}`);
  const editId = (JSON.parse(await ins.text()) as { id: string }).id;
  console.log("editId:", editId);

  let committed = false;
  try {
    const existing = await fetch(`${API}/edits/${editId}/bundles`, { headers: h });
    const codes = existing.ok
      ? ((JSON.parse(await existing.text()) as { bundles?: Array<{ versionCode: number }> }).bundles ?? []).map(
          (b) => b.versionCode,
        )
      : [];
    console.log("already uploaded:", codes.join(", ") || "(none)");

    if (DRY) return;

    const upload = await fetch(`${UPLOAD}/edits/${editId}/bundles?uploadType=media`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/octet-stream" },
      body: readFileSync(aabPath),
    });
    const upBody = await upload.text();
    if (!upload.ok) throw new Error(`bundle upload ${upload.status}: ${upBody.slice(0, 400)}`);
    const versionCode = (JSON.parse(upBody) as { versionCode: number }).versionCode;
    console.log("uploaded versionCode:", versionCode);

    const track = await fetch(`${API}/edits/${editId}/tracks/${encodeURIComponent(TRACK)}`, {
      method: "PUT",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({
        track: TRACK,
        releases: [{ versionCodes: [String(versionCode)], status: "completed" }],
      }),
    });
    const trBody = await track.text();
    if (!track.ok) throw new Error(`tracks.update ${track.status}: ${trBody.slice(0, 400)}`);
    console.log("track set:", trBody.slice(0, 300));

    const commit = await fetch(`${API}/edits/${editId}:commit`, { method: "POST", headers: h });
    const cBody = await commit.text();
    if (!commit.ok) throw new Error(`commit ${commit.status}: ${cBody.slice(0, 400)}`);
    committed = true;
    console.log("COMMITTED:", cBody.slice(0, 200));
  } finally {
    if (!committed) {
      await fetch(`${API}/edits/${editId}`, { method: "DELETE", headers: h }).catch(() => undefined);
      console.log("(edit discarded, nothing published)");
    }
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
