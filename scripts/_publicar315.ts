import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
/** Espera a que Apple valide la 315 y la mete en el grupo de beta testers.
 *  Un build VALID no le llega a nadie hasta que entra en el grupo. */
const GRUPO = "1db0e67c-bf4d-4333-ac2a-705ffa67b1ee";
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { listRecentBuilds, addBuildToBetaGroup, listBuildsForGroup } = await import("../src/lib/appStoreConnect");
  for (let i = 0; i < 60; i++) {
    const bs = await listRecentBuilds(8);
    const b = bs.find((x: { version: string }) => x.version === "315");
    if (!b) { console.log(`[${i}] aun no aparece`); await dormir(60000); continue; }
    if (b.processingState !== "VALID") { console.log(`[${i}] 315 en ${b.processingState}`); await dormir(60000); continue; }
    console.log(`315 VALID, id ${b.id}`);
    await addBuildToBetaGroup(b.id, GRUPO);
    const enGrupo = await listBuildsForGroup(GRUPO, 5);
    console.log("EN EL GRUPO:", JSON.stringify(enGrupo));
    return;
  }
  console.log("AGOTADO sin ver la 315 validada");
})();
