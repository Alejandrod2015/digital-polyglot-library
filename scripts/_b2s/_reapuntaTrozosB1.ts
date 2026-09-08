import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b1";
type F = { es: string; en: string } | null;
const PLAN: Record<string, Record<string, F>> = {
  "a-ver-si-te-sigo": {
    "con": { es: "con la compra en el suelo", en: "with the shopping on the floor" },
    "propias": { es: "con sus propias palabras", en: "in her own words" },
    "palabras": { es: "con sus propias palabras", en: "in her own words" },
    "mis": null,
  },
  "cobro-tarde-y-pago-pronto": {
    "cuota": { es: "se paga la cuota", en: "the fee gets paid" },
    "no": { es: "no es que gane poco", en: "it is not that she earns little" },
    "espera": null,
  },
  "el-descansillo-aconseja": {
    "es": { es: "es tu trabajo", en: "it is your job" },
    "trabajo": { es: "es tu trabajo", en: "it is your job" },
    "cobrar": null, "otro": null,
  },
  "el-piloto-azul": {
    "técnico": { es: "el técnico del gas", en: "the gas repairman" },
    "habla": null, "rápido": null,
  },
  "el-precio-que-existe": {
    "negocia": { es: "la tarifa no se negocia", en: "the rate is not negotiated" },
    "no": { es: "la tarifa no se negocia", en: "the rate is not negotiated" },
  },
  "el-techo-de-los-tres": {
    "mayoría": { es: "por mayoría", en: "by majority" },
    "techo": { es: "el techo y poco más", en: "the roof and little else" },
    "decide": null,
  },
  "el-tejado-a-la-mitad": {
    "techo": { es: "el mismo techo dentro", en: "the same roof inside them" },
    "precios": null,
  },
  "la-cerradura-la-cambio-yo": {
    "no": { es: "no cierra a la primera", en: "does not shut first try" },
    "que": { es: "la habitación que le han enseñado", en: "the room they have shown her" },
    "sí": null,
  },
  "la-manta-del-altillo": {
    "arriba": { es: "arriba hay dos", en: "upstairs there are two" },
    "alguien": { es: "es alguien que vive ahí", en: "it is someone who lives there" },
    "vive": { es: "alguien que vive ahí", en: "someone who lives there" },
  },
  "la-rebaja-en-mano": {
    "en": { es: "más barato en mano", en: "cheaper cash in hand" },
    "mano": { es: "más barato en mano", en: "cheaper cash in hand" },
    "sin": { es: "sin factura no puedo", en: "without an invoice I cannot" },
    "factura": { es: "sin factura no puedo", en: "without an invoice I cannot" },
    "y": { es: "de Berta y suya", en: "Berta's and her own" },
  },
  "la-reunion-de-un-punto": {
    "horas": { es: "solo tres horas", en: "only three hours" },
    "por": { es: "punto por punto", en: "point by point" },
    "punto": { es: "punto por punto", en: "point by point" },
  },
  "la-ventana-del-rellano": {
    "retraso": { es: "el retraso era suyo", en: "the delay was theirs" },
    "suyo": { es: "el retraso era suyo", en: "the delay was theirs" },
    "no": { es: "el plazo no", en: "but not the deadline" },
    "es": { es: "eso es una costumbre", en: "that is a custom" },
  },
  "la-voz-mas-rapida": {
    "se": { es: "se lo digo yo", en: "I am telling him myself" },
    "lo": { es: "se lo digo yo", en: "I am telling him myself" },
    "digo": { es: "se lo digo yo", en: "I am telling him myself" },
    "yo": { es: "se lo digo yo", en: "I am telling him myself" },
    "primero": { es: "lo sabrá usted primero", en: "you will know it first" },
  },
  "lo-de-chispa": {
    "chispa": { es: "lo de Chispa", en: "the Chispa thing" },
    "dicen": { es: "le dicen el Mudanzas", en: "they call him el Mudanzas" },
    "le": { es: "le dicen el Mudanzas", en: "they call him el Mudanzas" },
    "por": { es: "será por lo simpático", en: "must be because he is friendly" },
    "qué": null,
  },
  "lo-pongo-por-escrito": {
    "papel": { es: "alrededor de un papel", en: "around a piece of paper" },
    "donde": { es: "donde lo ve todo el que entra", en: "where everyone coming in sees it" },
    "ve": { es: "donde lo ve todo el que entra", en: "where everyone coming in sees it" },
    "se": { es: "el papel se queda en el tablón", en: "the paper stays on the board" },
  },
  "manana-y-yo-sola": {
    "reunión": { es: "convoca una reunión", en: "calls a meeting" },
    "sin": { es: "sin orden del día", en: "with no agenda" },
    "orden": { es: "sin orden del día", en: "with no agenda" },
    "del": { es: "sin orden del día", en: "with no agenda" },
    "día": { es: "sin orden del día", en: "with no agenda" },
  },
  "mira-la-apuntadora": {
    "mote": { es: "escribe el mote", en: "writes the nickname down" },
    "nueva": { es: "es la nueva", en: "she is the new one" },
    "ya": { es: "ya lleva medio año", en: "has already been here half a year" },
    "tiene": null,
  },
  "palabra-por-palabra": {
    "lo": { es: "sí lo dijo", en: "she did say it" },
    "que": { es: "de que sí lo dijo", en: "that she did say it" },
    "por": { es: "palabra por palabra", en: "word for word" },
    "corre": null, "portal": null,
  },
  "poco-y-de-oidas": {
    "eso": { es: "eso yo no lo cuento", en: "that I do not spread around" },
    "no": { es: "eso yo no lo cuento", en: "that I do not spread around" },
    "lo": { es: "eso yo no lo cuento", en: "that I do not spread around" },
    "repito": null,
  },
};
const norm = (s: string) => s.toLowerCase().normalize("NFC");
(async () => {
  let re = 0, borr = 0;
  for (const [slug, cambios] of Object.entries(PLAN)) {
    const st = await p.journeyStory.findFirst({ where: { slug, journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { text: true, title: true } });
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    if (!st || !fila) throw new Error(`falta ${slug}`);
    const todo = norm(st.title + "\n" + st.text);
    const g = { ...(fila.glosses as Record<string, any>) };
    for (const [w, f] of Object.entries(cambios)) {
      if (f === null) {
        if (todo.match(new RegExp(`(^|[^\\p{L}])${w.toLowerCase()}([^\\p{L}]|$)`, "u"))) throw new Error(`${slug}/${w}: iba a borrarse pero SIGUE tocable`);
        delete g[w]; borr++;
      } else {
        if (!todo.includes(norm(f.es))) throw new Error(`${slug}/${w}: "${f.es}" no es subcadena`);
        if (!norm(f.es).includes(w.toLowerCase())) throw new Error(`${slug}/${w}: el trozo no contiene la palabra`);
        g[w] = { ...(g[w] ?? {}), c: { es: f.es, en: f.en } }; re++;
      }
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  console.log(`reapuntados ${re} · borrados ${borr}`);
  await p.$disconnect();
})();
