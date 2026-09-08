/** Renombra las filas de tapGlossSet del bundle B2 al slug nuevo y sincroniza la lista `slugs` de la fila global. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const MAPA: Record<string, string> = {
  "las-llaves-de-la-pena": "el-cafe-lo-pones-tu",
  "le-habian-guardado-tomates": "la-bolsa-como-prueba",
  "la-sobremesa": "la-sobremesa-se-estira",
  "la-copla-ya-lo-decia": "la-guasa-del-domingo",
  "la-broma-se-queda-sola": "un-mantel-mojado",
  "de-eso-se-rie-marcos": "ya-no-va-a-cerrar-nada",
  "lo-de-siempre-cadiz-b2": "apuntame-la-de-manana",
  "aqui-se-apunta": "la-cana-de-marcos",
  "una-ronda-sin-dueno": "la-cuenta-perdida",
  "el-ano-que-falta": "la-persiana-a-media-tarde",
  "decide-tu": "yo-ya-decidi-una-vez",
  "una-copla-sin-cantar": "una-copla-sin-firma",
  "un-barco-para-la-pena": "el-levante-del-jueves",
  "el-levante-manda": "azotea-y-paciencia",
  "fecha-a-lapiz": "la-herramienta-seria",
  "de-trabajo-o-de-vivir": "vuelva-cuando-quiera",
  "este-no-todavia": "el-tomo-aparte",
  "los-libros-vuelven-a-casa": "la-balda-del-medio",
  "quien-baja-del-tren": "una-agenda-de-desconocida",
  "la-ultima-llave": "amanece-con-poniente",
  "una-copla-con-su-nombre": "me-lo-he-ganado",
};
(async () => {
  const viejos = process.argv.slice(2);
  for (const viejo of viejos) {
    const nuevo = MAPA[viejo];
    if (!nuevo) throw new Error(`sin mapa para ${viejo}`);
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: viejo } }, data: { slug: nuevo } });
    console.log(`  glosas ${viejo} -> ${nuevo}`);
  }
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } });
  const lista = (g!.slugs as string[]).map((s) => (viejos.includes(s) ? MAPA[s] : s));
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { slugs: lista } });
  console.log("  global slugs:", lista.length, "entradas sincronizadas");
  await p.$disconnect();
})();
