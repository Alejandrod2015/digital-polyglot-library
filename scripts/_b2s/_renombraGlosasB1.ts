import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b1";
const MAPA: Record<string, string> = {
  "celia-no-dice-que-si": "la-cerradura-la-cambio-yo",
  "arriba-vive-alguien": "la-manta-del-altillo",
  "la-mayoria-decide-el-techo": "el-techo-de-los-tres",
  "nuria-no-negocia": "el-precio-que-existe",
  "la-cuota-no-espera": "cobro-tarde-y-pago-pronto",
  "cobrar-es-otro-trabajo": "el-descansillo-aconseja",
  "tres-horas-por-un-punto": "la-reunion-de-un-punto",
  "el-retraso-no-es-suyo": "la-ventana-del-rellano",
  "reunion-sin-orden-del-dia": "manana-y-yo-sola",
  "el-tecnico-habla-rapido": "el-piloto-azul",
  "con-mis-propias-palabras": "a-ver-si-te-sigo",
  "la-linea-se-corta": "la-fecha-que-decide",
  "por-que-le-dicen-chispa": "lo-de-chispa",
  "el-horno-y-los-bollos": "un-favor-sin-pedir",
  "la-nueva-ya-tiene-mote": "mira-la-apuntadora",
  "dos-precios-un-techo": "el-tejado-a-la-mitad",
  "en-mano-y-sin-factura": "la-rebaja-en-mano",
  "el-papel-donde-se-ve": "lo-pongo-por-escrito",
  "lo-que-corre-por-el-portal": "palabra-por-palabra",
  "se-lo-digo-yo-primero": "la-voz-mas-rapida",
  "eso-no-lo-repito": "poco-y-de-oidas",
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
  console.log("  global slugs:", lista.length, "sincronizadas");
  await p.$disconnect();
})();
