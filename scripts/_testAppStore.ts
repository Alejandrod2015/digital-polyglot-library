/* Self-test for src/lib/appStore.ts JWS verification (no Apple sandbox needed).
 * Generates a real X.509 chain with node-forge, signs a JWS, and asserts the
 * verifier ACCEPTS a valid chain (with a test root pin), REJECTS the Apple pin,
 * and REJECTS tampering / short chains. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import forge from "node-forge";
import { X509Certificate } from "crypto";
import { CompactSign, importPKCS8 } from "jose";
import { verifyAppleJws, type AppleTransactionPayload } from "../src/lib/appStore";
import { resolvePlanFromAppStoreProductId } from "../src/lib/billing";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  ok ? pass++ : fail++;
}

function makeCert(cn: string, isCa: boolean, issuer?: { cert: forge.pki.Certificate; key: forge.pki.PrivateKey }) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = String(Math.floor(Math.random() * 1e9) + 1);
  cert.validity.notBefore = new Date(Date.now() - 3_600_000);
  cert.validity.notAfter = new Date(Date.now() + 3_600_000);
  const subject = [{ name: "commonName", value: cn }];
  cert.setSubject(subject);
  cert.setIssuer(issuer ? issuer.cert.subject.attributes : subject);
  cert.setExtensions([{ name: "basicConstraints", cA: isCa }]);
  cert.sign(issuer ? issuer.key : keys.privateKey, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

function derB64(cert: forge.pki.Certificate): string {
  return forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
}

function leafPkcs8(key: forge.pki.PrivateKey): string {
  const asn1 = forge.pki.privateKeyToAsn1(key as forge.pki.rsa.PrivateKey);
  return forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(asn1));
}

async function buildJws(
  payload: Record<string, unknown>,
  x5c: string[],
  leafKeyPem: string
): Promise<string> {
  const key = await importPKCS8(leafKeyPem, "RS256");
  return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "RS256", x5c })
    .sign(key);
}

async function main() {
  const root = makeCert("Test Root CA", true);
  const intermediate = makeCert("Test Intermediate", true, root);
  const leaf = makeCert("Test Leaf", false, intermediate);

  const x5c = [derB64(leaf.cert), derB64(intermediate.cert), derB64(root.cert)];
  const rootFp = new X509Certificate(Buffer.from(derB64(root.cert), "base64"))
    .fingerprint256.replace(/:/g, "").toLowerCase();

  const tx: AppleTransactionPayload = {
    transactionId: "2000000001",
    originalTransactionId: "2000000001",
    productId: "premium_monthly",
    purchaseDate: Date.now(),
    expiresDate: Date.now() + 30 * 86_400_000,
    type: "Auto-Renewable Subscription",
    environment: "Sandbox",
  };

  const jws = await buildJws(tx as unknown as Record<string, unknown>, x5c, leafPkcs8(leaf.key));

  // 1. ACCEPT with the test root fingerprint → decoded payload returned.
  try {
    const decoded = await verifyAppleJws<AppleTransactionPayload>(jws, rootFp);
    check("valid chain accepted + payload decoded", decoded.productId === "premium_monthly");
  } catch (e) {
    check(`valid chain accepted (threw: ${(e as Error).message})`, false);
  }

  // 2. REJECT with the real Apple Root pin (default) → forged root blocked.
  try {
    await verifyAppleJws<AppleTransactionPayload>(jws);
    check("forged root rejected by Apple pin", false);
  } catch (e) {
    check("forged root rejected by Apple pin", /Apple Root CA - G3/.test((e as Error).message));
  }

  // 3. REJECT tampered signature.
  const tampered = jws.slice(0, -3) + (jws.slice(-3) === "AAA" ? "BBB" : "AAA");
  try {
    await verifyAppleJws<AppleTransactionPayload>(tampered, rootFp);
    check("tampered signature rejected", false);
  } catch {
    check("tampered signature rejected", true);
  }

  // 4. REJECT short chain (no intermediate/root).
  try {
    const shortJws = await buildJws(tx as unknown as Record<string, unknown>, [derB64(leaf.cert)], leafPkcs8(leaf.key));
    await verifyAppleJws<AppleTransactionPayload>(shortJws, rootFp);
    check("short x5c chain rejected", false);
  } catch (e) {
    check("short x5c chain rejected", /x5c/.test((e as Error).message));
  }

  // 5. REJECT broken chain: intermediate NOT signed by the presented root.
  const rogueRoot = makeCert("Rogue Root", true);
  const rogueX5c = [derB64(leaf.cert), derB64(intermediate.cert), derB64(rogueRoot.cert)];
  const rogueFp = new X509Certificate(Buffer.from(derB64(rogueRoot.cert), "base64"))
    .fingerprint256.replace(/:/g, "").toLowerCase();
  try {
    const rogueJws = await buildJws(tx as unknown as Record<string, unknown>, rogueX5c, leafPkcs8(leaf.key));
    await verifyAppleJws<AppleTransactionPayload>(rogueJws, rogueFp);
    check("chain with mismatched root rejected", false);
  } catch (e) {
    check("chain with mismatched root rejected", /not signed by root/.test((e as Error).message));
  }

  // 6. Product → plan mapping.
  check("premium_monthly → premium", resolvePlanFromAppStoreProductId("premium_monthly") === "premium");
  check("unknown product → null", resolvePlanFromAppStoreProductId("bogus") === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
