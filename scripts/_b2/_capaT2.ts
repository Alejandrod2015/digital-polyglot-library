/** Capa de contexto del tema 2 del B2 latam (fragmentos constituyentes). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "lo-conversamos": [
    { claves: ["chifa"], t: "noun", g: "Peruvian-Chinese restaurant", es: "en un chifa del jirón Ucayali", en: "in a chifa on Ucayali street" },
    { claves: ["wantán"], t: "noun", g: "fried wonton", es: "Pidió wantán de memoria", en: "ordered wonton from memory" },
    { claves: ["jirón"], t: "noun", g: "street (Lima word)", es: "del jirón Ucayali", en: "on Ucayali street" },
    { claves: ["combi"], t: "noun", g: "Peruvian minibus", es: "En la combi", en: "on the minibus" },
    { claves: ["lo conversamos"], t: "expression", g: "we will talk it over; a polite no", es: "Lo conversamos, señora", en: "we will talk it over, madam" },
    { claves: ["ya pues"], t: "expression", g: "alright then (Peruvian)", es: "lo conversamos, ya pues", en: "we will talk it over, alright then" },
    { claves: ["muestrario"], t: "noun", g: "sample book", es: "cruzó la ciudad con el muestrario nuevo", en: "crossed the city with the new sample book" },
    { claves: ["elogio"], t: "noun", g: "praise", es: "El elogio era la manera amable", en: "the praise was the kind way" },
    { claves: ["tela", "telas"], t: "noun", g: "fabric", es: "elogia cada tela", en: "praises every fabric" },
    { claves: ["costura"], t: "noun", g: "sewing", es: "Su taller de costura", en: "her sewing workshop" },
    { claves: ["palillos"], t: "noun", g: "chopsticks", es: "con los palillos en alto", en: "with his chopsticks raised" },
    { claves: ["apartar", "aparto"], t: "verb", g: "I set aside (apartar)", es: "¿Le aparto cien buzos", en: "shall I set aside a hundred tracksuits" },
    { claves: ["ahorita"], t: "adverb", g: "right now, or someday", es: "Ahorita andamos con campaña", en: "right now we are in campaign season" },
    { claves: ["desinflarse", "se desinfla"], t: "verb", g: "deflates (desinflarse)", es: "mientras el orgullo se desinfla", en: "while her pride deflates" },
    { claves: ["almorzar", "almorzando"], t: "verb", g: "having lunch (almorzar)", es: "se cierran almorzando", en: "get closed over lunch" },
    { claves: ["cortesía"], t: "noun", g: "courtesy", es: "la cortesía más cara del mes", en: "the most expensive courtesy of the month" },
    { claves: ["garabato"], t: "noun", g: "scribble", es: "Nadie apuntó ni un garabato", en: "nobody wrote down even a scribble" },
    { claves: ["directorio"], t: "noun", g: "board meeting (Peru)", es: "La que viene tengo directorio", en: "next week I have a board meeting" },
    { claves: ["quedar en nada", "quedó en nada"], t: "expression", g: "came to nothing", es: "nadie quedó en nada", en: "nobody agreed on anything" },
    { claves: ["a la altura de", "a la altura del"], t: "expression", g: "when passing", es: "a la altura del mercado", en: "when passing the market" }
  ],
  "el-telefono-boca-abajo": [
    { claves: ["al toque"], t: "expression", g: "right away (Peruvian)", es: "¿Me lo tiene al toque, señora?", en: "will you have it for me right away, madam" },
    { claves: ["casera"], t: "noun", g: "loyal customer (Peru)", es: "Su casera de los jueves", en: "her loyal Thursday customer" },
    { claves: ["emoliente"], t: "noun", g: "warm herbal street drink", es: "con el emoliente enfriándose", en: "with the emoliente getting cold" },
    { claves: ["buzo", "buzos"], t: "noun", g: "tracksuit (Peru)", es: "trescientos buzos con el logo", en: "three hundred tracksuits with the logo" },
    { claves: ["madrugada"], t: "noun", g: "the small hours", es: "cose de madrugada", en: "sews in the small hours" },
    { claves: ["culpa"], t: "noun", g: "guilt", es: "La culpa se queda despierta", en: "the guilt stays awake" },
    { claves: ["puntada"], t: "noun", g: "stitch", es: "Cada puntada a la medida del logo", en: "every stitch measured to the logo" },
    { claves: ["encargo"], t: "noun", g: "order, commission", es: "hay un solo encargo", en: "there is a single order" },
    { claves: ["exigente"], t: "adjective", g: "demanding", es: "Usted es más exigente que yo", en: "you are more demanding than me" },
    { claves: ["arreglo", "arreglos"], t: "noun", g: "alteration", es: "doce años de arreglos", en: "twelve years of alterations" },
    { claves: ["vestido"], t: "noun", g: "dress", es: "un vestido para entallar", en: "a dress to take in" },
    { claves: ["apurar", "apura"], t: "verb", g: "hurries (apurar)", es: "apura Aurelio por teléfono", en: "Aurelio presses her over the phone" },
    { claves: ["timbrar", "timbra"], t: "verb", g: "rings the doorbell (timbrar)", es: "timbra con un vestido", en: "rings the bell with a dress" },
    { claves: ["suspirar", "suspira"], t: "verb", g: "sighs (suspirar)", es: "Suspira y cose de madrugada", en: "she sighs and sews before dawn" },
    { claves: ["estrenar", "estrenando"], t: "verb", g: "using for the first time (estrenar)", es: "estrenando la palabra", en: "using the phrase for the first time" },
    { claves: ["adelantar", "adelanta"], t: "verb", g: "pays in advance (adelantar)", es: "si me adelanta la mitad", en: "if you pay me half in advance" },
    { claves: ["entallar"], t: "verb", g: "to take in a garment", es: "un vestido para entallar", en: "a dress to take in" },
    { claves: ["a la medida"], t: "expression", g: "made to measure", es: "a la medida del logo", en: "measured to the logo" },
    { claves: ["dejar plantado", "dejó plantada"], t: "expression", g: "stood her up", es: "La dejó plantada una vez", en: "she stood her up once" },
    { claves: ["boca abajo"], t: "expression", g: "face down", es: "el teléfono boca abajo", en: "the phone face down" }
  ],
  "una-yapa-para-cerrar": [
    { claves: ["chaufa"], t: "noun", g: "Peruvian-Chinese fried rice", es: "trae el chaufa sin que nadie lo pida", en: "brings the fried rice without being asked" },
    { claves: ["yapa"], t: "noun", g: "the free little extra", es: "¿Y mi yapa?", en: "and my little extra" },
    { claves: ["mozo"], t: "noun", g: "waiter", es: "El mozo grita el pedido", en: "the waiter shouts the order" },
    { claves: ["sobremesa"], t: "noun", g: "after-lunch table talk", es: "tan educado que parece sobremesa", en: "so polite it looks like table talk" },
    { claves: ["lapicero"], t: "noun", g: "pen (Peru)", es: "con el lapicero de ella", en: "with her pen" },
    { claves: ["regatear"], t: "verb", g: "to haggle", es: "sin decir la palabra regatear", en: "without saying the word haggle" },
    { claves: ["halago"], t: "noun", g: "flattery", es: "ella agradece el halago", en: "she thanks him for the flattery" },
    { claves: ["centavo"], t: "noun", g: "cent", es: "no suelta un centavo", en: "does not let go of a cent" },
    { claves: ["apretón"], t: "noun", g: "handshake", es: "con un apretón corto", en: "with a short handshake" },
    { claves: ["brindis"], t: "noun", g: "toast", es: "un apretón corto y un brindis", en: "a short handshake and a toast" },
    { claves: ["acordar", "acuerdan"], t: "verb", g: "they agree on (acordar)", es: "Acuerdan la cifra a medias", en: "they agree on the figure halfway" },
    { claves: ["redondear", "redondeamos"], t: "verb", g: "we round up (redondear)", es: "redondeamos para arriba", en: "we round upwards" },
    { claves: ["de reojo"], t: "expression", g: "out of the corner of the eye", es: "mirando de reojo la fuente vacía", en: "eyeing the empty dish sideways" },
    { claves: ["cerrar el trato", "cierran el trato"], t: "expression", g: "close the deal", es: "Cierran el trato con un apretón", en: "they close the deal with a handshake" },
    { claves: ["hacerse de rogar", "se hace de rogar"], t: "expression", g: "plays hard to get", es: "él se hace de rogar", en: "he plays hard to get" },
    { claves: ["toma y daca"], t: "expression", g: "give and take", es: "Un toma y daca tan educado", en: "such a polite give and take" },
    { claves: ["sacar en limpio", "sacan en limpio"], t: "expression", g: "write out the final version", es: "la sacan en limpio en una servilleta", en: "they write the clean version on a napkin" },
    { claves: ["a medias"], t: "expression", g: "halfway", es: "la cifra a medias", en: "the figure split halfway" },
    { claves: ["de estreno"], t: "expression", g: "brand new", es: "Ese precio fue de estreno", en: "that price was a first-time price" },
    { claves: ["para arriba"], t: "expression", g: "upwards", es: "redondeamos para arriba", en: "we round upwards" }
  ]
};
(async () => {
  const p = new PrismaClient();
  let escritas = 0;
  for (const [slug, entradas] of Object.entries(CAPA)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...((fila?.glosses ?? {}) as Record<string, unknown>) } as Record<string, unknown>;
    for (const e of entradas) {
      if (e.es.split(/\s+/).length > 8) throw new Error(`trozo de mas de 8 palabras: ${e.es}`);
      for (const k of e.claves) { g[k] = { g: e.g, t: e.t, c: { es: e.es, en: e.en }, rev: true }; escritas++; }
    }
    await p.tapGlossSet.upsert({
      where: { bundle_slug: { bundle: B, slug } },
      create: { bundle: B, slug, language: "spanish", variant: "latam", slugs: [], glosses: g as never },
      update: { glosses: g as never },
    });
  }
  console.log(`claves escritas ${escritas}`);
  await p.$disconnect();
})();
