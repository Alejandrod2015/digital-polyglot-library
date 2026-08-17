// Último buildNumber subido a App Store Connect, para no repetirlo. Solo lee.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import Module from "module";
const orig = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (r: string, ...rest: unknown[]) {
  if (r === "server-only") return {};
  return orig.call(this, r, ...rest);
} as typeof orig;

async function main() {
  const { isAscConfigured, listRecentBuilds } = await import("../src/lib/appStoreConnect");
  if (!isAscConfigured()) { console.log("ASC no configurado en este entorno"); return; }
  const builds = await listRecentBuilds(8);
  console.log("Builds recientes en App Store Connect:");
  for (const b of builds as Array<Record<string, unknown>>) {
    console.log("  ", JSON.stringify(b));
  }
}
main().catch((e) => console.error("FALLÓ:", e instanceof Error ? e.message : e));
