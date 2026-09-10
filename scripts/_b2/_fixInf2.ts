import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "la-carta-sin-abrir" } } });
  const gl = fila!.glosses as Record<string, any>;
  gl["deletrear"] = { ...gl["deletrear"], g: "to spell out (deletrear)" };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "la-carta-sin-abrir" } }, data: { glosses: gl } });
  console.log("ok");
  await p.$disconnect();
})();
