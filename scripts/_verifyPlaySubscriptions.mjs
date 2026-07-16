// Scratch verifier (excluded from the batch gate by the `_` prefix).
// Lists Google Play subscriptions + base plans + prices using the service
// account key, so we can confirm premium_monthly / premium_annual without the
// flaky Console UI. Run: node scripts/_verifyPlaySubscriptions.mjs
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const KEY_PATH = new URL("../.secrets/google-play-service-account.json", import.meta.url);
const PACKAGE = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || "com.digitalpolyglot.app";

const b64url = (s) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

async function accessToken({ client_email, private_key }) {
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    exp: iat + 3600,
    iat,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  });
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

function priceOf(basePlan) {
  const cfgs = basePlan.regionalConfigs || [];
  const eur = cfgs.find((c) => c.price?.currencyCode === "EUR") || cfgs[0];
  if (!eur?.price) return "—";
  const { currencyCode, units = "0", nanos = 0 } = eur.price;
  return `${units}.${String(Math.round(nanos / 1e7)).padStart(2, "0")} ${currencyCode}`;
}

const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const token = await accessToken(key);
const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
  PACKAGE
)}/subscriptions`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) throw new Error(`subscriptions.list ${res.status}: ${await res.text()}`);
const { subscriptions = [] } = await res.json();

console.log(`\nPackage: ${PACKAGE}  —  ${subscriptions.length} subscription(s)\n`);
for (const s of subscriptions) {
  console.log(`• ${s.productId}`);
  for (const bp of s.basePlans || []) {
    const period =
      bp.autoRenewingBasePlanType?.billingPeriodDuration ||
      bp.prepaidBasePlanType?.billingPeriodDuration ||
      "?";
    console.log(`    - basePlan "${bp.basePlanId}"  ${bp.state}  period=${period}  price=${priceOf(bp)}`);
  }
}
const ids = subscriptions.map((s) => s.productId);
console.log("\nExpected by the app: premium_monthly, premium_annual");
console.log("Found:", ids.join(", ") || "(none)");
for (const need of ["premium_monthly", "premium_annual"]) {
  console.log(`  ${ids.includes(need) ? "✅" : "❌ MISSING"}  ${need}`);
}
