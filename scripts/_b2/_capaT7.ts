/** Capa de contexto del tema 7 del B2 latam. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "de-medio-metro-y-gracias": [
    { claves: ["cuentero"], t: "noun", g: "storyteller (Colombia)", es: "Baldomero era el cuentero de Aracataca", en: "Baldomero was Aracataca's storyteller" },
    { claves: ["hospedaje"], t: "noun", g: "guesthouse", es: "dueña del hospedaje", en: "owner of the guesthouse" },
    { claves: ["ciénaga"], t: "noun", g: "marsh", es: "De la ciénaga sacaban pescados", en: "they pulled fish out of the marsh" },
    { claves: ["mochilero", "mochileros"], t: "noun", g: "backpacker", es: "mochileros, guarapo frío con hielo", en: "backpackers, cold guarapo with ice" },
    { claves: ["guarapo"], t: "noun", g: "sugarcane drink", es: "guarapo frío con hielo", en: "cold guarapo with ice" },
    { claves: ["mecedora"], t: "noun", g: "rocking chair", es: "Baldomero en la mecedora", en: "Baldomero in the rocking chair" },
    { claves: ["agrandar", "agrandando"], t: "verb", g: "makes bigger (agrandar)", es: "cuarenta años agrandando el pueblo", en: "forty years making the town bigger" },
    { claves: ["echar carreta"], t: "expression", g: "spin yarns (Colombia)", es: "Echar carreta afuera también era arte", en: "spinning yarns outside was also an art" },
    { claves: ["firmar", "firmaba"], t: "verb", g: "signed (firmar)", es: "sin saber qué firmaba", en: "without knowing what he was signing" },
    { claves: ["corregir", "corrigió"], t: "verb", g: "corrected (corregir)", es: "corrigió Ofelia, como si nada", en: "Ofelia corrected, as if it were nothing" },
    { claves: ["cargar", "cargaban"], t: "verb", g: "they carried (cargar)", es: "Los cargaban entre cuatro", en: "it took four to carry them" },
    { claves: ["apostar", "apostado"], t: "verb", g: "it is a bet (apostar)", es: "Apostado", en: "it is a bet" },
    { claves: ["rodilla"], t: "noun", g: "knee", es: "libreta en rodilla", en: "notebook on his knee" },
    { claves: ["techo"], t: "noun", g: "roof", es: "desde el andén, sin techo", en: "from the sidewalk, with no roof" },
    { claves: ["cielo"], t: "noun", g: "sky", es: "el cielo no avisaba", en: "the sky gave no warning" },
    { claves: ["avisar", "avisaba"], t: "verb", g: "warned (avisar)", es: "el cielo no avisaba", en: "the sky gave no warning" },
    { claves: ["salir cierto", "salga cierta"], t: "expression", g: "turn out true", es: "La historia que salga cierta", en: "the story that turns out true" },
    { claves: ["mientras tanto"], t: "expression", g: "meanwhile", es: "Mientras tanto, me cuenta afuera", en: "meanwhile, you tell them to me outside" },
    { claves: ["y gracias"], t: "expression", g: "and nothing more", es: "Medio metro, y gracias", en: "half a metre, and that is being generous" },
    { claves: ["en otra parte"], t: "expression", g: "somewhere else", es: "paciencia en otra parte", en: "her patience somewhere else" }
  ],
  "la-carreta-mojada": [
    { claves: ["aguacero"], t: "noun", g: "tropical downpour", es: "El aguacero llegó sin aviso", en: "the downpour arrived without warning" },
    { claves: ["bulla"], t: "noun", g: "happy noise (Colombia)", es: "no hubo bulla", en: "there was no happy noise" },
    { claves: ["empapado", "empapada"], t: "adjective", g: "soaked through", es: "la libreta ya iba empapada", en: "the notebook was already soaked" },
    { claves: ["manotear", "manoteando"], t: "verb", g: "flailing at (manotear)", es: "manoteando el aguacero", en: "flailing at the downpour" },
    { claves: ["toalla", "toallas"], t: "noun", g: "towel", es: "cortó Ofelia, con toallas", en: "Ofelia cut in, carrying towels" },
    { claves: ["plancha"], t: "noun", g: "iron", es: "la plancha no resucita tinta", en: "an iron does not bring ink back" },
    { claves: ["piedrita", "piedritas"], t: "noun", g: "little stone", es: "piedritas encima, una por una", en: "little stones on top, one by one" },
    { claves: ["gigante"], t: "adjective", g: "giant", es: "el pescado gigante", en: "the giant fish" },
    { claves: ["resucitar", "resucita"], t: "verb", g: "revives (resucitar)", es: "la plancha no resucita tinta", en: "an iron does not bring ink back" },
    { claves: ["techado"], t: "adjective", g: "roofed", es: "cuando llegó al corredor techado", en: "when he reached the roofed porch" },
    { claves: ["armado", "armada"], t: "adjective", g: "set up", es: "la rueda de mochileros armada", en: "the circle of backpackers already formed" },
    { claves: ["rueda"], t: "noun", g: "storyteller's circle", es: "La rueda se desinfló sola", en: "the circle deflated on its own" },
    { claves: ["vuelto agua"], t: "expression", g: "turned to water", es: "Todo vuelto agua sucia", en: "everything turned to dirty water" },
    { claves: ["hacer lo suyo", "hizo lo suyo"], t: "expression", g: "did its work", es: "El agua ya hizo lo suyo", en: "the water already did its work" },
    { claves: ["poner a secar", "a secar"], t: "expression", g: "lay out to dry", es: "Puso las hojas a secar", en: "laid the pages out to dry" },
    { claves: ["de las suyas"], t: "expression", g: "one of your own", es: "una de memoria, de las suyas", en: "one from memory, one of your own" },
    { claves: ["hoja por hoja"], t: "expression", g: "page by page", es: "de a poco, hoja por hoja", en: "little by little, page by page" },
    { claves: ["una por una"], t: "expression", g: "one by one", es: "piedritas encima, una por una", en: "little stones on top, one by one" },
    { claves: ["sin decir palabra"], t: "expression", g: "without a word", es: "una por una, sin decir palabra", en: "one by one, without a word" },
    { claves: ["invita la casa"], t: "expression", g: "on the house", es: "Invita la casa, cuentero", en: "it is on the house, storyteller" }
  ],
  "la-historia-sin-agrandar": [
    { claves: ["álbum"], t: "noun", g: "photo album", es: "hojeó a escondidas el álbum", en: "leafed secretly through the album" },
    { claves: ["retrato"], t: "noun", g: "photograph", es: "un retrato amarillento", en: "a yellowed photograph" },
    { claves: ["amarillento"], t: "adjective", g: "yellowed", es: "un retrato amarillento", en: "a yellowed photograph" },
    { claves: ["tal cual"], t: "expression", g: "exactly like that", es: "Tal cual la contaba usted", en: "exactly the way you told it" },
    { claves: ["al pie de la letra"], t: "expression", g: "to the letter", es: "Salió cierta, al pie de la letra", en: "it turned out true, to the letter" },
    { claves: ["frenarse", "se frenaba"], t: "verb", g: "stopped himself (frenarse)", es: "se frenaba a media historia", en: "stopped himself mid-story" },
    { claves: ["esquina", "esquinas"], t: "noun", g: "photo corner", es: "pegado con esquinas negras", en: "held by little black corners" },
    { claves: ["cargado"], t: "adjective", g: "loaded", es: "cargado de pescado hasta el techo", en: "loaded with fish up to the roof" },
    { claves: ["sonreír", "sonriendo"], t: "verb", g: "smiling (sonreír)", es: "un hombre sonriendo al lado", en: "a man smiling beside it" },
    { claves: ["levantar", "levantó"], t: "verb", g: "raised (levantar)", es: "levantó el retrato para que lo vieran", en: "raised the photo so they could see it" },
    { claves: ["recibir", "recibió"], t: "verb", g: "received (recibir)", es: "Baldomero recibió la foto", en: "Baldomero took the photo" },
    { claves: ["condición"], t: "noun", g: "condition", es: "Con una condición", en: "on one condition" },
    { claves: ["arrastrar", "arrastró"], t: "verb", g: "dragged (arrastrar)", es: "arrastró la mecedora puerta adentro", en: "dragged the rocking chair inside" },
    { claves: ["mirar largo", "miró largo"], t: "expression", g: "look at it long", es: "la miró largo", en: "looked at it long and slow" },
    { claves: ["en vez de"], t: "expression", g: "instead of", es: "en vez de decir se lo dije", en: "instead of saying I told you so" },
    { claves: ["se lo dije"], t: "expression", g: "I told you so", es: "en vez de decir se lo dije", en: "instead of saying I told you so" },
    { claves: ["puerta adentro"], t: "expression", g: "in through the door", es: "la mecedora puerta adentro", en: "the rocking chair in through the door" },
    { claves: ["a media historia"], t: "expression", g: "mid-story", es: "se frenaba a media historia", en: "stopped himself mid-story" },
    { claves: ["quedarse con", "se la podía quedar"], t: "expression", g: "keep it", es: "preguntó si se la podía quedar", en: "asked if he could keep it" },
    { claves: ["a plena luz"], t: "expression", g: "in full daylight", es: "una tarde llena, a plena luz", en: "one full afternoon, in plain daylight" }
  ]
};
(async () => {
  const p = new PrismaClient();
  let n = 0;
  for (const [slug, entradas] of Object.entries(CAPA)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...((fila?.glosses ?? {}) as Record<string, unknown>) } as Record<string, unknown>;
    for (const e of entradas) {
      if (e.es.split(/\s+/).length > 8) throw new Error(`trozo largo: ${slug} ${e.claves[0]}: ${e.es}`);
      for (const k of e.claves) { g[k] = { g: e.g, t: e.t, c: { es: e.es, en: e.en }, rev: true }; n++; }
    }
    await p.tapGlossSet.upsert({
      where: { bundle_slug: { bundle: B, slug } },
      create: { bundle: B, slug, language: "spanish", variant: "latam", slugs: [], glosses: g as never },
      update: { glosses: g as never },
    });
  }
  console.log(`claves escritas ${n}`);
  await p.$disconnect();
})();
