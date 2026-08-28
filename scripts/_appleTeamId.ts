/**
 * Saca el Team ID (el prefijo de los App IDs) de App Store Connect, para el
 * apple-app-site-association. En la API vive como `seedId` del bundle id.
 *
 *   npx tsx scripts/_appleTeamId.ts
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

async function main() {
  const { getAscConfig, buildAscJwt } = (await import("../src/lib/appStoreConnect")) as unknown as {
    getAscConfig: () => unknown;
    buildAscJwt: (c: unknown, now: number) => string;
  };
  const cfg = getAscConfig();
  if (!cfg) throw new Error("Sin credenciales de App Store Connect en el entorno.");
  const token = buildAscJwt(cfg, Date.now());

  const res = await fetch("https://api.appstoreconnect.apple.com/v1/bundleIds?limit=200", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as {
    data?: Array<{ attributes?: { identifier?: string; name?: string; seedId?: string } }>;
  };
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 200)}`);

  for (const b of body.data ?? []) {
    const a = b.attributes ?? {};
    console.log(`${(a.identifier ?? "?").padEnd(38)} seedId=${a.seedId ?? "-"}   ${a.name ?? ""}`);
  }
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
