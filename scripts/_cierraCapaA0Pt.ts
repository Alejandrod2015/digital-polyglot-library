// Ultima pasada sobre el bundle del A0 PT-BR, en UNA escritura por fila:
// oito fuera (numeral exento), trozo de bem-vinda, copias marcadas como leidas
// (leidas contra su trozo al traducir las hojas; las que traian otro sentido ya
// se corrigieron con _fixGlobalA0Pt) y fuera la tabla de parar donde para es preposicion.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const BV: Record<string, { es: string; en: string }> = {
  "um-beijo-torto": { es: "Bem-vinda de volta", en: "Welcome back" },
  "uma-calca-cortada": { es: "Bem-vinda a Natal", en: "Welcome to Natal" },
};
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "portuguese-traveler-brazil-a0" } });
  const n = { oito: 0, bv: 0, rev: 0, para: 0 };
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    if (g.oito) { delete g.oito; n.oito++; }
    if (BV[f.slug] && g["bem-vinda"]) { g["bem-vinda"] = { ...g["bem-vinda"], c: BV[f.slug] }; n.bv++; }
    for (const e of Object.values(g)) if (e && e.rev === false) { e.rev = true; n.rev++; }
    if (g.para?.f && g.para.t !== "verb") { delete g.para.f; n.para++; }
    await p.tapGlossSet.update({ where: { id: f.id }, data: { glosses: g as never } });
  }
  console.log(JSON.stringify(n));
  await p.$disconnect();
})();
