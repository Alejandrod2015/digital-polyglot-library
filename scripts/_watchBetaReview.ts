// Polls App Store Connect until build 279 clears Beta App Review.
//
// The state lives on the build's betaAppReviewSubmission relationship:
// WAITING_FOR_REVIEW -> IN_REVIEW -> APPROVED (or REJECTED).

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

const b64 = (v: Buffer | string) =>
  (typeof v === "string" ? Buffer.from(v) : v).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function jwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "ES256", kid: process.env.ASC_KEY_ID, typ: "JWT" }));
  const p = b64(JSON.stringify({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" }));
  const pem = process.env.ASC_PRIVATE_KEY || readFileSync(process.env.ASC_PRIVATE_KEY_PATH!, "utf8");
  const s = sign("SHA256", Buffer.from(`${h}.${p}`), {
    key: createPrivateKey({ key: pem, format: "pem" }),
    dsaEncoding: "ieee-p1363",
  });
  return `${h}.${p}.${b64(s)}`;
}

async function state(): Promise<string> {
  const H = { Authorization: `Bearer ${jwt()}` };
  const builds = await (await fetch(
    `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${process.env.ASC_APP_ID}&filter[version]=279&limit=1`,
    { headers: H },
  )).json();
  const id = builds.data?.[0]?.id;
  if (!id) return "NO_BUILD";
  const sub = await (await fetch(
    `https://api.appstoreconnect.apple.com/v1/builds/${id}/betaAppReviewSubmission`,
    { headers: H },
  )).json();
  return sub?.data?.attributes?.betaReviewState ?? "NONE";
}

(async () => {
  for (let i = 1; i <= 480; i++) {
    const s = await state();
    const stamp = new Date().toISOString().slice(11, 16);
    if (s === "APPROVED" || s === "REJECTED") {
      console.log(`${stamp}  build 279 -> ${s}`);
      process.exit(0);
    }
    if (i === 1 || i % 12 === 0) console.log(`${stamp}  ${s}`);
    await new Promise((r) => setTimeout(r, 300_000));
  }
  console.log("TIMEOUT tras 40 h");
})();
