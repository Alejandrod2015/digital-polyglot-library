/** Comprueba, una por una, que las huérfanas del A0 de España están de verdad
 *  muertas: su palabra no sale en el texto de la historia a la que van pegadas.
 *  Antes de borrar nada se mira, que el detector ya se equivocó una vez. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();
const B = "spanish-friends-spain-a0";
const CASOS: Array<[string, string[]]> = [
  ["la-barceloneta-despierta", ["e"]],
  ["lucia-llega-a-bilbao", ["e"]],
  ["el-museo-guggenheim", ["e"]],
  ["suena-la-plaza-mayor", ["e"]],
  ["naranjas-para-dos-amigas", ["e"]],
  ["pintxos-en-el-casco-viejo", ["e"]],
  ["naranjas-en-el-mercado", ["e"]],
  ["ane-trae-mas-pintxos", ["e", "en"]],
  ["la-boqueria-huele-a-fruta", ["se"]],
  ["un-funicular-hasta-igueldo", ["a", "e"]],
  ["la-nieve-de-sierra-nevada", ["e"]],
  ["las-tapas-son-gratis", ["a", "e"]],
  ["la-giralda-desde-arriba", ["e"]],
  ["paella-en-la-malvarrosa", ["e", "en"]],
  ["lucia-mira-la-sagrada-familia", ["e"]],
];

(async () => {
  for (const [slug, palabras] of CASOS) {
    const h = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
    const texto = `${h?.title ?? ""}. ${h?.text ?? ""}`.toLowerCase();
    for (const w of palabras) {
      const re = new RegExp(`(?<![\\p{L}\\p{M}])${w}(?![\\p{L}\\p{M}])`, "u");
      const m = texto.match(re);
      const donde = m ? texto.slice(Math.max(0, m.index! - 30), m.index! + 30).replace(/\s+/g, " ") : "";
      console.log(`${m ? "SALE " : "MUERTA"}  ${slug} · ${w}${donde ? `   …${donde}…` : ""}`);
    }
  }
  await p.$disconnect();
})();
