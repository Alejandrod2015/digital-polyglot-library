/** La oracion real donde vive cada una de las once expresiones que perdieron
 *  su contexto. VocabPanel pinta `c.es` y `c.en` como linea de frase
 *  (VocabPanel.tsx, el bloque de glossEntry?.c), asi que sin `c` esas once se
 *  abren sin frase. Se busca por la SUPERFICIE, que es la forma que sale en el
 *  texto; el lema no sale nunca. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();
const ONCE: Array<[string, string, string]> = [
  ["las-llaves-de-la-pena", "aburrirse", "se aburre"],
  ["las-llaves-de-la-pena", "caer en la cuenta", "cae en la cuenta"],
  ["las-llaves-de-la-pena", "calentarse la cara", "se le calienta la cara"],
  ["le-habian-guardado-tomates", "salirse con la suya", "salido con la suya"],
  ["la-copla-ya-lo-decia", "picarse", "se pica"],
  ["la-copla-ya-lo-decia", "cortar por el mismo patrón", "cortadas por el mismo patrón"],
  ["la-broma-se-queda-sola", "lanzarse", "se lanza"],
  ["la-broma-se-queda-sola", "dejarse querer", "se deja querer"],
  ["de-eso-se-rie-marcos", "ponerse a", "se pone a"],
  ["lo-de-siempre-cadiz-b2", "dar por sabido", "por sabido"],
  ["una-ronda-sin-dueno", "darse por aludido", "se da por aludido"],
];

(async () => {
  for (const [slug, lema, sup] of ONCE) {
    const h = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
    const texto = `${h?.title ?? ""}. ${h?.text ?? ""}`;
    const frase = texto.split(/(?<=[.!?…][”"]?)\s+|\n+/)
      .find((f) => f.toLowerCase().includes(sup.toLowerCase()));
    console.log(`\n${lema}   [${sup}]   ${slug}`);
    console.log(`  ${frase?.trim() ?? "(NO LA ENCUENTRO)"}`);
  }
  await p.$disconnect();
})();
