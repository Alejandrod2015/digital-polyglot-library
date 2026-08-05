// Watch one TestFlight tester until they install.
//
// The state lives on the tester's row INSIDE a group listing, never on the
// tester resource: GET /v1/betaTesters/{id} answers state: null, which reads
// like an answer and is not one.
//
//   npx tsx scripts/_watchTester.ts <email> [--every 1200] [--for 259200]

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

const API = "https://api.appstoreconnect.apple.com";

const b64 = (v: Buffer | string) =>
  (typeof v === "string" ? Buffer.from(v) : v).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Minted per request on purpose: Apple caps a token at 20 minutes, and this
// process is meant to outlive that by days.
function auth() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "ES256", kid: process.env.ASC_KEY_ID, typ: "JWT" }));
  const p = b64(JSON.stringify({
    iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1",
  }));
  const pem = process.env.ASC_PRIVATE_KEY || readFileSync(process.env.ASC_PRIVATE_KEY_PATH!, "utf8");
  const s = sign("SHA256", Buffer.from(`${h}.${p}`), {
    key: createPrivateKey({ key: pem, format: "pem" }), dsaEncoding: "ieee-p1363",
  });
  return { Authorization: `Bearer ${h}.${p}.${b64(s)}` };
}

async function stateOf(email: string): Promise<string | null> {
  const gs = await (await fetch(
    `${API}/v1/apps/${process.env.ASC_APP_ID}/betaGroups?limit=20`, { headers: auth() },
  )).json();
  for (const g of gs.data ?? []) {
    const ts = await (await fetch(
      `${API}/v1/betaGroups/${g.id}/betaTesters?limit=200`, { headers: auth() },
    )).json();
    for (const t of ts.data ?? []) {
      if ((t.attributes?.email ?? "").toLowerCase() === email.toLowerCase()) {
        return t.attributes?.state ?? null;
      }
    }
  }
  return null;
}

const stamp = () => new Date().toISOString().slice(11, 16);

(async () => {
  const email = process.argv[2];
  if (!email) { console.log("usage: _watchTester.ts <email>"); return; }
  const arg = (flag: string, dflt: number) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? Number(process.argv[i + 1]) : dflt;
  };
  const every = arg("--every", 1200) * 1000;
  const until = Date.now() + arg("--for", 259200) * 1000;

  let last: string | null = null;
  while (Date.now() < until) {
    let state: string | null;
    try {
      state = await stateOf(email);
    } catch (err) {
      // A blip in Apple's API is not a reason to stop watching for three days.
      console.log(`${stamp()}  (fallo de consulta, reintento) ${String(err).slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, every));
      continue;
    }
    if (state !== last) {
      console.log(`${stamp()}  ${email} -> ${state ?? "(no está en ningún grupo)"}`);
      last = state;
    }
    if (state === "INSTALLED") {
      console.log(`${stamp()}  INSTALADO. ${email} abrió la app.`);
      return;
    }
    await new Promise((r) => setTimeout(r, every));
  }
  console.log(`${stamp()}  fin de la vigilancia, sigue en ${last ?? "?"}`);
})();
