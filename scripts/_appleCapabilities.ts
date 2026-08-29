/**
 * Lee y (con --enable) habilita capabilities de un App ID por la API de App
 * Store Connect. Nacio porque el build de iOS del 2026-08-28 fallo con
 * "Provisioning profile doesn't support the Associated Domains capability":
 * declarar `associatedDomains` en la app exige tenerla marcada en el App ID.
 *
 *   npx tsx scripts/_appleCapabilities.ts                 # lista lo que hay
 *   npx tsx scripts/_appleCapabilities.ts --enable ASSOCIATED_DOMAINS
 */
import Module from "node:module";
const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const BUNDLE = process.env.APP_BUNDLE_ID?.trim() || "com.digitalpolyglot.mobile";
const API = "https://api.appstoreconnect.apple.com";

async function main() {
  const { getAscConfig, buildAscJwt } = (await import("../src/lib/appStoreConnect")) as unknown as {
    getAscConfig: () => unknown;
    buildAscJwt: (c: unknown, now: number) => string;
  };
  const cfg = getAscConfig();
  if (!cfg) throw new Error("Sin credenciales de App Store Connect.");
  const token = buildAscJwt(cfg, Date.now());
  const auth = { Authorization: `Bearer ${token}` };

  const idRes = await fetch(`${API}/v1/bundleIds?filter[identifier]=${BUNDLE}&limit=1`, { headers: auth });
  const idBody = (await idRes.json()) as { data?: Array<{ id: string }> };
  const bundleId = idBody.data?.[0]?.id;
  if (!bundleId) throw new Error(`No aparece el bundle id ${BUNDLE}: ${JSON.stringify(idBody).slice(0, 200)}`);

  const capRes = await fetch(`${API}/v1/bundleIds/${bundleId}/bundleIdCapabilities?limit=200`, { headers: auth });
  const capBody = (await capRes.json()) as {
    data?: Array<{ id: string; attributes?: { capabilityType?: string } }>;
  };
  const actuales = (capBody.data ?? []).map((c) => c.attributes?.capabilityType).filter(Boolean) as string[];
  console.log(`${BUNDLE} (${bundleId})`);
  console.log("  capabilities:", actuales.length ? actuales.join(", ") : "(ninguna)");

  const i = process.argv.indexOf("--enable");
  if (i < 0) return;
  const tipo = process.argv[i + 1];
  if (!tipo) throw new Error("Falta el tipo: --enable ASSOCIATED_DOMAINS");
  if (actuales.includes(tipo)) {
    console.log(`  ${tipo} ya estaba habilitada.`);
    return;
  }

  const res = await fetch(`${API}/v1/bundleIdCapabilities`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        type: "bundleIdCapabilities",
        attributes: { capabilityType: tipo },
        relationships: { bundleId: { data: { type: "bundleIds", id: bundleId } } },
      },
    }),
  });
  const body = await res.text();
  console.log(res.ok ? `  ${tipo} habilitada.` : `  FALLO ${res.status}: ${body.slice(0, 300)}`);
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
