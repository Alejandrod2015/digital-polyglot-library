/**
 * Genera la conjugación de los VERBOS de una historia, y nada más.
 *
 * Probado el 2026-08-26 con sustantivos y adjetivos: de 814 bloques salieron 52
 * plurales imposibles (pieses, floreses, paraguases) porque la palabra ya era
 * plural, incontables con plural inventado (gentes, miedos) y un "freso" al
 * derivar el masculino de "fresa", que el bundle tiene tipada como adjetivo.
 * Todo eso se escribe a mano leyendo la frase. El verbo sí se puede: solo se
 * conjuga cuando la forma pertenece a un paradigma conocido, y si no, la
 * palabra se queda sin bloque en vez de con una conjugación adivinada.
 *
 *   npx tsx scripts/buildGlossForms.ts <bundle> <textos.json> [--dry]
 *
 * De dónde sale cada cosa:
 *
 *   Género     del artículo que va PEGADO al sustantivo en el texto real
 *              ("la estación" -> f.). Sin artículo delante no se inventa: se
 *              queda sin marca, que es mejor que ponerla mal.
 *   Plural     de la regla ortográfica: vocal +s, consonante +es, -z -> -ces,
 *              y las llanas acabadas en -s no cambian (el lunes, los lunes).
 *              Los acentos de -ción y -és se caen en el plural.
 *   Adjetivo   de la terminación -o/-a/-os/-as. Los que acaban en -e o en
 *              consonante solo tienen singular y plural, no cuatro formas.
 *   Verbo      de una tabla de infinitivos: los regulares se conjugan por su
 *              terminación y los irregulares están escritos uno a uno. Una
 *              forma que no esté en la tabla se queda SIN bloque, nunca con
 *              una conjugación adivinada.
 *
 * La variante manda en la segunda persona: España usa vosotros y LATAM
 * ustedes, y Argentina cambia además la segunda del singular por vos. El lint
 * `checkGlossVariants.ts` vuelve a comprobarlo después.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

type Entrada = {
  g: string;
  t: string;
  gm?: string;
  c?: { es: string; en: string };
  f?: { kind?: "line" | "expand"; link?: string; lemma?: string; rows: string[][]; here: number };
};
type Bundle = {
  language?: string;
  variant?: string;
  slugs: string[];
  glosses: Record<string, Entrada>;
  byStory?: Record<string, Record<string, Entrada>>;
};

// ── Personas, según la variante ──────────────────────────────────────────
function personas(variante: string): string[] {
  if (variante === "argentina" || variante === "uruguay") {
    return ["yo", "vos", "él, ella", "nosotros", "ustedes", "ellos"];
  }
  if (variante === "spain") return ["yo", "tú", "él, ella", "nosotros", "vosotros", "ellos"];
  return ["yo", "tú", "él, ella", "nosotros", "ustedes", "ellos"];
}

// ── Verbos: regulares por terminación, irregulares a mano ────────────────
const IRREGULARES: Record<string, string[]> = {
  ser: ["soy", "eres", "es", "somos", "sois", "son"],
  estar: ["estoy", "estás", "está", "estamos", "estáis", "están"],
  ir: ["voy", "vas", "va", "vamos", "vais", "van"],
  tener: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
  hacer: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
  decir: ["digo", "dices", "dice", "decimos", "decís", "dicen"],
  poder: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"],
  querer: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"],
  venir: ["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
  ver: ["veo", "ves", "ve", "vemos", "veis", "ven"],
  dar: ["doy", "das", "da", "damos", "dais", "dan"],
  saber: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
  pedir: ["pido", "pides", "pide", "pedimos", "pedís", "piden"],
  empezar: ["empiezo", "empiezas", "empieza", "empezamos", "empezáis", "empiezan"],
  probar: ["pruebo", "pruebas", "prueba", "probamos", "probáis", "prueban"],
  volver: ["vuelvo", "vuelves", "vuelve", "volvemos", "volvéis", "vuelven"],
  seguir: ["sigo", "sigues", "sigue", "seguimos", "seguís", "siguen"],
  oler: ["huelo", "hueles", "huele", "olemos", "oléis", "huelen"],
  jugar: ["juego", "juegas", "juega", "jugamos", "jugáis", "juegan"],
  contar: ["cuento", "cuentas", "cuenta", "contamos", "contáis", "cuentan"],
  encontrar: ["encuentro", "encuentras", "encuentra", "encontramos", "encontráis", "encuentran"],
  sentarse: ["me siento", "te sientas", "se sienta", "nos sentamos", "os sentáis", "se sientan"],
  salir: ["salgo", "sales", "sale", "salimos", "salís", "salen"],
  caer: ["caigo", "caes", "cae", "caemos", "caéis", "caen"],
  traer: ["traigo", "traes", "trae", "traemos", "traéis", "traen"],
  poner: ["pongo", "pones", "pone", "ponemos", "ponéis", "ponen"],
  valer: ["valgo", "vales", "vale", "valemos", "valéis", "valen"],
  oír: ["oigo", "oyes", "oye", "oímos", "oís", "oyen"],
};

/** Infinitivos que ninguna glosa nombra y que el texto NO deja deducir. La
 *  vuelta atras desde la forma solo sabe sacar -ar, asi que `gruñó` daba
 *  "gruñar": la i de -ir se come detras de ñ y de ll, y ahi las dos
 *  conjugaciones acaban igual. Sembrando el infinitivo de verdad, el indice lo
 *  encuentra antes que al inventado. */
const CONOCIDOS = ["gruñir", "bullir", "teñir", "reñir", "ceñir", "tañer", "engullir", "zambullir"];

/** La primera persona de -cer / -cir NO es regular y el fallo no se ve en la
 *  tabla salvo que se lea la fila de yo: `conoco`, `creco`, `agradeco` no
 *  existen. Vocal delante, -zco (conozco, crezco, produzco); consonante
 *  delante, -zo (venzo, esparzo). `hacer` y `decir` ya van enteros arriba. */
function primeraDeCer(inf: string): string | null {
  const m = /^(.*?)([aeiouáéíóú]|[^aeiouáéíóú])c(er|ir)$/.exec(inf);
  if (!m) return null;
  const esVocal = /[aeiouáéíóú]/.test(m[2]);
  return `${m[1]}${m[2]}${esVocal ? "zco" : "zo"}`;
}

function conjugaRegular(inf: string): string[] | null {
  const raiz = inf.slice(0, -2);
  const fin = inf.slice(-2);
  if (fin === "ar") return [`${raiz}o`, `${raiz}as`, `${raiz}a`, `${raiz}amos`, `${raiz}áis`, `${raiz}an`];
  if (fin === "er") return [`${raiz}o`, `${raiz}es`, `${raiz}e`, `${raiz}emos`, `${raiz}éis`, `${raiz}en`];
  if (fin === "ir") return [`${raiz}o`, `${raiz}es`, `${raiz}e`, `${raiz}imos`, `${raiz}ís`, `${raiz}en`];
  return null;
}

/** Presente de indicativo del infinitivo, ya adaptado a la variante. */
function presente(inf: string, variante: string): string[] | null {
  const base = IRREGULARES[inf] ?? conjugaRegular(inf);
  if (!base) return null;
  const filas = [...base];
  if (!IRREGULARES[inf]) {
    const yo = primeraDeCer(inf);
    if (yo) filas[0] = yo;
  }
  if (variante !== "spain") {
    // ustedes toma la forma de ellos; el hueco de vosotros desaparece.
    filas[4] = filas[5];
  }
  if (variante === "argentina" || variante === "uruguay") {
    const raiz = inf.slice(0, -2);
    const fin = inf.slice(-2);
    filas[1] = fin === "ar" ? `${raiz}ás` : fin === "er" ? `${raiz}és` : `${raiz}ís`;
    if (inf === "ser") filas[1] = "sos";
    if (inf === "ir") filas[1] = "vas";
    if (inf === "tener") filas[1] = "tenés";
  }
  return filas;
}

// ── Pretérito e imperfecto ───────────────────────────────────────────────
// El A0 narra en presente y con eso bastaba. Estas historias C1 narran en
// PASADO, asi que una tabla de presente enseña un paradigma que no es el que
// el lector tiene delante. Las dos formas del pasado son mas regulares que el
// presente: el imperfecto solo tiene tres irregulares en toda la lengua, y el
// preterito concentra los suyos en una lista cerrada de raices fuertes.

/** Raiz fuerte del preterito. Terminaciones sin tilde: -e, -iste, -o, -imos… */
const PRET_FUERTE: Record<string, string> = {
  tener: "tuv", estar: "estuv", poder: "pud", poner: "pus", saber: "sup",
  querer: "quis", venir: "vin", hacer: "hic", decir: "dij", traer: "traj",
  andar: "anduv", caber: "cup", haber: "hub", conducir: "conduj", producir: "produj",
};
/** Los que no siguen ningun patron: se escriben enteros. */
const PRET_ENTERO: Record<string, string[]> = {
  ser: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
  ir: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
  dar: ["di", "diste", "dio", "dimos", "disteis", "dieron"],
  ver: ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
};
/** -ir con cambio vocalico: solo en la 3a persona (pidio, pidieron). */
const PRET_CAMBIO: Record<string, string> = {
  pedir: "pid", seguir: "sigu", sentir: "sint", dormir: "durm", morir: "mur",
  repetir: "repit", servir: "sirv", vestir: "vist", preferir: "prefir",
  mentir: "mint", divertir: "divirt", conseguir: "consigu", reir: "ri", reír: "ri",
  sonreir: "sonri", sonreír: "sonri", elegir: "elig", corregir: "corrig",
};
/** Raiz que pasa la i a y entre vocales (leyo, cayo, oyo, construyo). */
const PRET_Y = /(?:[aeiou]er|[aeiou]ir|uir)$/;

function preterito(inf: string): string[] | null {
  if (PRET_ENTERO[inf]) return [...PRET_ENTERO[inf]];
  const raiz = inf.slice(0, -2);
  // `oír` acaba en "ír", no en "ir", y sin deshacer la tilde no entraba por
  // ninguna rama: devolvia null y ganaba un alias sin tilde que ademas
  // ensenaba el infinitivo mal escrito.
  const fin = inf.slice(-2).replace(/^í/, "i").replace(/^é/, "e").replace(/^á/, "a");
  if (PRET_FUERTE[inf]) {
    const r = PRET_FUERTE[inf];
    const tercera = inf === "hacer" ? "hizo" : `${r}o`;
    const ellos = r.endsWith("j") ? `${r}eron` : `${r}ieron`;
    return [`${r}e`, `${r}iste`, tercera, `${r}imos`, `${r}isteis`, ellos];
  }
  if (fin === "ar") {
    // La ortografia protege el sonido de la raiz en la 1a: busque, llegue, empece.
    let yo = `${raiz}é`;
    if (raiz.endsWith("c")) yo = `${raiz.slice(0, -1)}qué`;
    else if (raiz.endsWith("g")) yo = `${raiz}ué`;
    else if (raiz.endsWith("z")) yo = `${raiz.slice(0, -1)}cé`;
    return [yo, `${raiz}aste`, `${raiz}ó`, `${raiz}amos`, `${raiz}asteis`, `${raiz}aron`];
  }
  if (fin !== "er" && fin !== "ir") return null;
  const cambio = PRET_CAMBIO[inf];
  const r3 = cambio ?? raiz;
  if (PRET_Y.test(`${raiz}${fin}`) && !cambio) {
    // Detras de vocal la i queda tonica y se escribe con tilde: caiste y
    // caimos no son palabras, caíste y caímos si. En los de -uir no, porque
    // "ui" no la lleva (construiste, construimos).
    const t = /[aeo]$/.test(raiz) ? "í" : "i";
    return [`${raiz}í`, `${raiz}${t}ste`, `${raiz}yó`, `${raiz}${t}mos`, `${raiz}${t}steis`, `${raiz}yeron`];
  }
  // La i de la terminacion se come detras de ñ, ll y j: gruñó, bulló, dijo.
  const comeI = /(?:ñ|ll|j)$/.test(r3);
  // `rio` va sin tilde (monosilabo); `gruñó` la lleva, que es donde cae el
  // acento. Se come la i, no la tilde.
  const monosilabo = cambio === "ri" || cambio === "sonri";
  const tercera = monosilabo ? `${r3}o` : comeI ? `${r3}ó` : `${r3}ió`;
  const ellos = monosilabo || comeI ? `${r3}eron` : `${r3}ieron`;
  return [`${raiz}í`, `${raiz}iste`, tercera, `${raiz}imos`, `${raiz}isteis`, ellos];
}

/** Imperfecto. Tres irregulares en toda la lengua y ni uno mas. */
function imperfecto(inf: string): string[] | null {
  if (inf === "ser") return ["era", "eras", "era", "éramos", "erais", "eran"];
  if (inf === "ir") return ["iba", "ibas", "iba", "íbamos", "ibais", "iban"];
  if (inf === "ver") return ["veía", "veías", "veía", "veíamos", "veíais", "veían"];
  const raiz = inf.slice(0, -2);
  const fin = inf.slice(-2).replace(/^í/, "i").replace(/^é/, "e").replace(/^á/, "a");
  if (fin === "ar") return [`${raiz}aba`, `${raiz}abas`, `${raiz}aba`, `${raiz}ábamos`, `${raiz}abais`, `${raiz}aban`];
  if (fin === "er" || fin === "ir") return [`${raiz}ía`, `${raiz}ías`, `${raiz}ía`, `${raiz}íamos`, `${raiz}íais`, `${raiz}ían`];
  return null;
}

/** Adapta cualquier tabla de seis a la variante (ustedes toma la de ellos). */
function aVariante(filas: string[], variante: string): string[] {
  const out = [...filas];
  if (variante !== "spain") out[4] = out[5];
  return out;
}


// ── Portugués de Brasil ──────────────────────────────────────────────────
// El paradigma brasileño tiene CINCO casillas útiles, no seis: `tu` casi no se
// usa y `vós` no existe fuera de la liturgia, así que la segunda persona la
// ocupa `você`, que conjuga como la tercera. Se escribe una fila por persona
// igual que en español para que la tarjeta se lea igual, con `você` en la
// segunda y `vocês` en la quinta.
const PT_PERSONAS = ["eu", "você", "ele, ela", "nós", "vocês", "eles"];

/** Los que no siguen patrón: se escriben enteros, tiempo a tiempo. */
const PT_IRR: Record<string, Record<Tiempo, string[]>> = {
  ser:    { presente: ["sou","é","é","somos","são","são"], "pretérito": ["fui","foi","foi","fomos","foram","foram"], imperfecto: ["era","era","era","éramos","eram","eram"] },
  estar:  { presente: ["estou","está","está","estamos","estão","estão"], "pretérito": ["estive","esteve","esteve","estivemos","estiveram","estiveram"], imperfecto: ["estava","estava","estava","estávamos","estavam","estavam"] },
  ter:    { presente: ["tenho","tem","tem","temos","têm","têm"], "pretérito": ["tive","teve","teve","tivemos","tiveram","tiveram"], imperfecto: ["tinha","tinha","tinha","tínhamos","tinham","tinham"] },
  ir:     { presente: ["vou","vai","vai","vamos","vão","vão"], "pretérito": ["fui","foi","foi","fomos","foram","foram"], imperfecto: ["ia","ia","ia","íamos","iam","iam"] },
  fazer:  { presente: ["faço","faz","faz","fazemos","fazem","fazem"], "pretérito": ["fiz","fez","fez","fizemos","fizeram","fizeram"], imperfecto: ["fazia","fazia","fazia","fazíamos","faziam","faziam"] },
  dizer:  { presente: ["digo","diz","diz","dizemos","dizem","dizem"], "pretérito": ["disse","disse","disse","dissemos","disseram","disseram"], imperfecto: ["dizia","dizia","dizia","dizíamos","diziam","diziam"] },
  poder:  { presente: ["posso","pode","pode","podemos","podem","podem"], "pretérito": ["pude","pôde","pôde","pudemos","puderam","puderam"], imperfecto: ["podia","podia","podia","podíamos","podiam","podiam"] },
  querer: { presente: ["quero","quer","quer","queremos","querem","querem"], "pretérito": ["quis","quis","quis","quisemos","quiseram","quiseram"], imperfecto: ["queria","queria","queria","queríamos","queriam","queriam"] },
  vir:    { presente: ["venho","vem","vem","vimos","vêm","vêm"], "pretérito": ["vim","veio","veio","viemos","vieram","vieram"], imperfecto: ["vinha","vinha","vinha","vínhamos","vinham","vinham"] },
  ver:    { presente: ["vejo","vê","vê","vemos","veem","veem"], "pretérito": ["vi","viu","viu","vimos","viram","viram"], imperfecto: ["via","via","via","víamos","viam","viam"] },
  dar:    { presente: ["dou","dá","dá","damos","dão","dão"], "pretérito": ["dei","deu","deu","demos","deram","deram"], imperfecto: ["dava","dava","dava","dávamos","davam","davam"] },
  saber:  { presente: ["sei","sabe","sabe","sabemos","sabem","sabem"], "pretérito": ["soube","soube","soube","soubemos","souberam","souberam"], imperfecto: ["sabia","sabia","sabia","sabíamos","sabiam","sabiam"] },
  pôr:    { presente: ["ponho","põe","põe","pomos","põem","põem"], "pretérito": ["pus","pôs","pôs","pusemos","puseram","puseram"], imperfecto: ["punha","punha","punha","púnhamos","punham","punham"] },
  trazer: { presente: ["trago","traz","traz","trazemos","trazem","trazem"], "pretérito": ["trouxe","trouxe","trouxe","trouxemos","trouxeram","trouxeram"], imperfecto: ["trazia","trazia","trazia","trazíamos","traziam","traziam"] },
  haver:  { presente: ["hei","há","há","havemos","hão","hão"], "pretérito": ["houve","houve","houve","houvemos","houveram","houveram"], imperfecto: ["havia","havia","havia","havíamos","haviam","haviam"] },
};

/**
 * Familias que NO se conjugan por regla porque la regla las rompe:
 *
 *   -air, -uir, -oer   cair da "cao, cae" en vez de "caio, cai"
 *   -ear, -iar         passear da "passeo" en vez de "passeio"
 *   -ir con cambio     dormir da "dormo" en vez de "durmo"
 *   -er con cambio     perder da "perdo" en vez de "perco"
 *
 * Verificado el 2026-08-27 mirando las 137 tablas generadas para el A0
 * brasileño: la fila que sale en el texto coincidia, y las otras cinco no. Una
 * palabra sin bloque no enseña nada; una con el bloque mal enseña algo falso.
 */
const PT_NO_REGULARES = /(air|uir|oer|ear|iar)$/;
const PT_CAMBIO = new Set([
  "dormir","servir","pedir","ouvir","seguir","sentir","vestir","preferir","repetir","medir",
  "mentir","conseguir","divertir","subir","fugir","cobrir","descobrir","engolir","tossir",
  "perder","valer","caber","ler","crer","erguer","doer","soer","medir",
]);

function ptConjuga(inf: string, tiempo: Tiempo): string[] | null {
  if (PT_IRR[inf]) return [...PT_IRR[inf][tiempo]];
  if (PT_NO_REGULARES.test(inf) || PT_CAMBIO.has(inf)) return null;
  const raiz = inf.slice(0, -2);
  const fin = inf.slice(-2);
  if (fin !== "ar" && fin !== "er" && fin !== "ir") return null;
  if (tiempo === "presente") {
    // La primera persona protege el sonido de la raiz: conheco se escribe
    // conheço, dirigo se escribe dirijo, ergo se escribe ergo.
    let eu = `${raiz}o`;
    if (fin !== "ar") {
      if (raiz.endsWith("c")) eu = `${raiz.slice(0, -1)}ço`;
      else if (raiz.endsWith("g")) eu = `${raiz.slice(0, -1)}jo`;
      else if (raiz.endsWith("gu")) eu = `${raiz.slice(0, -1)}o`;
    }
    if (fin === "ar") return [eu, `${raiz}a`, `${raiz}a`, `${raiz}amos`, `${raiz}am`, `${raiz}am`];
    if (fin === "er") return [eu, `${raiz}e`, `${raiz}e`, `${raiz}emos`, `${raiz}em`, `${raiz}em`];
    return [eu, `${raiz}e`, `${raiz}e`, `${raiz}imos`, `${raiz}em`, `${raiz}em`];
  }
  if (tiempo === "pretérito") {
    if (fin === "ar") {
      // La ortografia protege el sonido de la raiz en la primera: fiquei,
      // cheguei, comecei.
      let eu = `${raiz}ei`;
      if (raiz.endsWith("c")) eu = `${raiz.slice(0, -1)}quei`;
      else if (raiz.endsWith("g")) eu = `${raiz}uei`;
      else if (raiz.endsWith("ç")) eu = `${raiz.slice(0, -1)}cei`;
      return [eu, `${raiz}ou`, `${raiz}ou`, `${raiz}amos`, `${raiz}aram`, `${raiz}aram`];
    }
    if (fin === "er") return [`${raiz}i`, `${raiz}eu`, `${raiz}eu`, `${raiz}emos`, `${raiz}eram`, `${raiz}eram`];
    return [`${raiz}i`, `${raiz}iu`, `${raiz}iu`, `${raiz}imos`, `${raiz}iram`, `${raiz}iram`];
  }
  if (fin === "ar") return [`${raiz}ava`, `${raiz}ava`, `${raiz}ava`, `${raiz}ávamos`, `${raiz}avam`, `${raiz}avam`];
  return [`${raiz}ia`, `${raiz}ia`, `${raiz}ia`, `${raiz}íamos`, `${raiz}iam`, `${raiz}iam`];
}


// ── Italiano ─────────────────────────────────────────────────────────────
// Estas historias narran en PRESENTE, como el A0 español, y el pasado que sale
// es el imperfetto. El passato remoto es literario y no aparece, asi que no se
// escribe: un tiempo que ninguna historia usa no vale la superficie de error.
const IT_PERSONAS = ["io", "tu", "lui, lei", "noi", "voi", "loro"];

/** Los -ire que meten -isc- en las tres personas del singular y en loro. */
const IT_ISC = new Set([
  "capire","finire","preferire","pulire","spedire","costruire","unire","punire","sparire",
  "colpire","guarire","chiarire","fornire","riunire","stupire","suggerire","restituire",
]);

/** Irregulares del presente, enteros. */
const IT_IRR: Record<string, string[]> = {
  essere:  ["sono","sei","è","siamo","siete","sono"],
  avere:   ["ho","hai","ha","abbiamo","avete","hanno"],
  andare:  ["vado","vai","va","andiamo","andate","vanno"],
  fare:    ["faccio","fai","fa","facciamo","fate","fanno"],
  dire:    ["dico","dici","dice","diciamo","dite","dicono"],
  stare:   ["sto","stai","sta","stiamo","state","stanno"],
  dare:    ["do","dai","dà","diamo","date","danno"],
  venire:  ["vengo","vieni","viene","veniamo","venite","vengono"],
  uscire:  ["esco","esci","esce","usciamo","uscite","escono"],
  potere:  ["posso","puoi","può","possiamo","potete","possono"],
  volere:  ["voglio","vuoi","vuole","vogliamo","volete","vogliono"],
  dovere:  ["devo","devi","deve","dobbiamo","dovete","devono"],
  sapere:  ["so","sai","sa","sappiamo","sapete","sanno"],
  bere:    ["bevo","bevi","beve","beviamo","bevete","bevono"],
  tenere:  ["tengo","tieni","tiene","teniamo","tenete","tengono"],
  rimanere:["rimango","rimani","rimane","rimaniamo","rimanete","rimangono"],
  salire:  ["salgo","sali","sale","saliamo","salite","salgono"],
  sedere:  ["siedo","siedi","siede","sediamo","sedete","siedono"],
  sedersi: ["mi siedo","ti siedi","si siede","ci sediamo","vi sedete","si siedono"],
  piacere: ["piaccio","piaci","piace","piacciamo","piacete","piacciono"],
  scegliere:["scelgo","scegli","sceglie","scegliamo","scegliete","scelgono"],
  togliere:["tolgo","togli","toglie","togliamo","togliete","tolgono"],
  morire:  ["muoio","muori","muore","moriamo","morite","muoiono"],
  tradurre:["traduco","traduci","traduce","traduciamo","traducete","traducono"],
};

/** Familias que la regla rompe y que por eso NO se conjugan. */
const IT_NO = /(rre|urre|orre)$/;

/** La h de -care / -gare y la i que se cae en -ciare / -giare. */
function itRaiz(raiz: string, term: string): string {
  if (term.startsWith("i")) {
    if (raiz.endsWith("c") || raiz.endsWith("g")) return `${raiz}h`;
    if (raiz.endsWith("ci") || raiz.endsWith("gi")) return raiz.slice(0, -1);
  }
  return raiz;
}

function itConjuga(inf: string, tiempo: Tiempo): string[] | null {
  if (tiempo === "pretérito") return null;
  if (IT_IRR[inf] && tiempo === "presente") return [...IT_IRR[inf]];
  if (IT_NO.test(inf) && !IT_IRR[inf]) return null;
  const raiz = inf.slice(0, -3);
  const fin = inf.slice(-3);
  if (fin !== "are" && fin !== "ere" && fin !== "ire") return null;
  if (tiempo === "imperfecto") {
    const v = fin[0];
    return [`${raiz}${v}vo`, `${raiz}${v}vi`, `${raiz}${v}va`, `${raiz}${v}vamo`, `${raiz}${v}vate`, `${raiz}${v}vano`];
  }
  if (fin === "are") {
    return [`${raiz}o`, `${itRaiz(raiz, "i")}i`, `${raiz}a`, `${itRaiz(raiz, "iamo")}iamo`, `${raiz}ate`, `${raiz}ano`];
  }
  if (fin === "ere") return [`${raiz}o`, `${raiz}i`, `${raiz}e`, `${raiz}iamo`, `${raiz}ete`, `${raiz}ono`];
  if (IT_ISC.has(inf)) {
    return [`${raiz}isco`, `${raiz}isci`, `${raiz}isce`, `${raiz}iamo`, `${raiz}ite`, `${raiz}iscono`];
  }
  return [`${raiz}o`, `${raiz}i`, `${raiz}e`, `${raiz}iamo`, `${raiz}ite`, `${raiz}ono`];
}


// ── Alemán ───────────────────────────────────────────────────────────────
// El más difícil de los cuatro, y por eso el que más se niega a conjugar. Tres
// trampas que no tiene ninguna lengua romance de este fichero:
//
//   1. El PARTICIPIO acaba en -en igual que el infinitivo (angekommen,
//      geschrieben, verstanden). Conjugarlo como infinitivo daria "ich
//      angekomme", que no existe.
//   2. Los verbos FUERTES cambian la vocal en du y er (fahren -> du fährst),
//      y no hay regla: van escritos uno a uno.
//   3. Los SEPARABLES sueltan el prefijo (aufstehen -> ich stehe auf), asi que
//      la fila no es una palabra sino dos con algo en medio.
//
// Lo que no cae en la tabla no se conjuga.
const DE_PERSONAS = ["ich", "du", "er, sie, es", "wir", "ihr", "sie, Sie"];

/** Participios de prefijo inseparable: no llevan ge-, asi que la forma sola no
 *  los delata y hay que nombrarlos. */
const DE_PART_INSEP = new Set([
  "begriffen","bestanden","verstanden","verschwunden","vergessen","unterschrieben","zerbrochen",
  "beschrieben","empfangen","entschieden","erfahren","verloren","versprochen","vertreten",
]);

/** Formas FLEXIONADAS que acaban en -en y que la busqueda de infinitivos
 *  recoge por su forma: un preterito de plural (anfingen, wussten), un
 *  Konjunktiv (brauchten, mochten). Verificado el 2026-08-27 leyendo las 99
 *  tablas generadas: cada una de estas producia un paradigma inventado del
 *  tipo "ich finge … an". */
const DE_NO_ES_INFINITIVO = new Set([
  "anfingen","bräuchten","möchten","wussten","dachten","gingen","kamen","waren","hatten",
  "wurden","konnten","mussten","durften","wollten","sollten","mochten","standen","fanden",
  // kennenlernen separa por el PRIMER verbo ("ich lerne dich kennen"), que es un
  // patron distinto al del prefijo y no vale la pena escribir para un caso.
  "kennenlernen","dabeihaben",
  // Participios fuertes SIN ge-: acaban en -en y parecen infinitivos, pero no
  // lo son. `verwoben` daba "verwobe / verwobst", que no es una palabra.
  "verwoben","verloren","gewonnen","vergessen","verstanden","begonnen","empfohlen",
  "entschieden","geschrieben","genommen","gesprochen","gestohlen","zerbrochen",
]);

/** Participios y formas de pasado que TERMINAN en -en pero no son infinitivos. */
function esParticipio(w: string): boolean {
  if (DE_PART_INSEP.has(w)) return true;
  if (/^ge.+(en|t)$/.test(w)) return true;
  // ge- interno de los separables: angekommen, aufgeschlagen, herumgesprochen.
  if (/^[a-zäöüß]{2,}ge[a-zäöüß]+(en|t)$/.test(w) && !/^(gegen|gehen|gehören|gedeihen|gewinnen)$/.test(w)) return true;
  return false;
}

/** Fuertes e irregulares: presente y Präteritum enteros. */
const DE_IRR: Record<string, { presente: string[]; "pretérito": string[] }> = {
  sein:    { presente: ["bin","bist","ist","sind","seid","sind"], "pretérito": ["war","warst","war","waren","wart","waren"] },
  haben:   { presente: ["habe","hast","hat","haben","habt","haben"], "pretérito": ["hatte","hattest","hatte","hatten","hattet","hatten"] },
  // Fuertes con cambio de vocal en du y er/sie/es. Sin ellos el generador los
  // trata como debiles y saca `esst` para du, `fallst`, `stoßt`, `werft`: la
  // fila que el lector NO tiene delante, que es justo la que nadie mira.
  essen:   { presente: ["esse","isst","isst","essen","esst","essen"], "pretérito": ["aß","aßest","aß","aßen","aßt","aßen"] },
  fallen:  { presente: ["falle","fällst","fällt","fallen","fallt","fallen"], "pretérito": ["fiel","fielst","fiel","fielen","fielt","fielen"] },
  stoßen:  { presente: ["stoße","stößt","stößt","stoßen","stoßt","stoßen"], "pretérito": ["stieß","stießest","stieß","stießen","stießt","stießen"] },
  werfen:  { presente: ["werfe","wirfst","wirft","werfen","werft","werfen"], "pretérito": ["warf","warfst","warf","warfen","warft","warfen"] },
  werden:  { presente: ["werde","wirst","wird","werden","werdet","werden"], "pretérito": ["wurde","wurdest","wurde","wurden","wurdet","wurden"] },
  können:  { presente: ["kann","kannst","kann","können","könnt","können"], "pretérito": ["konnte","konntest","konnte","konnten","konntet","konnten"] },
  müssen:  { presente: ["muss","musst","muss","müssen","müsst","müssen"], "pretérito": ["musste","musstest","musste","mussten","musstet","mussten"] },
  dürfen:  { presente: ["darf","darfst","darf","dürfen","dürft","dürfen"], "pretérito": ["durfte","durftest","durfte","durften","durftet","durften"] },
  wollen:  { presente: ["will","willst","will","wollen","wollt","wollen"], "pretérito": ["wollte","wolltest","wollte","wollten","wolltet","wollten"] },
  sollen:  { presente: ["soll","sollst","soll","sollen","sollt","sollen"], "pretérito": ["sollte","solltest","sollte","sollten","solltet","sollten"] },
  mögen:   { presente: ["mag","magst","mag","mögen","mögt","mögen"], "pretérito": ["mochte","mochtest","mochte","mochten","mochtet","mochten"] },
  wissen:  { presente: ["weiß","weißt","weiß","wissen","wisst","wissen"], "pretérito": ["wusste","wusstest","wusste","wussten","wusstet","wussten"] },
  gehen:   { presente: ["gehe","gehst","geht","gehen","geht","gehen"], "pretérito": ["ging","gingst","ging","gingen","gingt","gingen"] },
  kommen:  { presente: ["komme","kommst","kommt","kommen","kommt","kommen"], "pretérito": ["kam","kamst","kam","kamen","kamt","kamen"] },
  sehen:   { presente: ["sehe","siehst","sieht","sehen","seht","sehen"], "pretérito": ["sah","sahst","sah","sahen","saht","sahen"] },
  lesen:   { presente: ["lese","liest","liest","lesen","lest","lesen"], "pretérito": ["las","lasest","las","lasen","last","lasen"] },
  nehmen:  { presente: ["nehme","nimmst","nimmt","nehmen","nehmt","nehmen"], "pretérito": ["nahm","nahmst","nahm","nahmen","nahmt","nahmen"] },
  geben:   { presente: ["gebe","gibst","gibt","geben","gebt","geben"], "pretérito": ["gab","gabst","gab","gaben","gabt","gaben"] },
  sprechen:{ presente: ["spreche","sprichst","spricht","sprechen","sprecht","sprechen"], "pretérito": ["sprach","sprachst","sprach","sprachen","spracht","sprachen"] },
  lassen:  { presente: ["lasse","lässt","lässt","lassen","lasst","lassen"], "pretérito": ["ließ","ließt","ließ","ließen","ließt","ließen"] },
  halten:  { presente: ["halte","hältst","hält","halten","haltet","halten"], "pretérito": ["hielt","hieltst","hielt","hielten","hieltet","hielten"] },
  tragen:  { presente: ["trage","trägst","trägt","tragen","tragt","tragen"], "pretérito": ["trug","trugst","trug","trugen","trugt","trugen"] },
  fahren:  { presente: ["fahre","fährst","fährt","fahren","fahrt","fahren"], "pretérito": ["fuhr","fuhrst","fuhr","fuhren","fuhrt","fuhren"] },
  laufen:  { presente: ["laufe","läufst","läuft","laufen","lauft","laufen"], "pretérito": ["lief","liefst","lief","liefen","lieft","liefen"] },
  finden:  { presente: ["finde","findest","findet","finden","findet","finden"], "pretérito": ["fand","fandst","fand","fanden","fandet","fanden"] },
  bringen: { presente: ["bringe","bringst","bringt","bringen","bringt","bringen"], "pretérito": ["brachte","brachtest","brachte","brachten","brachtet","brachten"] },
  denken:  { presente: ["denke","denkst","denkt","denken","denkt","denken"], "pretérito": ["dachte","dachtest","dachte","dachten","dachtet","dachten"] },
  bleiben: { presente: ["bleibe","bleibst","bleibt","bleiben","bleibt","bleiben"], "pretérito": ["blieb","bliebst","blieb","blieben","bliebt","blieben"] },
  heißen:  { presente: ["heiße","heißt","heißt","heißen","heißt","heißen"], "pretérito": ["hieß","hießt","hieß","hießen","hießt","hießen"] },
  stehen:  { presente: ["stehe","stehst","steht","stehen","steht","stehen"], "pretérito": ["stand","standst","stand","standen","standet","standen"] },
  verstehen:{ presente: ["verstehe","verstehst","versteht","verstehen","versteht","verstehen"], "pretérito": ["verstand","verstandst","verstand","verstanden","verstandet","verstanden"] },
  ziehen:  { presente: ["ziehe","ziehst","zieht","ziehen","zieht","ziehen"], "pretérito": ["zog","zogst","zog","zogen","zogt","zogen"] },
  gießen:  { presente: ["gieße","gießt","gießt","gießen","gießt","gießen"], "pretérito": ["goss","gossest","goss","gossen","gosst","gossen"] },
  rufen:   { presente: ["rufe","rufst","ruft","rufen","ruft","rufen"], "pretérito": ["rief","riefst","rief","riefen","rieft","riefen"] },
  trinken: { presente: ["trinke","trinkst","trinkt","trinken","trinkt","trinken"], "pretérito": ["trank","trankst","trank","tranken","trankt","tranken"] },
  schwören:{ presente: ["schwöre","schwörst","schwört","schwören","schwört","schwören"], "pretérito": ["schwor","schworst","schwor","schworen","schwort","schworen"] },
  riechen: { presente: ["rieche","riechst","riecht","riechen","riecht","riechen"], "pretérito": ["roch","rochst","roch","rochen","rocht","rochen"] },
  schreiben:{ presente: ["schreibe","schreibst","schreibt","schreiben","schreibt","schreiben"], "pretérito": ["schrieb","schriebst","schrieb","schrieben","schriebt","schrieben"] },
  vergessen:{ presente: ["vergesse","vergisst","vergisst","vergessen","vergesst","vergessen"], "pretérito": ["vergaß","vergaßt","vergaß","vergaßen","vergaßt","vergaßen"] },
  sitzen:  { presente: ["sitze","sitzt","sitzt","sitzen","sitzt","sitzen"], "pretérito": ["saß","saßest","saß","saßen","saßt","saßen"] },
  liegen:  { presente: ["liege","liegst","liegt","liegen","liegt","liegen"], "pretérito": ["lag","lagst","lag","lagen","lagt","lagen"] },
  streiten:{ presente: ["streite","streitest","streitet","streiten","streitet","streiten"], "pretérito": ["stritt","strittst","stritt","stritten","strittet","stritten"] },
  laden:   { presente: ["lade","lädst","lädt","laden","ladet","laden"], "pretérito": ["lud","ludst","lud","luden","ludet","luden"] },
  raten:   { presente: ["rate","rätst","rät","raten","ratet","raten"], "pretérito": ["riet","rietst","riet","rieten","rietet","rieten"] },
  besitzen:{ presente: ["besitze","besitzt","besitzt","besitzen","besitzt","besitzen"], "pretérito": ["besaß","besaßest","besaß","besaßen","besaßt","besaßen"] },
  hängen:  { presente: ["hänge","hängst","hängt","hängen","hängt","hängen"], "pretérito": ["hing","hingst","hing","hingen","hingt","hingen"] },
};

/** Débiles: la regla. La -e de apoyo en raices en -t, -d y en -chn / -ffn / -gn,
 *  y la fusion de la -s en du cuando la raiz ya acaba en s, ß, z o x. */
function deDebil(inf: string, tiempo: Tiempo): string[] | null {
  const raiz = inf.endsWith("eln") || inf.endsWith("ern") ? inf.slice(0, -1) : inf.slice(0, -2);
  if (!raiz) return null;
  const apoyo = /(t|d|chn|ffn|gn|dm|tm)$/.test(raiz);
  const sibilante = /(s|ß|z|x)$/.test(raiz);
  const e = apoyo ? "e" : "";
  if (tiempo === "presente") {
    const du = sibilante ? `${raiz}${e}t` : `${raiz}${e}st`;
    return [`${raiz}e`, du, `${raiz}${e}t`, `${raiz}en`, `${raiz}${e}t`, `${raiz}en`];
  }
  if (tiempo === "pretérito") {
    return [`${raiz}${e}te`, `${raiz}${e}test`, `${raiz}${e}te`, `${raiz}${e}ten`, `${raiz}${e}tet`, `${raiz}${e}ten`];
  }
  return null;
}

/** Prefijos que se sueltan. La fila se escribe "stehe … auf" para que se vea. */
const DE_SEPARABLES = /^(ab|an|auf|aus|bei|ein|her|hin|los|mit|nach|vor|weg|zu|zurück|zusammen|herum|rein|durch)(?=[a-zäöüß]{3,})/;

function deConjuga(inf: string, tiempo: Tiempo): string[] | null {
  if (tiempo === "imperfecto") return null; // el alemán no tiene esa casilla
  if (esParticipio(inf) || DE_NO_ES_INFINITIVO.has(inf)) return null;
  if (DE_IRR[inf]) return [...DE_IRR[inf][tiempo]];
  const sep = DE_SEPARABLES.exec(inf);
  if (sep) {
    const prefijo = sep[1];
    const base = inf.slice(prefijo.length);
    const filas = DE_IRR[base] ? DE_IRR[base][tiempo] : deDebil(base, tiempo);
    if (!filas) return null;
    // En oracion principal el prefijo se va al final en las SEIS personas:
    // "wir bringen das mit", no "wir mitbringen". Solo el infinitivo lo lleva
    // pegado, y el infinitivo ya va en la etiqueta `lemma`, no en una fila.
    return filas.map((f) => `${f} … ${prefijo}`);
  }
  if (!/en$/.test(inf)) return null;
  return deDebil(inf, tiempo);
}

export type Tiempo = "presente" | "pretérito" | "imperfecto";
const TIEMPOS: Array<{ id: Tiempo; fn: (inf: string, v: string) => string[] | null }> = [
  { id: "presente", fn: (inf, v) => presente(inf, v) },
  { id: "pretérito", fn: (inf, v) => { const f = preterito(inf); return f ? aVariante(f, v) : null; } },
  { id: "imperfecto", fn: (inf, v) => { const f = imperfecto(inf); return f ? aVariante(f, v) : null; } },
];

/** Idioma del bundle: decide el paradigma y las etiquetas de persona. Un
 *  idioma que no esté aquí NO se conjuga; el script para antes de escribir. */
const IDIOMAS: Record<string, { personas: (v: string) => string[]; conjuga: (inf: string, t: Tiempo, v: string) => string[] | null }> = {
  spanish: { personas, conjuga: (inf, t, v) => tablaDeES(inf, t, v) },
  portuguese: { personas: () => PT_PERSONAS, conjuga: (inf, t) => ptConjuga(inf, t) },
  italian: { personas: () => IT_PERSONAS, conjuga: (inf, t) => itConjuga(inf, t) },
  german: { personas: () => DE_PERSONAS, conjuga: (inf, t) => deConjuga(inf, t) },
};

/** Del infinitivo a las formas: sirve para saber qué palabra del texto es qué.
 *  Indexa los tres tiempos, y el primero que reclame una forma se la queda. El
 *  orden importa poco porque las formas casi no chocan entre tiempos; donde
 *  chocan (hablamos, presente y preterito) gana el presente, que es el que un
 *  hispanohablante lee por defecto. */
function indicePorForma(infinitivos: string[], variante: string, idioma: string) {
  const motor = IDIOMAS[idioma];
  const mapa = new Map<string, { inf: string; i: number; tiempo: Tiempo }>();
  for (const { id } of TIEMPOS) {
    for (const inf of infinitivos) {
      const filas = motor.conjuga(inf, id, variante);
      if (!filas) continue;
      filas.forEach((f, i) => {
        const clave = f.toLowerCase();
        if (!mapa.has(clave)) mapa.set(clave, { inf, i, tiempo: id });
      });
    }
  }
  return mapa;
}

/** La tabla del tiempo que toca, ya adaptada a la variante. Solo español. */
function tablaDeES(inf: string, tiempo: Tiempo, variante: string): string[] | null {
  const t = TIEMPOS.find((x) => x.id === tiempo);
  return t ? t.fn(inf, variante) : null;
}

// ── Sustantivos ──────────────────────────────────────────────────────────
function plural(sg: string): string {
  const s = sg.toLowerCase();
  if (/[aeiouáéíóú]$/.test(s)) return `${sg}s`;
  if (/z$/.test(s)) return `${sg.slice(0, -1)}ces`;
  if (/[^aeiouáéíóú]s$/.test(s)) return sg; // el lunes, los lunes
  // La tilde de -ción y -és se cae al crecer la palabra.
  const sinTilde = sg
    .replace(/ción$/, "ciones")
    .replace(/sión$/, "siones")
    .replace(/és$/, "eses");
  if (sinTilde !== sg) return sinTilde;
  return `${sg}es`;
}
function singularDe(pl: string): string | null {
  const s = pl.toLowerCase();
  if (/ciones$/.test(s)) return pl.replace(/ciones$/, "ción");
  if (/siones$/.test(s)) return pl.replace(/siones$/, "sión");
  if (/ces$/.test(s)) return `${pl.slice(0, -3)}z`;
  if (/[aeiou]s$/.test(s)) return pl.slice(0, -1);
  if (/es$/.test(s)) return pl.slice(0, -2);
  return null;
}

// ── Adjetivos ────────────────────────────────────────────────────────────
function formasAdjetivo(forma: string): { masculino: string; filas: string[][]; here: number } | null {
  const f = forma.toLowerCase();
  const cuatro = (m: string) => [
    ["m.", m],
    ["f.", `${m.slice(0, -1)}a`],
    ["m. pl.", `${m}s`],
    ["f. pl.", `${m.slice(0, -1)}as`],
  ];
  if (/os$/.test(f)) { const m = f.slice(0, -1); return { masculino: m, filas: cuatro(m), here: 2 }; }
  if (/as$/.test(f)) { const m = `${f.slice(0, -2)}o`; return { masculino: m, filas: cuatro(m), here: 3 }; }
  if (/a$/.test(f)) { const m = `${f.slice(0, -1)}o`; return { masculino: m, filas: cuatro(m), here: 1 }; }
  if (/o$/.test(f)) { return { masculino: f, filas: cuatro(f), here: 0 }; }
  // grande, fuerte, gris: solo número
  const pl = plural(f);
  if (pl === f) return null;
  return { masculino: f, filas: [["sing.", f], ["pl.", pl]], here: 0 };
}

const ARTICULOS_M = new Set(["el", "un", "los", "unos", "del", "al"]);
const ARTICULOS_F = new Set(["la", "una", "las", "unas"]);

async function main() {
  const nombre = process.argv[2];
  const dry = process.argv.includes("--dry");
  if (!nombre) {
    console.error("uso: npx tsx scripts/buildGlossForms.ts <bundle> <textos.json> [--dry]");
    process.exit(1);
  }
  // Las glosas viven en dp_tap_glosses_v1 desde el 2026-08-26: la fila de slug
  // "" es el mapa global del bundle y las demas son la capa de cada historia.
  const filas = await prisma.tapGlossSet.findMany({ where: { bundle: nombre } });
  const global = filas.find((f) => f.slug === "");
  if (!global) { console.error(`el bundle ${nombre} no existe en la base`); process.exit(1); }
  const bundle: Bundle = {
    language: global.language ?? undefined,
    variant: global.variant ?? undefined,
    slugs: global.slugs,
    glosses: global.glosses as Bundle["glosses"],
    byStory: Object.fromEntries(filas.filter((f) => f.slug !== "").map((f) => [f.slug, f.glosses as Record<string, Entrada>])),
  };
  const variante = (bundle.variant ?? "").trim().toLowerCase();
  const idioma = (bundle.language ?? "").toLowerCase();
  const motor = IDIOMAS[idioma];
  if (!motor) {
    console.error(`idioma "${idioma}" sin paradigma escrito: no conjugo nada antes que conjugar mal.`);
    console.error(`Escribe su entrada en IDIOMAS y vuelve. Idiomas listos: ${Object.keys(IDIOMAS).join(", ")}`);
    process.exit(1);
  }
  const P = motor.personas(variante);

  // Los infinitivos que este bundle conoce: los que ya están glosados como
  // verbo en su forma de diccionario, más los irregulares de la tabla.
  // Los irregulares de SU idioma, no los del español: sembrar la lista con
  // "ser" y "tener" en un bundle italiano no rompia nada (ninguno acaba en
  // -are/-ere/-ire) pero era suerte, no diseño.
  const infinitivos = new Set<string>(
    idioma === "italian" ? Object.keys(IT_IRR)
      : idioma === "portuguese" ? Object.keys(PT_IRR)
      : idioma === "german" ? Object.keys(DE_IRR)
      : [...Object.keys(IRREGULARES), ...CONOCIDOS]
  );
  for (const [k, v] of Object.entries(bundle.glosses)) {
    const FIN_INF = idioma === "italian" ? /(are|ere|ire)$/
      : idioma === "german" ? /(en|eln|ern)$/
      : /(ar|er|ir)$/;
    if (v?.t === "verb" && FIN_INF.test(k)) infinitivos.add(k);
    const m = idioma === "italian"
      ? /\(([a-zàèéìòù]+(?:are|ere|ire))\)/.exec(v?.g ?? "")
      : /\(([a-záéíóúñ]+(?:ar|er|ir))\)/.exec(v?.g ?? "");
    if (m) infinitivos.add(m[1]);
  }
  // Infinitivos que la propia historia delata. Solo -ar, y solo por formas que
  // NO pueden venir de otra conjugacion: -o con tilde y -aba(n) son de -ar y de
  // nada mas. En -er / -ir no se hace: el preterito y el imperfecto de las dos
  // son identicos (-io, -ia), asi que la forma no dice cual es el infinitivo y
  // la etiqueta saldria inventada la mitad de las veces.
  for (const texto of Object.values(
    JSON.parse(fs.readFileSync(process.argv[3] ?? "/dev/null", "utf8").trim() || "{}") as Record<string, string>
  )) {
    for (const w of (texto.match(/\p{L}+/gu) ?? []).map((x) => x.toLowerCase())) {
      if (bundle.glosses[w]?.t !== "verb") continue;
      // Terminaciones que solo puede tener un -ar, por idioma. En -er / -ir no
      // se hace: sus pasados coinciden y la etiqueta saldria inventada.
      if (idioma === "italian" || idioma === "german") continue; // ver el comentario de arriba
      const FIN = idioma === "portuguese"
        ? /^(.+?)(ou|aram|ava|avam|ávamos|ei|amos)$/
        : /^(.+?)(ó|aron|aba|abas|ábamos|aban|é|aste|amos|asteis)$/;
      const m = FIN.exec(w);
      if (!m || m[1].length < 2) continue;
      // Las terminaciones del imperfecto tambien caben DENTRO de un presente:
      // `acaba` no es el imperfecto de "acar", es el presente de acabar. Con
      // dos letras de raiz sale un infinitivo que no existe, asi que ahi se
      // piden tres. Se pierde algun `amaba`, que es el lado bueno de fallar.
      if (/^(aba|abas|ábamos|aban|ava|avam|ávamos)$/.test(m[2]) && m[1].length < 3) continue;
      let raiz = m[1];
      // `-ió` NO es de -ar: esa i es de la terminacion (decidió, escribió,
      // perdió, apareció). Cortando por `ó` sale `decidiar`, que no existe, y
      // la tarjeta ensena un verbo inventado. Cual de los dos es, -er o -ir,
      // no lo dice la forma, asi que aqui se renuncia.
      if (idioma !== "portuguese" && /i$/.test(raiz) && /^(ó|é)$/.test(m[2])) continue;
      // La ortografia de la 1a del preterito tapa la raiz: pegué es de pegar,
      // busqué de buscar, empecé de empezar. Sin deshacerla salen `peguar` y
      // `busquar`.
      if (idioma !== "portuguese" && m[2] === "é") {
        if (/qu$/.test(raiz)) raiz = `${raiz.slice(0, -2)}c`;
        else if (/gu$/.test(raiz)) raiz = raiz.slice(0, -1);
        else if (/c$/.test(raiz)) raiz = `${raiz.slice(0, -1)}z`;
      }
      // `traé` es el imperativo voseante de traer, no un preterito: cortando
      // por la `é` sale "traar", y ningun infinitivo espanol junta dos aes.
      if (idioma !== "portuguese" && /a$/.test(raiz)) continue;
      infinitivos.add(`${raiz}ar`);
    }
  }
  const porForma = indicePorForma([...infinitivos], variante, idioma);

  const textos = JSON.parse(fs.readFileSync(process.argv[3] ?? "/dev/null", "utf8").trim() || "{}") as Record<string, string>;

  let verbos = 0, sustantivos = 0, adjetivos = 0, sinNada = 0;
  const saltadas: string[] = [];
  const salida: Record<string, Record<string, Entrada>> = bundle.byStory ?? {};

  for (const [slug, texto] of Object.entries(textos)) {
    // Una historia escrita a mano NO se regenera: sus trozos traducidos y sus
    // ajustes (helado es sustantivo aquí, la es pronombre) los perdería.
    const yaEscrita = Object.values(salida[slug] ?? {}).some((e) => e?.c);
    if (yaEscrita) { saltadas.push(slug); continue; }
    const entradas = (salida[slug] ??= {});
    const palabras = (texto.match(/\p{L}+/gu) ?? []).map((w) => w.toLowerCase());
    const vistas = new Set<string>();

    palabras.forEach((palabra, i) => {
      if (vistas.has(palabra)) return;
      const base = bundle.glosses[palabra];
      if (!base) return;
      vistas.add(palabra);
      const entrada: Entrada = { ...(entradas[palabra] ?? {}), g: base.g, t: base.t };
      // La tabla se REHACE, no se hereda: si esta pasada ya no sabe conjugar
      // la palabra, tiene que quedarse sin bloque. Heredandola, un arreglo del
      // motor dejaba viva la tabla equivocada que el arreglo venia a quitar.
      delete entrada.f;

      if (base.t === "verb") {
        const hit = porForma.get(palabra);
        if (hit) {
          // El tiempo lo decide la forma que sale en la historia, no el script:
          // estas narran en pasado y una tabla de presente enseñaria otro
          // paradigma que el que el lector tiene delante.
          const filas = motor.conjuga(hit.inf, hit.tiempo, variante)!;
          entrada.f = {
            kind: "expand",
            link: "See conjugation",
            lemma: hit.tiempo === "presente" ? hit.inf : `${hit.inf} (${hit.tiempo})`,
            rows: filas.map((f, idx) => [P[idx], f]),
            here: hit.i,
          };
          verbos++;
        } else sinNada++;
      } else if (false && base.t === "noun") {
        const anterior = palabras[i - 1] ?? "";
        const genero = ARTICULOS_M.has(anterior) ? "m." : ARTICULOS_F.has(anterior) ? "f." : null;
        if (genero) entrada.gm = genero;
        const esPlural = /s$/.test(palabra) && !!singularDe(palabra) && !!bundle.glosses[singularDe(palabra)!];
        const sg = esPlural ? singularDe(palabra)! : palabra;
        const pl = plural(sg);
        if (pl !== sg) {
          entrada.f = { kind: "line", rows: [[esPlural ? "sing." : "pl.", esPlural ? sg : pl]], here: -1 };
          sustantivos++;
        } else sinNada++;
      } else if (false && base.t === "adjective") {
        const formas = formasAdjetivo(palabra);
        if (formas) {
          entrada.f = {
            kind: "line",
            rows: formas.filas.filter((_, idx) => idx !== formas.here),
            here: -1,
          };
          adjetivos++;
        } else sinNada++;
      } else sinNada++;

      entradas[palabra] = entrada;
    });
  }

  console.log(
    `${nombre}: ${verbos} verbos conjugados, ${sustantivos} sustantivos con número, ` +
      `${adjetivos} adjetivos con concordancia, ${sinNada} sin bloque` +
      (saltadas.length ? `\n  intactas por estar escritas a mano: ${saltadas.join(", ")}` : "")
  );
  if (dry) {
    console.log("(--dry: no se ha escrito nada)");
    return;
  }
  bundle.byStory = salida;
  for (const [slug, entradas] of Object.entries(salida)) {
    await prisma.tapGlossSet.upsert({
      where: { bundle_slug: { bundle: nombre, slug } },
      create: { bundle: nombre, slug, language: bundle.language ?? null, variant: bundle.variant ?? null,
                slugs: [], glosses: entradas as never },
      update: { glosses: entradas as never },
    });
  }
  await prisma.$disconnect();
}

main();
