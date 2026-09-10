/** Capa de contexto del tema 1 del B2 latam: cada plaza de vocab con su trozo
 *  constituyente (tope blando 5, duro 8) y su traduccion del trozo, claves por
 *  lema Y superficie, como la capa del B1 (scripts/_b1/_capaVocab.ts). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "se-rieron-antes-que-ella": [
    { claves: ["cantina"], t: "noun", g: "cantina, traditional Mexican bar", es: "la barra de una cantina", en: "the bar of a cantina" },
    { claves: ["birria"], t: "noun", g: "birria, spicy meat stew from Jalisco", es: "huele a birria desde temprano", en: "smells of birria from early on" },
    { claves: ["tejuino"], t: "noun", g: "tejuino, cold fermented corn drink", es: "de tejuino y pocas palabras", en: "of tejuino and few words" },
    { claves: ["caballito"], t: "noun", g: "small tequila glass", es: "levanta su caballito", en: "raises his little tequila glass" },
    { claves: ["albur"], t: "noun", g: "albur, double-meaning word game", es: "Me aguanta un albur", en: "can you take an albur" },
    { claves: ["patrona"], t: "noun", g: "boss lady", es: "Mañana hay más, patrona", en: "tomorrow there is more, boss lady" },
    { claves: ["presumir", "presume"], t: "verb", g: "boasts (presumir)", es: "presume de una sola cosa", en: "boasts about just one thing" },
    { claves: ["fama"], t: "noun", g: "reputation", es: "o nomás la fama", en: "or just the reputation" },
    { claves: ["ingenio", "ingeniosa"], t: "noun", g: "wit; witty one", es: "la ingeniosa aquí es otra", en: "the witty one here is someone else" },
    { claves: ["duelo"], t: "noun", g: "duel of wits", es: "El duelo va empatado", en: "the duel is tied" },
    { claves: ["manso", "mansa"], t: "adjective", g: "tame, harmless-looking", es: "una frase mansa", en: "a harmless-looking phrase" },
    { claves: ["delatar", "delata"], t: "verb", g: "gives her away (delatar)", es: "ese medio segundo la delata", en: "that half second gives her away" },
    { claves: ["propina"], t: "noun", g: "tip", es: "deja el doble de propina", en: "leaves double the tip" },
    { claves: ["empatar", "empatado"], t: "verb", g: "tied (empatar)", es: "va empatado tres vueltas", en: "is tied for three rounds" },
    { claves: ["carcajada"], t: "noun", g: "loud burst of laughter", es: "suelta la carcajada", en: "bursts out laughing" },
    { claves: ["dejar caer", "deja caer"], t: "expression", g: "drops casually (dejar caer)", es: "deja caer una frase mansa", en: "casually drops a harmless phrase" },
    { claves: ["hacer callar", "hecho callar"], t: "expression", g: "shut someone up (hacer callar)", es: "nadie la ha hecho callar", en: "nobody has shut her up" },
    { claves: ["va que va"], t: "expression", g: "deal, agreed (Mexican)", es: "Va que va", en: "it is a deal" },
    { claves: ["sin despeinarse"], t: "expression", g: "without breaking a sweat", es: "Contesta sin despeinarse", en: "answers without breaking a sweat" },
    { claves: ["doble sentido"], t: "expression", g: "double meaning", es: "de doble sentido escondido", en: "with a hidden double meaning" }
  ],
  "era-la-lista-del-mandado": [
    { claves: ["tianguis"], t: "noun", g: "tianguis, open-air street market", es: "al carnicero del tianguis", en: "the butcher at the street market" },
    { claves: ["botana"], t: "noun", g: "bar snack", es: "rebana jícama para la botana", en: "slices jicama for the bar snack" },
    { claves: ["mandado"], t: "noun", g: "groceries, everyday shopping", es: "Es la lista del mandado", en: "it is the grocery list" },
    { claves: ["trastes"], t: "noun", g: "dishes (Mexican)", es: "le lavo los trastes un mes", en: "I wash your dishes for a month" },
    { claves: ["muina"], t: "noun", g: "flash of anger (Jalisco)", es: "De pura muina", en: "out of pure spite" },
    { claves: ["jícama"], t: "noun", g: "jicama, crunchy root vegetable", es: "mientras rebana jícama", en: "while she slices jicama" },
    { claves: ["revancha"], t: "noun", g: "rematch", es: "La revancha se prepara a escondidas", en: "the rematch is prepared in secret" },
    { claves: ["carnicero"], t: "noun", g: "butcher", es: "le pregunta al carnicero", en: "asks the butcher" },
    { claves: ["reunir", "reuniendo"], t: "verb", g: "gathering (reunir)", es: "reuniendo albures ajenos", en: "gathering other people's albures" },
    { claves: ["hojear", "hojea"], t: "verb", g: "leafs through (hojear)", es: "hojea la libreta con calma", en: "leafs through the notebook calmly" },
    { claves: ["arrancar", "arrancarle"], t: "verb", g: "snatch from him (arrancar)", es: "quiere arrancarle la libreta", en: "wants to snatch the notebook from him" },
    { claves: ["tronar", "truena"], t: "verb", g: "cracks (tronar)", es: "el lápiz hasta que truena", en: "the pencil until it cracks" },
    { claves: ["ensayar", "ensayando"], t: "verb", g: "rehearsing (ensayar)", es: "ensayando con los del dominó", en: "rehearsing with the domino players" },
    { claves: ["plantear", "plantea"], t: "verb", g: "puts forward (plantear)", es: "plantea", en: "he puts forward" },
    { claves: ["puro", "puros"], t: "adjective", g: "nothing but (Mexican)", es: "Puros dobles sentidos", en: "nothing but double meanings" },
    { claves: ["a escondidas"], t: "expression", g: "in secret", es: "se prepara a escondidas", en: "is prepared in secret" },
    { claves: ["cara de yo no fui"], t: "expression", g: "innocent who-me face", es: "con cara de yo no fui", en: "with an innocent who-me face" },
    { claves: ["subir la apuesta"], t: "expression", g: "raise the stakes", es: "Vamos a subir la apuesta", en: "let us raise the stakes" },
    { claves: ["sostener la mirada", "sostiene la mirada"], t: "expression", g: "hold someone's gaze", es: "sostiene la mirada", en: "holds his gaze" },
    { claves: ["poner fecha", "pone fecha"], t: "expression", g: "set the date", es: "Y le pone fecha", en: "and sets the date" }
  ],
  "el-albur-que-llego-tarde": [
    { claves: ["desquite"], t: "noun", g: "payback, rematch", es: "se juega el desquite", en: "the payback match is on" },
    { claves: ["nomás"], t: "adverb", g: "just, only (Mexican)", es: "Nomás que usted no había preguntado", en: "only you had never asked" },
    { claves: ["la casa invita", "la casa no invita"], t: "expression", g: "on the house", es: "La casa no invita", en: "it is not on the house" },
    { claves: ["hora de la comida"], t: "expression", g: "midday meal time", es: "a la hora de la comida", en: "at the midday meal hour" },
    { claves: ["de un jalón"], t: "expression", g: "in one go", es: "se lo toma de un jalón", en: "drinks it in one go" },
    { claves: ["parejo", "parejos"], t: "adjective", g: "even, level", es: "Van parejos", en: "they are running even" },
    { claves: ["acierto", "aciertos"], t: "noun", g: "hits, right answers", es: "festeja los aciertos ajenos", en: "celebrates the other player's hits" },
    { claves: ["madurar", "madurado"], t: "verb", g: "ripened (madurar)", es: "madurado con calma", en: "ripened without hurry" },
    { claves: ["cosecha"], t: "noun", g: "harvest; one's own making", es: "uno de su cosecha", en: "one of her own harvest" },
    { claves: ["festejar", "festeja"], t: "verb", g: "celebrates (festejar)", es: "festeja los aciertos", en: "celebrates the hits" },
    { claves: ["silbido"], t: "noun", g: "whistle", es: "llega un silbido", en: "a whistle arrives" },
    { claves: ["chiste"], t: "noun", g: "joke", es: "un chiste tan suyo", en: "a joke so completely her own" },
    { claves: ["trampa"], t: "noun", g: "trick", es: "Renata nota la trampa", en: "Renata notices the trick" },
    { claves: ["serio", "serios"], t: "adjective", g: "serious", es: "Brindan, muy serios", en: "they toast, very serious" },
    { claves: ["apuesta"], t: "noun", g: "bet", es: "cobra la apuesta", en: "collects the bet" },
    { claves: ["rendirse", "se rinde"], t: "verb", g: "gives up (rendirse)", es: "se rinde sin discutir", en: "gives up without arguing" },
    { claves: ["de siempre"], t: "expression", g: "the usual one", es: "en el clavo de siempre", en: "on the usual nail" },
    { claves: ["dejarse ganar", "dejando ganar"], t: "expression", g: "let the other one win", es: "se está dejando ganar", en: "he is letting her win" },
    { claves: ["venirse abajo", "se viene abajo"], t: "expression", g: "collapse (here: with laughter)", es: "La barra se viene abajo", en: "the whole bar collapses laughing" },
    { claves: ["antes de tiempo"], t: "expression", g: "ahead of time", es: "antes de tiempo", en: "ahead of time" }
  ]
};
(async () => {
  const p = new PrismaClient();
  const global = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } });
  if (!global) throw new Error("no existe el bundle global");
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
