// Polls App Store Connect until build 279 clears Beta App Review.
//
// Reads BOTH the review state and the build's external state, because they can
// disagree: the review submission is what Apple grades, the external state is
// what actually decides whether a tester can install. A build only becomes
// installable for external testers when the second one says IN_BETA_TESTING.
//
//   npx tsx scripts/_watchBetaReview.ts [buildVersion]

import { createPrivateKey, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const VERSION = process.argv[2] ?? "279";
const API = "https://api.appstoreconnect.apple.com";

const b64 = (v: Buffer | string) =>
  (typeof v === "string" ? Buffer.from(v) : v).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function auth(): Record<string, string> {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "ES256", kid: process.env.ASC_KEY_ID, typ: "JWT" }));
  const p = b64(JSON.stringify({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" }));
  const pem = process.env.ASC_PRIVATE_KEY || readFileSync(process.env.ASC_PRIVATE_KEY_PATH!, "utf8");
  const s = sign("SHA256", Buffer.from(`${h}.${p}`), {
    key: createPrivateKey({ key: pem, format: "pem" }),
    dsaEncoding: "ieee-p1363",
  });
  return { Authorization: `Bearer ${h}.${p}.${b64(s)}` };
}

async function look(): Promise<{ external: string; review: string } | null> {
  const b = await (await fetch(
    `${API}/v1/builds?filter[app]=${process.env.ASC_APP_ID}&filter[version]=${VERSION}&limit=1`,
    { headers: auth() },
  )).json();
  const id = b.data?.[0]?.id;
  if (!id) return null;
  const d = await (await fetch(`${API}/v1/builds/${id}/buildBetaDetail`, { headers: auth() })).json();
  const r = await (await fetch(`${API}/v1/builds/${id}/betaAppReviewSubmission`, { headers: auth() })).json();
  return {
    external: d.data?.attributes?.externalBuildState ?? "?",
    review: r?.data?.attributes?.betaReviewState ?? "NONE",
  };
}

(async () => {
  // Every 5 minutes for up to 48 hours: Apple's own stated window.
  for (let i = 1; i <= 576; i++) {
    const s = await look();
    const stamp = new Date().toISOString().slice(11, 16);
    if (!s) {
      console.log(`${stamp}  build ${VERSION} no encontrado`);
      process.exit(1);
    }
    if (s.external === "IN_BETA_TESTING") {
      console.log(`${stamp}  APROBADO. build ${VERSION} external=${s.external} review=${s.review}`);
      process.exit(0);
    }
    if (s.review === "REJECTED") {
      console.log(`${stamp}  RECHAZADO. build ${VERSION} review=${s.review}`);
      process.exit(0);
    }
    // One line per hour, so the log stays readable over two days.
    if (i === 1 || i % 12 === 0) console.log(`${stamp}  external=${s.external} review=${s.review}`);
    await new Promise((r) => setTimeout(r, 300_000));
  }
  console.log("TIMEOUT tras 48 h");
})();
