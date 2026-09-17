// Promociona un versionCode ya subido a la pista alpha (closed testing).
//   npx tsx scripts/_promotePlayAlpha.ts <service-account.json> <versionCode> [--commit]
import { readFileSync } from "node:fs";
const sa = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = sa.client_email;
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = sa.private_key;
process.env.GOOGLE_PLAY_PACKAGE_NAME ??= "com.digitalpolyglot.app";
const BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const vc = process.argv[3];
const commit = process.argv.includes("--commit");
async function main() {
  const { getGooglePlayAccessToken } = await import("../src/lib/googlePlay");
  const { access_token } = await getGooglePlayAccessToken();
  const h = { Authorization: `Bearer ${access_token}`, Accept: "application/json", "Content-Type": "application/json" };
  const app = `${BASE}/${encodeURIComponent(process.env.GOOGLE_PLAY_PACKAGE_NAME!)}`;
  const ins = await fetch(`${app}/edits`, { method: "POST", headers: h });
  const id = (await ins.json()).id as string;
  try {
    const tr = await (await fetch(`${app}/edits/${id}/tracks`, { headers: h })).json();
    for (const t of tr.tracks ?? []) console.log(t.track, JSON.stringify(t.releases?.map((r: any) => ({ s: r.status, v: r.versionCodes, n: r.name, notes: r.releaseNotes?.length }))));
    if (!commit) return;
    const alpha = (tr.tracks ?? []).find((t: any) => t.track === "alpha");
    const prev = alpha?.releases?.[0] ?? {};
    const body = { track: "alpha", releases: [{ name: "1.0", versionCodes: [vc], status: "completed", ...(prev.releaseNotes ? { releaseNotes: prev.releaseNotes } : {}) }] };
    const up = await fetch(`${app}/edits/${id}/tracks/alpha`, { method: "PUT", headers: h, body: JSON.stringify(body) });
    console.log("tracks.update:", up.status, (await up.text()).slice(0, 300));
    if (!up.ok) return;
    const c = await fetch(`${app}/edits/${id}:commit`, { method: "POST", headers: h });
    console.log("commit:", c.status, (await c.text()).slice(0, 300));
  } finally {
    if (!commit) await fetch(`${app}/edits/${id}`, { method: "DELETE", headers: h }).catch(() => undefined);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
