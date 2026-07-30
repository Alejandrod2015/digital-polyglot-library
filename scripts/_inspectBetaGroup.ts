// Read-only look at the real state of the TestFlight group applicants land in.
//
// The preflight proves a build exists on the app. That is not the same thing
// as the group having access to one: a tester invited to a group with no build
// attached accepts the invite, opens TestFlight, and finds nothing to install.

import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { listBetaGroups } from "../src/lib/appStoreConnect";

// The client module intentionally exposes only the operations the app needs.
// This script pokes at a couple of extra read endpoints, so it signs its own
// token rather than widening the production surface for a diagnostic.
function jwt(): string {
  const keyId = process.env.ASC_KEY_ID!.trim();
  const issuerId = process.env.ASC_ISSUER_ID!.trim();
  const pem =
    process.env.ASC_PRIVATE_KEY || readFileSync(process.env.ASC_PRIVATE_KEY_PATH!, "utf8");
  const b64 = (v: Buffer | string) =>
    (typeof v === "string" ? Buffer.from(v) : v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const body = b64(JSON.stringify({ iss: issuerId, iat: now, exp: now + 600, aud: "appstoreconnect-v1" }));
  const sig = cryptoSign("SHA256", Buffer.from(`${head}.${body}`), {
    key: createPrivateKey({ key: pem, format: "pem" }),
    dsaEncoding: "ieee-p1363",
  });
  return `${head}.${body}.${b64(sig)}`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${jwt()}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

async function main() {
  const groups = await listBetaGroups();
  console.log("Beta groups on the app:\n");

  for (const g of groups) {
    const detail = await get<{
      data: { attributes?: Record<string, unknown> };
    }>(`/v1/betaGroups/${g.id}`);
    const a = detail.data.attributes ?? {};

    const testers = await get<{ data: unknown[]; meta?: { paging?: { total?: number } } }>(
      `/v1/betaGroups/${g.id}/betaTesters?limit=1`,
    );
    const builds = await get<{
      data: Array<{ attributes?: { version?: string; expired?: boolean } }>;
      meta?: { paging?: { total?: number } };
    }>(`/v1/betaGroups/${g.id}/builds?limit=10`);

    console.log(`  "${g.name}"`);
    console.log(`    internal:        ${g.internal}`);
    console.log(`    public link:     ${a.publicLinkEnabled === true ? `yes (${a.publicLink ?? "?"})` : "no"}`);
    console.log(`    auto-notify:     ${a.feedbackEnabled === true ? "feedback on" : "feedback off"}`);
    console.log(`    testers:         ${testers.meta?.paging?.total ?? testers.data.length}`);
    const bl = builds.data.map((b) => `${b.attributes?.version}${b.attributes?.expired ? " (expired)" : ""}`);
    console.log(`    builds attached: ${bl.length > 0 ? bl.join(", ") : "NONE, invited testers would see nothing to install"}`);
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
