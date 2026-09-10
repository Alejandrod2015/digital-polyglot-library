/** Capa de contexto del tema 3 del B2 latam (fragmentos constituyentes). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "la-once-con-chirrido": [
    { claves: ["maestro"], t: "noun", g: "master (Chilean address for a tradesman)", es: "¿Y ese ruido nuevo, maestro?", en: "and that new noise, maestro" },
    { claves: ["mantención"], t: "noun", g: "maintenance (Chile)", es: "La mantención, por la rejilla, se veía así", en: "the maintenance, through the grille, looked like this" },
    { claves: ["al tiro"], t: "expression", g: "right away (Chile)", es: "Al tiro le pongo grasa", en: "I will grease it right away" },
    { claves: ["tomar once"], t: "expression", g: "have the Chilean afternoon tea", es: "Quédate a tomar once", en: "stay for once, the afternoon tea" },
    { claves: ["fierro"], t: "noun", g: "iron (Latin American word)", es: "Fierro viejo que conversa", en: "old iron having a chat" },
    { claves: ["pan amasado"], t: "expression", g: "Chilean kneaded bread", es: "hay pan amasado", en: "there is kneaded bread" },
    { claves: ["chirrido"], t: "noun", g: "metal squeal", es: "un chirrido fino", en: "a thin squeal" },
    { claves: ["engranaje"], t: "noun", g: "gear", es: "al engranaje le faltaba grasa", en: "the gear was short of grease" },
    { claves: ["andamio"], t: "noun", g: "scaffold", es: "colgada de un andamio", en: "hanging from a scaffold" },
    { claves: ["grasa"], t: "noun", g: "grease", es: "le faltaba grasa", en: "it was short of grease" },
    { claves: ["cable"], t: "noun", g: "cable", es: "colgar de un cable cansado", en: "hanging from a tired cable" },
    { claves: ["desgaste"], t: "noun", g: "wear", es: "El desgaste saltaba a simple vista", en: "the wear leapt out at first glance" },
    { claves: ["vibrar", "vibraba"], t: "verb", g: "vibrated (vibrar)", es: "la mesa, que vibraba bajito", en: "the table, humming quietly" },
    { claves: ["caseta"], t: "noun", g: "operator's hut", es: "saludaba desde la caseta", en: "waved from the hut" },
    { claves: ["rejilla"], t: "noun", g: "grille", es: "por la rejilla", en: "through the grille" },
    { claves: ["eje"], t: "noun", g: "axle", es: "el eje tenía un chirrido fino", en: "the axle had a thin squeal" },
    { claves: ["a pie"], t: "expression", g: "on foot", es: "Marcela bajó a pie", en: "Marcela walked down on foot" },
    { claves: ["al día"], t: "expression", g: "up to date", es: "tenía la libreta al día", en: "kept the logbook up to date" },
    { claves: ["quedarse callado", "se quedó callada"], t: "expression", g: "stays silent", es: "y se quedó callada", en: "and stayed silent" },
    { claves: ["a simple vista"], t: "expression", g: "at first glance", es: "saltaba a simple vista", en: "leapt out at first glance" }
  ],
  "la-licitacion-desierta": [
    { claves: ["harto"], t: "adjective", g: "a lot of (Chile)", es: "con harto pasaje", en: "with plenty of passengers" },
    { claves: ["no más", "no mas"], t: "expression", g: "just, go ahead (Southern Cone)", es: "Haz la vista gorda, no más", en: "just turn a blind eye" },
    { claves: ["licitación"], t: "noun", g: "public tender", es: "la licitación de la estación entera", en: "the tender for the whole station" },
    { claves: ["postular", "postulé"], t: "verb", g: "I applied (postular)", es: "Ya postulé, claro", en: "I already applied, of course" },
    { claves: ["presupuesto"], t: "noun", g: "quote, budget", es: "el presupuesto por capas", en: "the quote broken down by coats" },
    { claves: ["adjudicar", "se adjudicaba"], t: "verb", g: "was awarded (adjudicar)", es: "La obra se adjudicaba con la mantención", en: "the job was awarded together with the maintenance" },
    { claves: ["constancia"], t: "noun", g: "written record", es: "sin que alguien dejara constancia de una falla", en: "unless someone put a fault on record" },
    { claves: ["falla"], t: "noun", g: "fault", es: "La falla era un secreto a voces", en: "the fault was an open secret" },
    { claves: ["arder", "ardió"], t: "verb", g: "burned inside (arder)", es: "la palabra le ardió", en: "the word burned inside her" },
    { claves: ["trámite"], t: "noun", g: "official procedure", es: "El trámite traía letra chica", en: "the procedure came with fine print" },
    { claves: ["papeleo"], t: "noun", g: "paperwork", es: "letra chica y papeleo", en: "fine print and paperwork" },
    { claves: ["capa", "capas"], t: "noun", g: "coat of paint", es: "presupuesto por capas", en: "quote broken down by coats" },
    { claves: ["desierto", "desierta"], t: "adjective", g: "void (a tender nobody wins)", es: "la licitación quedaba desierta", en: "the tender was left void" },
    { claves: ["dar el paso", "dio el paso"], t: "expression", g: "take the step", es: "No dio el paso", en: "she did not take the step" },
    { claves: ["letra chica"], t: "expression", g: "the fine print", es: "El trámite traía letra chica", en: "the procedure came with fine print" },
    { claves: ["secreto a voces"], t: "expression", g: "open secret", es: "un secreto a voces", en: "an open secret" },
    { claves: ["quedar fuera", "quedó fuera"], t: "expression", g: "be left out", es: "Marcela quedó fuera igual", en: "Marcela was left out anyway" },
    { claves: ["hacer la vista gorda", "la vista gorda"], t: "expression", g: "turn a blind eye", es: "Haz la vista gorda", en: "turn a blind eye" },
    { claves: ["valer la pena", "valió la pena"], t: "expression", g: "be worth it", es: "sin saber si valió la pena", en: "not knowing if it was worth it" },
    { claves: ["en blanco"], t: "expression", g: "blank", es: "entregó en blanco", en: "handed it in blank" }
  ],
  "tres-veces-por-escrito": [
    { claves: ["freno"], t: "noun", g: "brake", es: "que el freno agarró", en: "the brake caught" },
    { claves: ["manivela"], t: "noun", g: "crank", es: "Te bajo a manivela", en: "I will crank you down by hand" },
    { claves: ["rechinar", "rechinaba"], t: "verb", g: "ground (rechinar)", es: "La manivela rechinaba", en: "the crank ground" },
    { claves: ["pasamanos"], t: "noun", g: "handrail", es: "sujeta del pasamanos", en: "holding the handrail" },
    { claves: ["salto"], t: "noun", g: "jolt", es: "dio un salto corto", en: "gave one short jolt" },
    { claves: ["crujir", "crujió"], t: "verb", g: "creaked (crujir)", es: "dio un salto corto, crujió", en: "gave a short jolt, creaked" },
    { claves: ["sellado", "selladas"], t: "adjective", g: "sealed", es: "tres cartas selladas", en: "three sealed letters" },
    { claves: ["repuesto"], t: "noun", g: "spare part", es: "pidiendo el repuesto", en: "asking for the spare part" },
    { claves: ["secreto"], t: "noun", g: "secret", es: "guardó el secreto una semana", en: "kept the secret for a week" },
    { claves: ["mercadería"], t: "noun", g: "goods", es: "sube su mercadería en este fierro", en: "brings its goods up on this iron" },
    { claves: ["celeste"], t: "adjective", g: "sky blue", es: "una pared recién pintada, celeste", en: "a freshly painted wall, sky blue" },
    { claves: ["recién"], t: "adverb", g: "just, freshly", es: "recién pintada", en: "freshly painted" },
    { claves: ["temblón", "temblonas"], t: "adjective", g: "shaky", es: "con las piernas temblonas", en: "with shaky legs" },
    { claves: ["tumbar", "tumba"], t: "verb", g: "knocks flat (tumbar)", es: "y casi la tumba", en: "and it nearly knocked her flat" },
    { claves: ["ceder"], t: "verb", g: "to give way (ceder)", es: "a punto de ceder", en: "about to give way" },
    { claves: ["por fin", "Por fin"], t: "expression", g: "at last", es: "Por fin cerraron el ascensor", en: "at last they closed the lift" },
    { claves: ["a media subida"], t: "expression", g: "halfway up", es: "A media subida", en: "halfway up" },
    { claves: ["a punto de"], t: "expression", g: "about to", es: "estaba a punto de ceder", en: "was about to give way" },
    { claves: ["de a poco"], t: "expression", g: "little by little", es: "el carro bajó de a poco", en: "the car came down little by little" },
    { claves: ["al trote"], t: "expression", g: "at a trot", es: "el corazón al trote", en: "her heart at a trot" }
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
