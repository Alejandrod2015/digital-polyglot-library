/** `dick` es plaza de vocab en die-mappe-auf-dem-sofa y en el cuerpo sale
 *  flexionada ("einer dicken Mappe"), asi que el token nunca es `dick` y el
 *  rebuild no la pide. VocabPanel resuelve TAMBIEN por lema, asi que la
 *  entrada existe para el panel aunque el tap nunca la alcance. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "german-friends-a2";
const p = new PrismaClient();
(async () => {
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } });
  const g = fila!.glosses as Record<string, any>;
  g["dick"] = { g: "thick, with a lot of paper inside", t: "adjective" };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: g as never } });
  console.log("dick anadida al mapa global");
  await p.$disconnect();
})();
