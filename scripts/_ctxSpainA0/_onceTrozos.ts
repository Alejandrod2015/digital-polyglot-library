/** Escribe el contexto de las once expresiones de spain-b2 que mi borrado
 *  dejo sin frase.
 *
 *  VocabPanel pinta `c.es` y `c.en` debajo de la definicion, asi que sin `c`
 *  esas once se abren mudas. No se recupera lo borrado (eso solo esta en el
 *  historial de la base): se escribe un trozo NUEVO desde la oracion real
 *  donde vive la expresion, tomando la SUPERFICIE, que es la forma que sale en
 *  el texto. El trozo es subcadena literal de esa oracion, como todos.
 *
 *  --escribe para escribir; sin bandera, solo comprueba que cada trozo sale
 *  tal cual y que el ingles cabe en el tope. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-traveler-spain-b2";
const p = new PrismaClient();

const ONCE: Array<{ slug: string; lema: string; es: string; en: string }> = [
  { slug: "las-llaves-de-la-pena", lema: "aburrirse", es: "que si se aburre", en: "or whether she is getting bored" },
  { slug: "las-llaves-de-la-pena", lema: "caer en la cuenta", es: "A la tercera vez cae en la cuenta", en: "The third time it dawns on her" },
  { slug: "las-llaves-de-la-pena", lema: "calentarse la cara", es: "se le calienta la cara", en: "her face goes hot" },
  { slug: "le-habian-guardado-tomates", lema: "salirse con la suya", es: "haberse salido con la suya", en: "having got her own way" },
  { slug: "la-copla-ya-lo-decia", lema: "picarse", es: "Claudia se pica", en: "Claudia takes offence" },
  { slug: "la-copla-ya-lo-decia", lema: "cortar por el mismo patrón", es: "están cortadas por el mismo patrón", en: "are cut from the same cloth" },
  { slug: "la-broma-se-queda-sola", lema: "lanzarse", es: "ve el hueco y se lanza", en: "sees the gap and goes for it" },
  { slug: "la-broma-se-queda-sola", lema: "dejarse querer", es: "Marcos se deja querer", en: "Marcos laps it up" },
  { slug: "de-eso-se-rie-marcos", lema: "ponerse a", es: "se pone a desmontar la primera estantería", en: "starts taking down the first shelf" },
  { slug: "lo-de-siempre-cadiz-b2", lema: "dar por sabido", es: "da su café por sabido", en: "takes his coffee as given" },
  { slug: "una-ronda-sin-dueno", lema: "darse por aludido", es: "nadie se da por aludido", en: "nobody takes the hint" },
];

(async () => {
  const escribe = process.argv.includes("--escribe");
  const hs = await p.journeyStory.findMany({
    where: { slug: { in: [...new Set(ONCE.map((o) => o.slug))] } },
    select: { slug: true, title: true, text: true },
  });
  const texto = new Map(hs.map((h) => [h.slug, `${h.title}. ${h.text}`]));
  let malos = 0;
  for (const o of ONCE) {
    const t = texto.get(o.slug) ?? "";
    const sale = t.includes(o.es);
    const nEs = o.es.split(/\s+/).length, nEn = o.en.split(/\s+/).length;
    const cabe = nEn <= nEs + 3;
    if (!sale || !cabe) { malos++; console.log(`MAL  ${o.lema}: ${sale ? "" : "el trozo no sale tal cual"} ${cabe ? "" : `ingles ${nEn} vs ${nEs}`}`); }
    else console.log(`ok   ${o.lema}  (${nEs} vs ${nEn})`);
  }
  if (malos) { console.log(`\n${malos} sin arreglar; NADA ESCRITO`); await p.$disconnect(); return; }
  if (!escribe) { console.log("\nlos once salen tal cual y caben; usa --escribe"); await p.$disconnect(); return; }

  for (const slug of new Set(ONCE.map((o) => o.slug))) {
    const fila = await p.tapGlossSet.findFirst({ where: { bundle: B, slug }, select: { glosses: true } });
    if (!fila) continue;
    const g = fila.glosses as Record<string, Record<string, unknown>>;
    for (const o of ONCE.filter((x) => x.slug === slug)) {
      if (!g[o.lema]) { console.log(`sin entrada: ${slug} · ${o.lema}`); continue; }
      g[o.lema] = { ...g[o.lema], c: { es: o.es, en: o.en } };
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
  }
  console.log("\nESCRITO");
  await p.$disconnect();
})();
