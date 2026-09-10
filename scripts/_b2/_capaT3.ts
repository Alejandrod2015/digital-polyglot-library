/** Capa de contexto del tema 3 del B2 latam (fragmentos constituyentes). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "un-chirrido-nuevo": [
    { claves: ["maestro"], t: "noun", g: "master (Chilean address for a tradesman)", es: "¿Y ese ruido nuevo, maestro?", en: "and that new noise, maestro" },
    { claves: ["mantención"], t: "noun", g: "maintenance (Chile)", es: "La mantención, por la rejilla, se ve así", en: "the maintenance, through the grille, looks like this" },
    { claves: ["al tiro"], t: "expression", g: "right away (Chile)", es: "Al tiro le pongo grasa", en: "I will grease it right away" },
    { claves: ["tomar once"], t: "expression", g: "have the Chilean afternoon tea", es: "Quédate a tomar once", en: "stay for once, the afternoon tea" },
    { claves: ["fierro"], t: "noun", g: "iron (Latin American word)", es: "Fierro viejo que conversa", en: "old iron having a chat" },
    { claves: ["pan amasado"], t: "expression", g: "Chilean kneaded bread", es: "hay pan amasado", en: "there is kneaded bread" },
    { claves: ["chirrido"], t: "noun", g: "metal squeal", es: "un chirrido fino", en: "a thin squeal" },
    { claves: ["engranaje"], t: "noun", g: "gear", es: "al engranaje le falta grasa", en: "the gear is short of grease" },
    { claves: ["andamio"], t: "noun", g: "scaffold", es: "colgada de un andamio", en: "hanging from a scaffold" },
    { claves: ["grasa"], t: "noun", g: "grease", es: "le falta grasa", en: "it is short of grease" },
    { claves: ["cable"], t: "noun", g: "cable", es: "colgar de un cable cansado", en: "hanging from a tired cable" },
    { claves: ["desgaste"], t: "noun", g: "wear", es: "El desgaste salta a simple vista", en: "the wear leaps out at first glance" },
    { claves: ["vibrar", "vibra"], t: "verb", g: "vibrates (vibrar)", es: "la mesa, que vibra bajito", en: "the table, humming quietly" },
    { claves: ["caseta"], t: "noun", g: "operator's hut", es: "saluda desde la caseta", en: "waves from the hut" },
    { claves: ["rejilla"], t: "noun", g: "grille", es: "por la rejilla", en: "through the grille" },
    { claves: ["eje"], t: "noun", g: "axle", es: "que el eje no tenía ayer", en: "that the axle did not have yesterday" },
    { claves: ["a pie"], t: "expression", g: "on foot", es: "ahora baja a pie", en: "now walks down on foot" },
    { claves: ["al día"], t: "expression", g: "up to date", es: "tiene la libreta al día", en: "keeps the logbook up to date" },
    { claves: ["quedarse callado", "se queda callada"], t: "expression", g: "stays silent", es: "y se queda callada", en: "and stays silent" },
    { claves: ["a simple vista"], t: "expression", g: "at first glance", es: "salta a simple vista", en: "leaps out at first glance" }
  ],
  "la-vista-gorda": [
    { claves: ["harto"], t: "adjective", g: "a lot of (Chile)", es: "con harto pasaje", en: "with plenty of passengers" },
    { claves: ["no más", "no mas"], t: "expression", g: "just, go ahead (Southern Cone)", es: "Haz la vista gorda, no más", en: "just turn a blind eye" },
    { claves: ["licitación"], t: "noun", g: "public tender", es: "la licitación de la estación entera", en: "the tender for the whole station" },
    { claves: ["postular", "postulé"], t: "verb", g: "I applied (postular)", es: "Ya postulé, claro", en: "I already applied, of course" },
    { claves: ["presupuesto"], t: "noun", g: "quote, budget", es: "su presupuesto por capas", en: "her quote broken down by coats" },
    { claves: ["adjudicar", "se adjudica"], t: "verb", g: "is awarded (adjudicar)", es: "La obra se adjudica con la mantención", en: "the job is awarded together with the maintenance" },
    { claves: ["constancia"], t: "noun", g: "written record", es: "si alguien deja constancia de una falla", en: "if someone puts a fault on record" },
    { claves: ["falla"], t: "noun", g: "fault", es: "La falla es un secreto a voces", en: "the fault is an open secret" },
    { claves: ["arder", "arde"], t: "verb", g: "burns inside (arder)", es: "la palabra le arde", en: "the word burns inside her" },
    { claves: ["trámite"], t: "noun", g: "official procedure", es: "El trámite trae letra chica", en: "the procedure comes with fine print" },
    { claves: ["papeleo"], t: "noun", g: "paperwork", es: "letra chica y papeleo", en: "fine print and paperwork" },
    { claves: ["capa", "capas"], t: "noun", g: "coat of paint", es: "presupuesto por capas", en: "quote broken down by coats" },
    { claves: ["desierto", "desierta"], t: "adjective", g: "void (a tender nobody wins)", es: "la licitación se declara desierta", en: "the tender is declared void" },
    { claves: ["dar el paso", "da el paso"], t: "expression", g: "take the step", es: "No da el paso", en: "she does not take the step" },
    { claves: ["letra chica"], t: "expression", g: "the fine print", es: "El trámite trae letra chica", en: "the procedure comes with fine print" },
    { claves: ["secreto a voces"], t: "expression", g: "open secret", es: "un secreto a voces", en: "an open secret" },
    { claves: ["quedar fuera", "queda fuera"], t: "expression", g: "be left out", es: "queda fuera sin competir", en: "is left out without competing" },
    { claves: ["hacer la vista gorda", "la vista gorda"], t: "expression", g: "turn a blind eye", es: "Haz la vista gorda", en: "turn a blind eye" },
    { claves: ["valer la pena", "valió la pena"], t: "expression", g: "be worth it", es: "sin saber si valió la pena", en: "not knowing if it was worth it" },
    { claves: ["en blanco"], t: "expression", g: "blank", es: "entrega en blanco", en: "hands it in blank" }
  ],
  "la-pared-que-nadie-encargo": [
    { claves: ["freno"], t: "noun", g: "brake", es: "que el freno agarró", en: "the brake caught" },
    { claves: ["manivela"], t: "noun", g: "crank", es: "Te bajo a manivela", en: "I will crank you down by hand" },
    { claves: ["rechinar", "rechina"], t: "verb", g: "grinds (rechinar)", es: "La manivela rechina", en: "the crank grinds" },
    { claves: ["pasamanos"], t: "noun", g: "handrail", es: "sujeta del pasamanos", en: "holding the handrail" },
    { claves: ["salto"], t: "noun", g: "jolt", es: "da un salto corto", en: "gives one short jolt" },
    { claves: ["crujir", "cruje"], t: "verb", g: "creaks (crujir)", es: "da un salto corto, cruje", en: "gives a short jolt, creaks" },
    { claves: ["sellado", "selladas"], t: "adjective", g: "sealed", es: "tres cartas selladas", en: "three sealed letters" },
    { claves: ["repuesto"], t: "noun", g: "spare part", es: "pidiendo el repuesto", en: "asking for the spare part" },
    { claves: ["secreto"], t: "noun", g: "secret", es: "a ella el secreto casi la tumba", en: "the secret nearly knocks her flat" },
    { claves: ["mercadería"], t: "noun", g: "goods", es: "sube su mercadería en este fierro", en: "brings its goods up on this iron" },
    { claves: ["celeste"], t: "adjective", g: "sky blue", es: "una pared recién pintada, celeste", en: "a freshly painted wall, sky blue" },
    { claves: ["recién"], t: "adverb", g: "just, freshly", es: "recién pintada", en: "freshly painted" },
    { claves: ["temblón", "temblonas"], t: "adjective", g: "shaky", es: "con las piernas temblonas", en: "with shaky legs" },
    { claves: ["tumbar", "tumba"], t: "verb", g: "knocks flat (tumbar)", es: "casi la tumba en una semana", en: "nearly knocks her flat in a week" },
    { claves: ["ceder"], t: "verb", g: "to give way (ceder)", es: "a punto de ceder", en: "about to give way" },
    { claves: ["por fin", "Por fin"], t: "expression", g: "at last", es: "Por fin cierran el ascensor", en: "at last they close the lift" },
    { claves: ["a media subida"], t: "expression", g: "halfway up", es: "A media subida", en: "halfway up" },
    { claves: ["a punto de"], t: "expression", g: "about to", es: "está a punto de ceder", en: "is about to give way" },
    { claves: ["de a poco"], t: "expression", g: "little by little", es: "el carro baja de a poco", en: "the car comes down little by little" },
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
