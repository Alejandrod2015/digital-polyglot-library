/** Capa de contexto del tema 7 del B2 latam. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "pescados-de-dos-metros": [
    { claves: ["cuentero"], t: "noun", g: "storyteller (Colombia)", es: "Baldomero es el cuentero de Aracataca", en: "Baldomero is Aracataca's storyteller" },
    { claves: ["hospedaje"], t: "noun", g: "guesthouse", es: "el corredor del hospedaje?? no: dueña del hospedaje", en: "owner of the guesthouse" },
    { claves: ["ciénaga"], t: "noun", g: "marsh", es: "De la ciénaga sacaban pescados", en: "they pulled fish out of the marsh" },
    { claves: ["mochilero", "mochileros"], t: "noun", g: "backpacker", es: "mochileros, guarapo frío con hielo", en: "backpackers, cold guarapo with ice" },
    { claves: ["guarapo"], t: "noun", g: "sugarcane drink", es: "guarapo frío con hielo", en: "cold guarapo with ice" },
    { claves: ["mecedora"], t: "noun", g: "rocking chair", es: "Baldomero en la mecedora", en: "Baldomero in the rocking chair" },
    { claves: ["agrandar", "agrandando"], t: "verb", g: "makes bigger (agrandar)", es: "cuarenta años agrandando el pueblo", en: "forty years making the town bigger" },
    { claves: ["echar carreta"], t: "expression", g: "spin yarns (Colombia)", es: "Echar carreta afuera también es arte", en: "spinning yarns outside is also an art" },
    { claves: ["arrancar", "arranca"], t: "verb", g: "launches into (arrancar)", es: "arranca él", en: "he launches in" },
    { claves: ["corregir", "corrige"], t: "verb", g: "corrects (corregir)", es: "corrige Ofelia, como si nada", en: "Ofelia corrects, as if it were nothing" },
    { claves: ["cargar", "cargaban"], t: "verb", g: "they carried (cargar)", es: "Los cargaban entre cuatro", en: "it took four to carry them" },
    { claves: ["apostar", "apostemos"], t: "verb", g: "let us bet (apostar)", es: "Apostemos: vamos a subir la apuesta", en: "let us bet: let us raise the stakes" },
    { claves: ["rodilla"], t: "noun", g: "knee", es: "libreta en rodilla", en: "notebook on his knee" },
    { claves: ["techo"], t: "noun", g: "roof", es: "desde el andén, sin techo", en: "from the sidewalk, with no roof" },
    { claves: ["cielo"], t: "noun", g: "sky", es: "el cielo no avisa", en: "the sky gives no warning" },
    { claves: ["avisar", "avisa"], t: "verb", g: "warns (avisar)", es: "el cielo no avisa", en: "the sky gives no warning" },
    { claves: ["salir cierto", "salga cierta"], t: "expression", g: "turn out true", es: "La historia que salga cierta", en: "the story that turns out true" },
    { claves: ["mientras tanto"], t: "expression", g: "meanwhile", es: "Mientras tanto, me cuenta afuera", en: "meanwhile, you tell them to me outside" },
    { claves: ["y gracias"], t: "expression", g: "and nothing more", es: "medio metro, y gracias", en: "half a metre, and that is being generous" },
    { claves: ["en otra parte"], t: "expression", g: "somewhere else", es: "paciencia en otra parte", en: "her patience somewhere else" }
  ],
  "el-aguacero": [
    { claves: ["aguacero"], t: "noun", g: "tropical downpour", es: "El aguacero llega sin aviso", en: "the downpour arrives without warning" },
    { claves: ["bulla"], t: "noun", g: "happy noise (Colombia)", es: "no hay bulla", en: "there is no happy noise" },
    { claves: ["empapado", "empapada"], t: "adjective", g: "soaked through", es: "la libreta ya va empapada", en: "the notebook is already soaked" },
    { claves: ["manotear", "manoteando"], t: "verb", g: "flailing at (manotear)", es: "manoteando el aguacero", en: "flailing at the downpour" },
    { claves: ["toalla", "toallas"], t: "noun", g: "towel", es: "corta Ofelia, con toallas", en: "Ofelia cuts in, carrying towels" },
    { claves: ["plancha"], t: "noun", g: "iron", es: "la plancha no resucita tinta", en: "an iron does not bring ink back" },
    { claves: ["piedrita", "piedritas"], t: "noun", g: "little stone", es: "piedritas encima, una por una", en: "little stones on top, one by one" },
    { claves: ["gigante"], t: "adjective", g: "giant", es: "el pescado gigante", en: "the giant fish" },
    { claves: ["resucitar", "resucita"], t: "verb", g: "revives (resucitar)", es: "la plancha no resucita tinta", en: "an iron does not bring ink back" },
    { claves: ["techado"], t: "adjective", g: "roofed", es: "cuando llega al corredor techado", en: "when he reaches the roofed porch" },
    { claves: ["armado", "armada"], t: "adjective", g: "set up", es: "la rueda de mochileros armada", en: "the circle of backpackers already formed" },
    { claves: ["rueda"], t: "noun", g: "storyteller's circle", es: "La rueda se desinfla sola", en: "the circle deflates on its own" },
    { claves: ["vuelto agua"], t: "expression", g: "turned to water", es: "Todo vuelto agua sucia", en: "everything turned to dirty water" },
    { claves: ["hacer lo suyo", "hizo lo suyo"], t: "expression", g: "did its work", es: "El agua ya hizo lo suyo", en: "the water already did its work" },
    { claves: ["poner a secar", "a secar"], t: "expression", g: "lay out to dry", es: "Pone las hojas a secar", en: "lays the pages out to dry" },
    { claves: ["de las suyas"], t: "expression", g: "one of your own", es: "una de memoria, de las suyas", en: "one from memory, one of your own" },
    { claves: ["hoja por hoja"], t: "expression", g: "page by page", es: "de a poco, hoja por hoja", en: "little by little, page by page" },
    { claves: ["una por una"], t: "expression", g: "one by one", es: "piedritas encima, una por una", en: "little stones on top, one by one" },
    { claves: ["sin decir palabra"], t: "expression", g: "without a word", es: "una por una, sin decir palabra", en: "one by one, without a word" },
    { claves: ["invita la casa"], t: "expression", g: "on the house", es: "Invita la casa, cuentero", en: "it is on the house, storyteller" }
  ],
  "tal-cual-la-contaba": [
    { claves: ["álbum"], t: "noun", g: "photo album", es: "hojea a escondidas el álbum", en: "leafs secretly through the album" },
    { claves: ["retrato"], t: "noun", g: "photograph", es: "un retrato amarillento", en: "a yellowed photograph" },
    { claves: ["amarillento"], t: "adjective", g: "yellowed", es: "un retrato amarillento", en: "a yellowed photograph" },
    { claves: ["tal cual"], t: "expression", g: "exactly like that", es: "Tal cual la contaba usted", en: "exactly the way you told it" },
    { claves: ["al pie de la letra"], t: "expression", g: "to the letter", es: "Salió cierta, al pie de la letra", en: "it turned out true, to the letter" },
    { claves: ["frenarse", "se frena"], t: "verb", g: "stops himself (frenarse)", es: "se frena a media historia", en: "stops himself mid-story" },
    { claves: ["esquina", "esquinas"], t: "noun", g: "photo corner", es: "pegado con esquinas negras", en: "held by little black corners" },
    { claves: ["cargado"], t: "adjective", g: "loaded", es: "cargado de pescado hasta el techo", en: "loaded with fish up to the roof" },
    { claves: ["sonreír", "sonriendo"], t: "verb", g: "smiling (sonreír)", es: "un hombre sonriendo al lado", en: "a man smiling beside it" },
    { claves: ["levantar", "levanta"], t: "verb", g: "raises (levantar)", es: "levanta el retrato para todos", en: "raises the photo for everyone" },
    { claves: ["recibir", "recibe"], t: "verb", g: "receives (recibir)", es: "Baldomero recibe la foto", en: "Baldomero receives the photo" },
    { claves: ["condición"], t: "noun", g: "condition", es: "Con una condición", en: "on one condition" },
    { claves: ["arrastrar", "arrastra"], t: "verb", g: "drags (arrastrar)", es: "arrastra la mecedora puerta adentro", en: "drags the rocking chair inside" },
    { claves: ["mirar largo", "mira largo"], t: "expression", g: "look at it long", es: "la mira largo", en: "looks at it long and slow" },
    { claves: ["en vez de"], t: "expression", g: "instead of", es: "en vez de decir se lo dije", en: "instead of saying I told you so" },
    { claves: ["se lo dije"], t: "expression", g: "I told you so", es: "en vez de decir se lo dije", en: "instead of saying I told you so" },
    { claves: ["puerta adentro"], t: "expression", g: "in through the door", es: "la mecedora puerta adentro", en: "the rocking chair in through the door" },
    { claves: ["a media historia"], t: "expression", g: "mid-story", es: "se frena a media historia", en: "stops himself mid-story" },
    { claves: ["quedarse con", "se la puede quedar"], t: "expression", g: "keep it", es: "pregunta si se la puede quedar", en: "asks if he can keep it" },
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
