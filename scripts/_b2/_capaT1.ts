/** Capa de contexto del tema 1 del B2 latam: cada plaza de vocab con su trozo
 *  constituyente (tope blando 5, duro 8) y su traduccion del trozo, claves por
 *  lema Y superficie, como la capa del B1 (scripts/_b1/_capaVocab.ts). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "los-aguanto-de-dos-en-dos": [
    { claves: ["atender", "atendía"], t: "verb", g: "ran, served at (atender)", es: "la mujer que atendía la barra", en: "the woman who ran the bar" },
    { claves: ["temprano"], t: "adverb", g: "early", es: "olía a birria desde temprano", en: "smelled of birria from early on" },
    { claves: ["cansarse", "se cansa"], t: "verb", g: "get tired (cansarse)", es: "¿Se cansa tan pronto?", en: "are you getting tired so soon" },
    { claves: ["calentar", "calentando"], t: "verb", g: "warming up (calentar)", es: "Apenas voy calentando", en: "I am only just warming up" },
    { claves: ["cantina"], t: "noun", g: "cantina, traditional Mexican bar", es: "la barra de una cantina", en: "the bar of a cantina" },
    { claves: ["birria"], t: "noun", g: "birria, spicy meat stew from Jalisco", es: "olía a birria desde temprano", en: "smelled of birria from early on" },
    { claves: ["tejuino"], t: "noun", g: "tejuino, cold fermented corn drink", es: "de tejuino y pocas palabras", en: "of tejuino and few words" },
    { claves: ["caballito"], t: "noun", g: "small tequila glass", es: "levantó su caballito", en: "raised his little tequila glass" },
    { claves: ["albur"], t: "noun", g: "albur, double-meaning word game", es: "Me aguanta un albur", en: "can you take an albur" },
    { claves: ["patrona"], t: "noun", g: "boss lady", es: "Mañana hay más, patrona", en: "tomorrow there is more, boss lady" },
    { claves: ["presumir", "presumía"], t: "verb", g: "boasted (presumir)", es: "presumía de una sola cosa", en: "boasted about just one thing" },
    { claves: ["fama"], t: "noun", g: "reputation", es: "o nomás la fama", en: "or just the reputation" },
    { claves: ["ingenio", "ingeniosa"], t: "noun", g: "wit; witty one", es: "la ingeniosa aquí es otra", en: "the witty one here is someone else" },
    { claves: ["duelo"], t: "noun", g: "duel of wits", es: "El duelo iba empatado", en: "the duel was tied" },
    { claves: ["manso", "mansa"], t: "adjective", g: "tame, harmless-looking", es: "una frase mansa", en: "a harmless-looking phrase" },
    { claves: ["delatar", "delató"], t: "verb", g: "gave her away (delatar)", es: "ese medio segundo la delató", en: "that half second gave her away" },
    { claves: ["propina"], t: "noun", g: "tip", es: "dejó el doble de propina", en: "left double the tip" },
    { claves: ["empatar", "empatado"], t: "verb", g: "tied (empatar)", es: "iba empatado tres vueltas", en: "was tied for three rounds" },
    { claves: ["carcajada"], t: "noun", g: "loud burst of laughter", es: "soltó la carcajada", en: "burst out laughing" },
    { claves: ["dejar caer", "dejó caer"], t: "expression", g: "dropped casually (dejar caer)", es: "dejó caer una frase mansa", en: "casually dropped a harmless phrase" },
    { claves: ["hacer callar", "hecho callar"], t: "expression", g: "shut someone up (hacer callar)", es: "nadie la había hecho callar", en: "nobody had ever shut her up" },
    { claves: ["va que va"], t: "expression", g: "deal, agreed (Mexican)", es: "Va que va", en: "it is a deal" },
    { claves: ["sin despeinarse"], t: "expression", g: "without breaking a sweat", es: "Contestaba sin despeinarse", en: "she answered without breaking a sweat" },
    { claves: ["doble sentido"], t: "expression", g: "double meaning", es: "de doble sentido escondido", en: "with a hidden double meaning" }
  ],
  "de-pura-muina": [
    { claves: ["tianguis"], t: "noun", g: "tianguis, open-air street market", es: "del carnicero del tianguis", en: "from the butcher at the street market" },
    { claves: ["botana"], t: "noun", g: "bar snack", es: "jícama fría para la botana", en: "cold jicama for the bar snack" },
    { claves: ["mandado"], t: "noun", g: "groceries, everyday shopping", es: "Es la lista del mandado", en: "it is the grocery list" },
    { claves: ["trastes"], t: "noun", g: "dishes (Mexican)", es: "le lavo los trastes un mes", en: "I wash your dishes for a month" },
    { claves: ["muina"], t: "noun", g: "flash of anger (Jalisco)", es: "De pura muina", en: "out of pure spite" },
    { claves: ["jícama"], t: "noun", g: "jicama, crunchy root vegetable", es: "mientras rebanaba jícama", en: "while she sliced jicama" },
    { claves: ["revancha"], t: "noun", g: "rematch", es: "La revancha se preparó a escondidas", en: "the rematch was prepared in secret" },
    { claves: ["carnicero"], t: "noun", g: "butcher", es: "albures del carnicero", en: "albures from the butcher" },
    { claves: ["reunir", "reuniendo"], t: "verb", g: "gathering (reunir)", es: "reuniendo albures del carnicero", en: "gathering albures from the butcher" },
    { claves: ["hojear", "hojeó"], t: "verb", g: "leafed through (hojear)", es: "hojeó la libreta", en: "leafed through the notebook" },
    { claves: ["arrancar", "arrancarle"], t: "verb", g: "snatch from him (arrancar)", es: "quiso arrancarle la libreta", en: "wanted to snatch the notebook from him" },
    { claves: ["tronar", "tronó"], t: "verb", g: "cracked (tronar)", es: "el lápiz hasta que tronó", en: "the pencil until it cracked" },
    { claves: ["ensayar", "ensayando"], t: "verb", g: "rehearsing (ensayar)", es: "ensayando en el dominó", en: "rehearsing at the domino table" },
    { claves: ["plantear", "planteó"], t: "verb", g: "put forward (plantear)", es: "planteó", en: "he put forward" },
    { claves: ["puro", "puros"], t: "adjective", g: "nothing but (Mexican)", es: "Puros dobles sentidos", en: "nothing but double meanings" },
    { claves: ["a escondidas"], t: "expression", g: "in secret", es: "se preparó a escondidas", en: "was prepared in secret" },
    { claves: ["cara de yo no fui"], t: "expression", g: "innocent who-me face", es: "con cara de yo no fui", en: "with an innocent who-me face" },
    { claves: ["subir la apuesta"], t: "expression", g: "raise the stakes", es: "Vamos a subir la apuesta", en: "let us raise the stakes" },
    { claves: ["sostener la mirada", "sostuvo la mirada"], t: "expression", g: "hold someone's gaze", es: "sostuvo la mirada", en: "held his gaze" },
    { claves: ["poner fecha", "puso fecha"], t: "expression", g: "set the date", es: "Y le puso fecha", en: "and set the date" }
  ],
  "el-chiste-tan-suyo": [
    { claves: ["desquite"], t: "noun", g: "payback, rematch", es: "se jugaba el desquite", en: "the payback match was on" },
    { claves: ["nomás"], t: "adverb", g: "just, only (Mexican)", es: "Nomás que usted no había preguntado", en: "only you had never asked" },
    { claves: ["la casa invita", "la casa no invita"], t: "expression", g: "on the house", es: "La casa no invita", en: "it is not on the house" },
    { claves: ["hora de la comida"], t: "expression", g: "midday meal time", es: "a la hora de la comida", en: "at the midday meal hour" },
    { claves: ["de un jalón"], t: "expression", g: "in one go", es: "se lo tomó de un jalón", en: "drank it in one go" },
    { claves: ["parejo", "parejos"], t: "adjective", g: "even, level", es: "Iban parejos", en: "they were running even" },
    { claves: ["acierto", "aciertos"], t: "noun", g: "hits, right answers", es: "festejaba los aciertos ajenos", en: "celebrated the other player's hits" },
    { claves: ["madurar", "madurado"], t: "verb", g: "ripened (madurar)", es: "madurado con calma", en: "ripened without hurry" },
    { claves: ["cosecha"], t: "noun", g: "harvest; one's own making", es: "uno de su cosecha", en: "one of her own harvest" },
    { claves: ["festejar", "festejaba"], t: "verb", g: "celebrated (festejar)", es: "festejaba los aciertos", en: "celebrated the hits" },
    { claves: ["silbido"], t: "noun", g: "whistle", es: "llegó un silbido", en: "a whistle came" },
    { claves: ["chiste"], t: "noun", g: "joke", es: "un chiste tan suyo", en: "a joke so completely her own" },
    { claves: ["trampa"], t: "noun", g: "trick", es: "Renata notó la trampa", en: "Renata noticed the trick" },
    { claves: ["serio", "serios"], t: "adjective", g: "serious", es: "Brindaron, muy serios", en: "they toasted, very serious" },
    { claves: ["apuesta"], t: "noun", g: "bet", es: "cobró la apuesta", en: "collected the bet" },
    { claves: ["rendirse", "se rindió"], t: "verb", g: "gave up (rendirse)", es: "se rindió sin discutir", en: "gave up without arguing" },
    { claves: ["de siempre"], t: "expression", g: "the usual one", es: "en el clavo de siempre", en: "on the usual nail" },
    { claves: ["dejarse ganar", "dejando ganar"], t: "expression", g: "let the other one win", es: "se estaba dejando ganar", en: "he was letting her win" },
    { claves: ["venirse abajo", "se vino abajo"], t: "expression", g: "collapse (here: with laughter)", es: "La barra se vino abajo", en: "the whole bar collapsed laughing" },
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
