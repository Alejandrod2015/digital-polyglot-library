// Asigna un build al grupo de beta EXTERNO y muestra qué puede instalar el
// grupo después. Es el paso que dispara la Beta App Review de Apple.
//
//   npx tsx scripts/_buildToGroup.ts <buildId> <groupId>
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { addBuildToBetaGroup, listBuildsForGroup } from "../src/lib/appStoreConnect";

const [, , buildId, groupId] = process.argv;

(async () => {
  if (!buildId || !groupId) throw new Error("uso: _buildToGroup.ts <buildId> <groupId>");
  const res = await addBuildToBetaGroup(buildId, groupId);
  console.log(res.ok ? "ASIGNADO al grupo" : `ERROR: ${res.error}`);
  const builds = await listBuildsForGroup(groupId).catch(() => []);
  console.log("\nbuilds que el grupo puede instalar ahora:");
  for (const b of builds as Array<Record<string, unknown>>) {
    console.log(`   v${b.version ?? b.buildNumber}   expirado=${b.expired}`);
  }
})();
