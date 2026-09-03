/**
 * La capa GRAMATICAL de las glosas: qué hacer cuando la palabra que el lector
 * toca no es un indicativo.
 *
 * El problema (2026-09-03): en "Va a conseguir que esa persona se vaya", tocar
 * `vaya` devolvía "leaves, goes away (irse)", una entrada de diccionario en
 * indicativo sobre una forma de subjuntivo. Quien viene del inglés no tiene
 * cómo saber que `se vaya` no es `se va`.
 *
 * Lo que se escribe en la tarjeta, y por qué esto y no una explicación:
 *
 *   mood   El distintivo, junto a Verb: "Subjunctive", "Formal command"…
 *          Nombra la forma en dos palabras; es lo único que se lee de un vistazo.
 *   head   Las celdas SIEMPRE visibles, sin desplegar nada. Para los modos con
 *          paradigma detrás son dos: la forma que el lector ya conoce y la que
 *          tiene delante, cada una rotulada con SU tiempo ("present" / "past
 *          subjunctive"), nunca con un "here" que no dice nada. El azul de
 *          `here` ya marca cuál sale en la historia.
 *          Para el imperativo son las tres órdenes (usted / ustedes / tú): ahí
 *          no hay contraste de modo que enseñar, hay contraste de trato.
 *   rows   El paradigma completo, detrás del enlace. En el imperativo NO hay
 *          enlace (`kind: "line"`): detrás solo quedaba el presente de
 *          indicativo, una tabla que no contiene la palabra tocada.
 *
 * REGLA DURA, heredada de `buildGlossForms.ts`: una forma que este módulo no
 * sepa clasificar se queda SIN bloque. Un paradigma inventado enseña algo falso
 * y ningún lint lo ve; una palabra sin bloque no enseña nada y se nota.
 *
 * Las dos redes que evitan marcar de subjuntivo lo que es indicativo:
 *   1. Si la forma está en el índice de INDICATIVO (presente, pretérito e
 *      imperfecto de todos los infinitivos del paquete, con el pronombre
 *      reflexivo quitado), este módulo no la toca. Así `se sienta` de sentarse
 *      no se convierte en el subjuntivo de sentir.
 *   2. Una lista de formas ambiguas por idioma que nunca se marcan.
 */
import {
  presente, preterito, personas, indicePorForma,
  itConjuga, itRaiz, ptConjuga,
} from "./buildGlossForms";

export type Modo =
  | "Subjunctive"
  | "Past subjunctive"
  | "Conditional"
  | "Formal command"
  | "Negative command"
  | "Command"
  | "Command + pronoun"
  | "Verb + pronoun"
  | "Future subjunctive"
  | "Konjunktiv II";

export type Bloque = {
  mood: Modo;
  kind: "line" | "expand";
  link?: string;
  lemma?: string;
  head: string[][];
  rows: string[][];
  here: number;
};

// ── Español: subjuntivo presente ─────────────────────────────────────────
// Los irregulares y los que cambian de raíz van ESCRITOS. La regla del "yo"
// (digo -> diga) acierta en cuatro personas y falla justo en nosotros: da
// "cuentemos" por contemos y "duermamos" por durmamos, y esa fila se ve al
// desplegar. Lo que no está aquí se conjuga por la regla regular de abajo, que
// sí es exacta para los verbos regulares.
const ES_SUBJ: Record<string, string[]> = {
  ser: ["sea", "seas", "sea", "seamos", "seáis", "sean"],
  estar: ["esté", "estés", "esté", "estemos", "estéis", "estén"],
  ir: ["vaya", "vayas", "vaya", "vayamos", "vayáis", "vayan"],
  haber: ["haya", "hayas", "haya", "hayamos", "hayáis", "hayan"],
  saber: ["sepa", "sepas", "sepa", "sepamos", "sepáis", "sepan"],
  dar: ["dé", "des", "dé", "demos", "deis", "den"],
  tener: ["tenga", "tengas", "tenga", "tengamos", "tengáis", "tengan"],
  hacer: ["haga", "hagas", "haga", "hagamos", "hagáis", "hagan"],
  decir: ["diga", "digas", "diga", "digamos", "digáis", "digan"],
  poder: ["pueda", "puedas", "pueda", "podamos", "podáis", "puedan"],
  querer: ["quiera", "quieras", "quiera", "queramos", "queráis", "quieran"],
  venir: ["venga", "vengas", "venga", "vengamos", "vengáis", "vengan"],
  ver: ["vea", "veas", "vea", "veamos", "veáis", "vean"],
  salir: ["salga", "salgas", "salga", "salgamos", "salgáis", "salgan"],
  poner: ["ponga", "pongas", "ponga", "pongamos", "pongáis", "pongan"],
  traer: ["traiga", "traigas", "traiga", "traigamos", "traigáis", "traigan"],
  caer: ["caiga", "caigas", "caiga", "caigamos", "caigáis", "caigan"],
  valer: ["valga", "valgas", "valga", "valgamos", "valgáis", "valgan"],
  oír: ["oiga", "oigas", "oiga", "oigamos", "oigáis", "oigan"],
  caber: ["quepa", "quepas", "quepa", "quepamos", "quepáis", "quepan"],
  // Cambio de raíz en -ar / -er: nosotros y vosotros vuelven a la raíz átona.
  pensar: ["piense", "pienses", "piense", "pensemos", "penséis", "piensen"],
  cerrar: ["cierre", "cierres", "cierre", "cerremos", "cerréis", "cierren"],
  empezar: ["empiece", "empieces", "empiece", "empecemos", "empecéis", "empiecen"],
  despertar: ["despierte", "despiertes", "despierte", "despertemos", "despertéis", "despierten"],
  sentar: ["siente", "sientes", "siente", "sentemos", "sentéis", "sienten"],
  contar: ["cuente", "cuentes", "cuente", "contemos", "contéis", "cuenten"],
  encontrar: ["encuentre", "encuentres", "encuentre", "encontremos", "encontréis", "encuentren"],
  recordar: ["recuerde", "recuerdes", "recuerde", "recordemos", "recordéis", "recuerden"],
  mostrar: ["muestre", "muestres", "muestre", "mostremos", "mostréis", "muestren"],
  acostar: ["acueste", "acuestes", "acueste", "acostemos", "acostéis", "acuesten"],
  probar: ["pruebe", "pruebes", "pruebe", "probemos", "probéis", "prueben"],
  soñar: ["sueñe", "sueñes", "sueñe", "soñemos", "soñéis", "sueñen"],
  sonar: ["suene", "suenes", "suene", "sonemos", "sonéis", "suenen"],
  almorzar: ["almuerce", "almuerces", "almuerce", "almorcemos", "almorcéis", "almuercen"],
  jugar: ["juegue", "juegues", "juegue", "juguemos", "juguéis", "jueguen"],
  perder: ["pierda", "pierdas", "pierda", "perdamos", "perdáis", "pierdan"],
  entender: ["entienda", "entiendas", "entienda", "entendamos", "entendáis", "entiendan"],
  volver: ["vuelva", "vuelvas", "vuelva", "volvamos", "volváis", "vuelvan"],
  devolver: ["devuelva", "devuelvas", "devuelva", "devolvamos", "devolváis", "devuelvan"],
  resolver: ["resuelva", "resuelvas", "resuelva", "resolvamos", "resolváis", "resuelvan"],
  mover: ["mueva", "muevas", "mueva", "movamos", "mováis", "muevan"],
  oler: ["huela", "huelas", "huela", "olamos", "oláis", "huelan"],
  // Cambio de raíz en -ir: nosotros y vosotros llevan la vocal débil.
  pedir: ["pida", "pidas", "pida", "pidamos", "pidáis", "pidan"],
  seguir: ["siga", "sigas", "siga", "sigamos", "sigáis", "sigan"],
  conseguir: ["consiga", "consigas", "consiga", "consigamos", "consigáis", "consigan"],
  servir: ["sirva", "sirvas", "sirva", "sirvamos", "sirváis", "sirvan"],
  vestir: ["vista", "vistas", "vista", "vistamos", "vistáis", "vistan"],
  repetir: ["repita", "repitas", "repita", "repitamos", "repitáis", "repitan"],
  elegir: ["elija", "elijas", "elija", "elijamos", "elijáis", "elijan"],
  corregir: ["corrija", "corrijas", "corrija", "corrijamos", "corrijáis", "corrijan"],
  sentir: ["sienta", "sientas", "sienta", "sintamos", "sintáis", "sientan"],
  preferir: ["prefiera", "prefieras", "prefiera", "prefiramos", "prefiráis", "prefieran"],
  mentir: ["mienta", "mientas", "mienta", "mintamos", "mintáis", "mientan"],
  divertir: ["divierta", "diviertas", "divierta", "divirtamos", "divirtáis", "diviertan"],
  dormir: ["duerma", "duermas", "duerma", "durmamos", "durmáis", "duerman"],
  morir: ["muera", "mueras", "muera", "muramos", "muráis", "mueran"],
};

/** Cambios ortográficos de la raíz al pasar de -a a -e y al revés. Sin esto
 *  salen `busce`, `llegue` mal escrito y `empeze`, que son faltas servidas en
 *  la tarjeta del diccionario. */
function raizSubjES(inf: string): { raiz: string; vocal: "e" | "a" } | null {
  const fin = inf.slice(-2);
  let raiz = inf.slice(0, -2);
  if (fin === "ar") {
    if (/c$/.test(raiz)) raiz = `${raiz.slice(0, -1)}qu`;
    else if (/g$/.test(raiz)) raiz = `${raiz}u`;
    else if (/z$/.test(raiz)) raiz = `${raiz.slice(0, -1)}c`;
    else if (/gu$/.test(raiz)) raiz = `${raiz}ü`;
    return { raiz, vocal: "e" };
  }
  if (fin !== "er" && fin !== "ir") return null;
  // -cer / -cir: vocal delante da -zca (conozca), consonante da -za (venza).
  const cer = /^(.*?)([aeiouáéíóú]|[^aeiouáéíóú])c$/.exec(raiz);
  if (cer) raiz = `${cer[1]}${cer[2]}${/[aeiouáéíóú]/.test(cer[2]) ? "zc" : "z"}`;
  else if (/g$/.test(raiz)) raiz = `${raiz.slice(0, -1)}j`; // coger, dirigir
  else if (/gu$/.test(raiz)) raiz = raiz.slice(0, -1); // distinguir
  return { raiz, vocal: "a" };
}

export function subjuntivoPresenteES(inf: string): string[] | null {
  if (ES_SUBJ[inf]) return [...ES_SUBJ[inf]];
  const r = raizSubjES(inf);
  if (!r) return null;
  const e = r.vocal === "e"
    ? ["e", "es", "e", "emos", "éis", "en"]
    : ["a", "as", "a", "amos", "áis", "an"];
  return e.map((x) => `${r.raiz}${x}`);
}

/** Imperfecto de subjuntivo. Sale de la TERCERA DEL PLURAL del pretérito sin
 *  su -ron, y eso vale para toda la lengua sin una sola excepción: dijeron ->
 *  dijera, fueron -> fuera, apagaron -> apagara. */
export function subjuntivoPasadoES(inf: string): string[] | null {
  const pret = preterito(inf);
  if (!pret) return null;
  const base = pret[5].replace(/ron$/, "");
  if (base === pret[5]) return null;
  // nosotros lleva tilde en la última vocal de la raíz: apagáramos, dijéramos.
  const i = Math.max(base.lastIndexOf("a"), base.lastIndexOf("e"), base.lastIndexOf("o"),
                     base.lastIndexOf("i"), base.lastIndexOf("u"));
  const TILDE: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
  const nos = i < 0 ? null : `${base.slice(0, i)}${TILDE[base[i]]}${base.slice(i + 1)}ramos`;
  if (!nos) return null;
  return [`${base}ra`, `${base}ras`, `${base}ra`, nos, `${base}rais`, `${base}ran`];
}

const ES_COND_IRR: Record<string, string> = {
  tener: "tendr", poner: "pondr", venir: "vendr", salir: "saldr", poder: "podr",
  saber: "sabr", hacer: "har", decir: "dir", querer: "querr", haber: "habr",
  caber: "cabr", valer: "valdr",
};
export function condicionalES(inf: string): string[] | null {
  const r = ES_COND_IRR[inf] ?? (/(ar|er|ir|ír)$/.test(inf) ? inf : null);
  if (!r) return null;
  return ["ía", "ías", "ía", "íamos", "íais", "ían"].map((x) => `${r}${x}`);
}

/** Los ocho imperativos de tú que no coinciden con ninguna otra forma. */
export const ES_IMP_TU: Record<string, string> = {
  decir: "di", hacer: "haz", ir: "ve", poner: "pon", salir: "sal",
  ser: "sé", tener: "ten", venir: "ven",
};

/** Imperativo, adaptado al trato de la variante. Devuelve las tres celdas que
 *  van a la vista: la orden formal, la formal en plural y la de tuteo. */
export function imperativoES(inf: string, variante: string): string[][] | null {
  const subj = subjuntivoPresenteES(inf);
  const pres = presente(inf, "latam");
  if (!subj || !pres) return null;
  const usted = subj[2];
  const ustedes = subj[5];
  const vos = variante === "argentina" || variante === "uruguay";
  const tu = vos
    ? (inf === "ser" ? "sé" : inf === "ir" ? "andá"
       : `${inf.slice(0, -2)}${inf.slice(-2) === "ar" ? "á" : inf.slice(-2) === "er" ? "é" : "í"}`)
    : (ES_IMP_TU[inf] ?? pres[2]);
  return [["usted", usted], ["ustedes", ustedes], [vos ? "vos" : "tú", tu]];
}

/**
 * ¿Es una ORDEN o un subjuntivo subordinado?
 *
 * La primera versión preguntaba lo contrario: si no había disparador delante,
 * era orden. Leyendo la salida se veía que eso convierte en imperativo medio
 * corpus: "O sea que", "En cuanto suban al clímax", "Sea como sea". La ausencia
 * de prueba no es prueba.
 *
 * Ahora se pide prueba POSITIVA: entre el principio de su cláusula y la forma
 * no puede haber nada más que un `no`, los pronombres átonos y un conector
 * suelto. Es donde vive un imperativo de verdad ("Deje de preguntar así", "No
 * la busque sin avisar", "y mezcle") y donde no cabe una subordinada.
 */
const ES_ANTES_OK = new Set([
  "no", "me", "te", "se", "nos", "le", "les", "lo", "la", "los", "las",
  "y", "ni", "pero", "luego", "después", "entonces", "ahora", "ya",
]);
/** Detrás de la forma, lo que delata una fórmula hecha y no una orden:
 *  "sea como sea", "sea quien sea". `que` NO entra aquí: "suba que ya salimos"
 *  es una orden del cobrador, y vetarla por el `que` de después dejaba sin
 *  distintivo justo los imperativos con coletilla. Para `ser` sí, que es donde
 *  vive "no sea que". */
const ES_DETRAS_NO = new Set(["como", "quien", "quienes", "cual", "cuales"]);

export function esOrdenES(oracion: string, forma: string, lema?: string): boolean {
  const limpia = oracion.replace(/[«»]/g, " ");
  const i = limpia.toLowerCase().search(new RegExp(`\\b${forma.toLowerCase()}\\b`));
  if (i < 0) return false;
  const trozo = limpia.slice(0, i);
  const corte = Math.max(...[..."“”\"'.,;:¿?¡!()"].map((c) => trozo.lastIndexOf(c)));
  const antes = trozo.slice(corte + 1).toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (!antes.every((w) => ES_ANTES_OK.has(w))) return false;
  // "o sea" no es una orden, es una muletilla.
  if (lema === "ser" && antes.includes("o")) return false;
  const detras = limpia.slice(i + forma.length).toLowerCase().split(/[^\p{L}]+/u).filter(Boolean)[0];
  if (lema === "ser" && detras === "que") return false;
  return !(detras && ES_DETRAS_NO.has(detras));
}

/** ¿La negación va pegada a la forma, dentro de su misma cláusula? Es lo que
 *  separa "No digas eso" de "No puede ser que tú conozcas mi ciudad": en la
 *  segunda el `no` está tres cláusulas antes y no niega nada de esta. */
export function negadaAquiES(oracion: string, forma: string): boolean {
  const i = oracion.toLowerCase().search(new RegExp(`\\b${forma.toLowerCase()}\\b`));
  if (i < 0) return false;
  const trozo = oracion.slice(0, i);
  const corte = Math.max(...[..."“”\"'.,;:¿?¡!()"].map((c) => trozo.lastIndexOf(c)));
  const antes = trozo.slice(corte + 1).toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  return antes.includes("no") || antes.includes("ni");
}

/** Las tablas se escriben con las seis casillas de España. En LATAM `ustedes`
 *  ocupa la casilla de vosotros y toma la forma de ellos: sin esto la tarjeta
 *  enseñaba "ustedes vayáis", que no lo dice nadie a este lado. */
export function aVarianteModo(filas: string[], variante: string): string[] {
  const out = [...filas];
  if (variante !== "spain") out[4] = out[5];
  if (variante === "argentina" || variante === "uruguay") {
    const vos = vosSubjuntivo(out);
    if (vos) out[1] = vos;
  }
  return out;
}

/** La segunda persona de vos en subjuntivo lleva el acento en la terminación y
 *  pierde el diptongo de la raíz: no `vuelvas` sino `volvás`, no `seas` sino
 *  `seás`. La raíz átona es la que ya tiene la fila de nosotros, así que sale
 *  de ahí y no de una segunda tabla que se desincroniza. Lo comprueba después
 *  `scripts/checkGlossVariants.ts`. */
const TILDE_VOS: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
export function vosSubjuntivo(filas: string[]): string | null {
  const nos = filas[3];
  if (!nos || !nos.endsWith("mos")) return null;
  const base = nos.slice(0, -3);
  const i = Math.max(...["a", "e", "i", "o", "u"].map((v) => base.lastIndexOf(v)));
  if (i < 0) return null;
  return `${base.slice(0, i)}${TILDE_VOS[base[i]]}${base.slice(i + 1)}s`;
}

/** El pronombre que acompaña a cada persona. Reflexivo, cambia con la persona
 *  (me vaya, te vayas, se vaya); de objeto, se queda igual en las seis.
 *
 *  La quinta casilla depende de la variante, igual que la forma verbal: en
 *  España es vosotros y lleva `os`, en el resto es ustedes y lleva `se`. Sin
 *  esto la tarjeta del A2 de España enseñaba "vosotros se vayáis" (visto en el
 *  Pixel, 2026-09-03). */
function reflexivos(variante: string): string[] {
  return variante === "spain"
    ? ["me", "te", "se", "nos", "os", "se"]
    : ["me", "te", "se", "nos", "se", "se"];
}
export function conClitico(filas: string[], clitico: string, variante = ""): string[] {
  const c = clitico.trim();
  if (!c) return filas;
  const refl = ["me", "te", "se", "nos", "os"].includes(c);
  const tabla = reflexivos(variante);
  return filas.map((f, i) => `${refl ? tabla[i] : c} ${f}`);
}

// ── Francés ─────────────────────────────────────────────────────────────
// El francés no tenía NINGUNA tabla en el proyecto: `buildGlossForms.ts` no lo
// lleva en `IDIOMAS`, así que sus paquetes no tienen ni bloque de indicativo.
// Aquí va lo justo para la capa gramatical, y el presente vive en este fichero
// (y no en el otro) porque solo se usa para la celda de contraste; meter el
// francés en el generador de indicativos es otra pasada y otra revisión.
//
// La regla que de verdad decide en francés: el sujeto es OBLIGATORIO, así que
// un imperativo es exactamente un verbo SIN pronombre sujeto delante. Por eso
// `je`, `tu`, `il`, `elle`, `on`, `nous`, `vous` y `ils` no entran en la lista
// de lo que puede precederlo, y `Vous cherchez quelque chose ?` no pasa por
// orden. La otra red es la inversión del narrador (`dit Hugo`, `explique-t-elle`,
// `répète Manon`), que en el corpus de Lyon es lo más frecuente de todo.
export const FR_PERSONAS = ["je", "tu", "il, elle", "nous", "vous", "ils"];

type FrVerbo = { pres: string[]; subj?: string[]; cond?: string; impTu?: string };
const FR_IRR: Record<string, FrVerbo> = {
  être: { pres: ["suis", "es", "est", "sommes", "êtes", "sont"], subj: ["sois", "sois", "soit", "soyons", "soyez", "soient"], cond: "ser", impTu: "sois" },
  avoir: { pres: ["ai", "as", "a", "avons", "avez", "ont"], subj: ["aie", "aies", "ait", "ayons", "ayez", "aient"], cond: "aur", impTu: "aie" },
  aller: { pres: ["vais", "vas", "va", "allons", "allez", "vont"], subj: ["aille", "ailles", "aille", "allions", "alliez", "aillent"], cond: "ir", impTu: "va" },
  faire: { pres: ["fais", "fais", "fait", "faisons", "faites", "font"], subj: ["fasse", "fasses", "fasse", "fassions", "fassiez", "fassent"], cond: "fer", impTu: "fais" },
  dire: { pres: ["dis", "dis", "dit", "disons", "dites", "disent"], subj: ["dise", "dises", "dise", "disions", "disiez", "disent"], cond: "dir", impTu: "dis" },
  pouvoir: { pres: ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"], subj: ["puisse", "puisses", "puisse", "puissions", "puissiez", "puissent"], cond: "pourr" },
  vouloir: { pres: ["veux", "veux", "veut", "voulons", "voulez", "veulent"], subj: ["veuille", "veuilles", "veuille", "voulions", "vouliez", "veuillent"], cond: "voudr", impTu: "veuille" },
  savoir: { pres: ["sais", "sais", "sait", "savons", "savez", "savent"], subj: ["sache", "saches", "sache", "sachions", "sachiez", "sachent"], cond: "saur", impTu: "sache" },
  devoir: { pres: ["dois", "dois", "doit", "devons", "devez", "doivent"], subj: ["doive", "doives", "doive", "devions", "deviez", "doivent"], cond: "devr" },
  venir: { pres: ["viens", "viens", "vient", "venons", "venez", "viennent"], subj: ["vienne", "viennes", "vienne", "venions", "veniez", "viennent"], cond: "viendr", impTu: "viens" },
  tenir: { pres: ["tiens", "tiens", "tient", "tenons", "tenez", "tiennent"], subj: ["tienne", "tiennes", "tienne", "tenions", "teniez", "tiennent"], cond: "tiendr", impTu: "tiens" },
  prendre: { pres: ["prends", "prends", "prend", "prenons", "prenez", "prennent"], subj: ["prenne", "prennes", "prenne", "prenions", "preniez", "prennent"], cond: "prendr", impTu: "prends" },
  voir: { pres: ["vois", "vois", "voit", "voyons", "voyez", "voient"], subj: ["voie", "voies", "voie", "voyions", "voyiez", "voient"], cond: "verr", impTu: "vois" },
  mettre: { pres: ["mets", "mets", "met", "mettons", "mettez", "mettent"], cond: "mettr", impTu: "mets" },
  partir: { pres: ["pars", "pars", "part", "partons", "partez", "partent"], cond: "partir", impTu: "pars" },
  sortir: { pres: ["sors", "sors", "sort", "sortons", "sortez", "sortent"], cond: "sortir", impTu: "sors" },
  dormir: { pres: ["dors", "dors", "dort", "dormons", "dormez", "dorment"], cond: "dormir", impTu: "dors" },
  sentir: { pres: ["sens", "sens", "sent", "sentons", "sentez", "sentent"], cond: "sentir", impTu: "sens" },
  ouvrir: { pres: ["ouvre", "ouvres", "ouvre", "ouvrons", "ouvrez", "ouvrent"], cond: "ouvrir", impTu: "ouvre" },
  offrir: { pres: ["offre", "offres", "offre", "offrons", "offrez", "offrent"], cond: "offrir", impTu: "offre" },
  écrire: { pres: ["écris", "écris", "écrit", "écrivons", "écrivez", "écrivent"], cond: "écrir", impTu: "écris" },
  lire: { pres: ["lis", "lis", "lit", "lisons", "lisez", "lisent"], cond: "lir", impTu: "lis" },
  boire: { pres: ["bois", "bois", "boit", "buvons", "buvez", "boivent"], cond: "boir", impTu: "bois" },
  croire: { pres: ["crois", "crois", "croit", "croyons", "croyez", "croient"], cond: "croir", impTu: "crois" },
  connaître: { pres: ["connais", "connais", "connaît", "connaissons", "connaissez", "connaissent"], cond: "connaîtr", impTu: "connais" },
  vivre: { pres: ["vis", "vis", "vit", "vivons", "vivez", "vivent"], cond: "vivr", impTu: "vis" },
  suivre: { pres: ["suis", "suis", "suit", "suivons", "suivez", "suivent"], cond: "suivr", impTu: "suis" },
  rire: { pres: ["ris", "ris", "rit", "rions", "riez", "rient"], cond: "rir", impTu: "ris" },
  courir: { pres: ["cours", "cours", "court", "courons", "courez", "courent"], cond: "courr", impTu: "cours" },
  recevoir: { pres: ["reçois", "reçois", "reçoit", "recevons", "recevez", "reçoivent"], cond: "recevr", impTu: "reçois" },
  attendre: { pres: ["attends", "attends", "attend", "attendons", "attendez", "attendent"], cond: "attendr", impTu: "attends" },
  entendre: { pres: ["entends", "entends", "entend", "entendons", "entendez", "entendent"], cond: "entendr", impTu: "entends" },
  répondre: { pres: ["réponds", "réponds", "répond", "répondons", "répondez", "répondent"], cond: "répondr", impTu: "réponds" },
  descendre: { pres: ["descends", "descends", "descend", "descendons", "descendez", "descendent"], cond: "descendr", impTu: "descends" },
  perdre: { pres: ["perds", "perds", "perd", "perdons", "perdez", "perdent"], cond: "perdr", impTu: "perds" },
  vendre: { pres: ["vends", "vends", "vend", "vendons", "vendez", "vendent"], cond: "vendr", impTu: "vends" },
};

/**
 * Los -er que cambian la raíz y que por eso NO se conjugan: acheter da
 * `achète`, appeler da `appelle`, préférer da `préfère`, manger da `mangeons`,
 * payer da `paie`. La regla plana daría `achete`, `appele` y `mangons`, y esa
 * fila se ve al desplegar. Sin bloque antes que con la tabla inventada.
 */
const FR_NO_REGULAR = /(eler|eter|ayer|oyer|uyer|cer|ger|é[a-zà-ÿ]{1,3}er|e[lnrtsvm]er)$/;

export function presenteFR(inf: string): string[] | null {
  const irr = FR_IRR[inf];
  if (irr) return [...irr.pres];
  if (FR_NO_REGULAR.test(inf)) return null;
  const raiz = inf.slice(0, -2);
  if (inf.endsWith("er")) return [`${raiz}e`, `${raiz}es`, `${raiz}e`, `${raiz}ons`, `${raiz}ez`, `${raiz}ent`];
  if (inf.endsWith("ir")) return [`${raiz}is`, `${raiz}is`, `${raiz}it`, `${raiz}issons`, `${raiz}issez`, `${raiz}issent`];
  if (inf.endsWith("re")) {
    const r = inf.slice(0, -2);
    return [`${r}s`, `${r}s`, r, `${r}ons`, `${r}ez`, `${r}ent`];
  }
  return null;
}

export function subjonctifFR(inf: string): string[] | null {
  const irr = FR_IRR[inf];
  if (irr?.subj) return [...irr.subj];
  if (FR_NO_REGULAR.test(inf)) return null;
  const raiz = inf.slice(0, -2);
  if (inf.endsWith("er")) return [`${raiz}e`, `${raiz}es`, `${raiz}e`, `${raiz}ions`, `${raiz}iez`, `${raiz}ent`];
  if (inf.endsWith("ir")) return [`${raiz}isse`, `${raiz}isses`, `${raiz}isse`, `${raiz}issions`, `${raiz}issiez`, `${raiz}issent`];
  // Los -re irregulares sin `subj` escrito se quedan fuera: su raíz de
  // subjuntivo no sale de ninguna regla (prendre da prenne, boire da boive).
  if (inf.endsWith("re") && !irr) {
    const r = inf.slice(0, -2);
    return [`${r}e`, `${r}es`, `${r}e`, `${r}ions`, `${r}iez`, `${r}ent`];
  }
  return null;
}

export function conditionnelFR(inf: string): string[] | null {
  const irr = FR_IRR[inf];
  let r = irr?.cond;
  if (!r) {
    if (FR_NO_REGULAR.test(inf)) return null;
    if (inf.endsWith("er") || inf.endsWith("ir")) r = inf;
    else if (inf.endsWith("re")) r = inf.slice(0, -1);
    else return null;
  }
  return [`${r}ais`, `${r}ais`, `${r}ait`, `${r}ions`, `${r}iez`, `${r}aient`];
}

/** Imperativo: tú, nosotros y vosotros. En los -er la de tú pierde la -s
 *  (`regarde`, no `regardes`), que es lo que la vuelve idéntica a la tercera
 *  del indicativo y obliga a mirar la posición en la frase. */
export function imperatifFR(inf: string): string[][] | null {
  const pres = presenteFR(inf);
  if (!pres) return null;
  const irr = FR_IRR[inf];
  const tu = irr?.impTu ?? (inf.endsWith("er") ? pres[0] : pres[1]);
  return [["tu", tu], ["vous", pres[4]], ["nous", pres[3]]];
}

const FR_ANTES_OK = new Set([
  "et", "mais", "puis", "alors", "donc", "ne", "n", "bon", "oh", "ah", "eh",
  "me", "m", "te", "t", "se", "s", "le", "la", "les", "lui", "leur", "y", "en",
  "surtout", "maintenant",
]);
/** Verbos de decir. En frances la inversion del narrador (`demande sa mere`,
 *  `repete Manon`) cae justo detras de una interrogacion dentro de la comilla,
 *  asi que al partir la frase por los signos queda en cabeza y pasaba por
 *  orden. Estos no llevan bloque de imperativo nunca. */
const FR_VERBOS_DECIR = new Set([
  "dit", "dis", "demande", "demandent", "r\u00e9pond", "r\u00e9pondent", "ajoute", "explique",
  "corrige", "r\u00e9p\u00e8te", "confirme", "murmure", "crie", "propose", "raconte",
  "insiste", "pr\u00e9cise", "conclut", "lance", "coupe", "reprend", "soupire",
]);
export function esOrdenFR(oracion: string, forma: string): boolean {
  if (FR_VERBOS_DECIR.has(forma.toLowerCase())) return false;
  return abreLineaDeDialogo(oracion, forma, FR_ANTES_OK);
}

// ── Enclíticos ───────────────────────────────────────────────────────────
// `cuéntame` no está en ninguna tabla y el lector tampoco sabe partirla: no la
// encuentra en un diccionario ni adivina dónde acaba el verbo. Aquí se parte.
export const ES_PRON_EN: Record<string, string> = {
  me: "to me", te: "to you", se: "oneself", nos: "to us",
  lo: "it, him", la: "it, her", le: "to him, to her",
  los: "them", las: "them", les: "to them",
};
const SIN_TILDE: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u" };

/** Parte una forma con pronombres pegados. Devuelve la base y los pronombres,
 *  o null si no se puede partir. Quien llama TIENE que seguir su camino si
 *  ninguna base resulta ser un verbo conocido: `hable` acaba en `le` y se
 *  parte en `hab` + `le`, y ahí la palabra no es un enclítico.
 *  Se prueban dos bases, con y sin tilde: `dígalo` es `diga`, pero `sacátelo`
 *  es `sacá` y ahí la tilde manda. */
export function parteEncliticaES(w: string): { bases: string[]; pron: string[] } | null {
  let resto = w;
  const pron: string[] = [];
  for (let i = 0; i < 2; i++) {
    const m = /^(.{3,})(me|te|se|nos|los|las|les|lo|la|le)$/.exec(resto);
    if (!m) break;
    resto = m[1];
    pron.unshift(m[2]);
  }
  if (!pron.length) return null;
  const sin = resto.replace(/[áéíóú]/g, (c) => SIN_TILDE[c]);
  return { bases: sin === resto ? [resto] : [resto, sin], pron };
}

// ── Alemán ───────────────────────────────────────────────────────────────
// Solo las formas de Konjunktiv II que NO coinciden con el Präteritum. `sollte`
// y `wollte` son la misma palabra en los dos, y `konnte` / `musste` / `durfte`
// se distinguen del subjuntivo por la diéresis, así que las de indicativo se
// quedan fuera a propósito: marcar de subjuntivo un pretérito es el fallo que
// esta capa viene a arreglar, no a repetir.
export const DE_K2: Record<string, { inf: string; ind: string; rows: string[][] }> = {
  wäre: { inf: "sein", ind: "ist", rows: [["ich", "wäre"], ["du", "wärst"], ["er, sie", "wäre"], ["wir", "wären"], ["ihr", "wärt"], ["sie", "wären"]] },
  wären: { inf: "sein", ind: "sind", rows: [["ich", "wäre"], ["du", "wärst"], ["er, sie", "wäre"], ["wir", "wären"], ["ihr", "wärt"], ["sie", "wären"]] },
  hätte: { inf: "haben", ind: "hat", rows: [["ich", "hätte"], ["du", "hättest"], ["er, sie", "hätte"], ["wir", "hätten"], ["ihr", "hättet"], ["sie", "hätten"]] },
  hätten: { inf: "haben", ind: "haben", rows: [["ich", "hätte"], ["du", "hättest"], ["er, sie", "hätte"], ["wir", "hätten"], ["ihr", "hättet"], ["sie", "hätten"]] },
  würde: { inf: "werden", ind: "wird", rows: [["ich", "würde"], ["du", "würdest"], ["er, sie", "würde"], ["wir", "würden"], ["ihr", "würdet"], ["sie", "würden"]] },
  würden: { inf: "werden", ind: "werden", rows: [["ich", "würde"], ["du", "würdest"], ["er, sie", "würde"], ["wir", "würden"], ["ihr", "würdet"], ["sie", "würden"]] },
  könnte: { inf: "können", ind: "kann", rows: [["ich", "könnte"], ["du", "könntest"], ["er, sie", "könnte"], ["wir", "könnten"], ["ihr", "könntet"], ["sie", "könnten"]] },
  könnten: { inf: "können", ind: "können", rows: [["ich", "könnte"], ["du", "könntest"], ["er, sie", "könnte"], ["wir", "könnten"], ["ihr", "könntet"], ["sie", "könnten"]] },
  müsste: { inf: "müssen", ind: "muss", rows: [["ich", "müsste"], ["du", "müsstest"], ["er, sie", "müsste"], ["wir", "müssten"], ["ihr", "müsstet"], ["sie", "müssten"]] },
  müssten: { inf: "müssen", ind: "müssen", rows: [["ich", "müsste"], ["du", "müsstest"], ["er, sie", "müsste"], ["wir", "müssten"], ["ihr", "müsstet"], ["sie", "müssten"]] },
  dürfte: { inf: "dürfen", ind: "darf", rows: [["ich", "dürfte"], ["du", "dürftest"], ["er, sie", "dürfte"], ["wir", "dürften"], ["ihr", "dürftet"], ["sie", "dürften"]] },
  möchte: { inf: "mögen", ind: "mag", rows: [["ich", "möchte"], ["du", "möchtest"], ["er, sie", "möchte"], ["wir", "möchten"], ["ihr", "möchtet"], ["sie", "möchten"]] },
  möchten: { inf: "mögen", ind: "mögen", rows: [["ich", "möchte"], ["du", "möchtest"], ["er, sie", "möchte"], ["wir", "möchten"], ["ihr", "möchtet"], ["sie", "möchten"]] },
  wüsste: { inf: "wissen", ind: "weiß", rows: [["ich", "wüsste"], ["du", "wüsstest"], ["er, sie", "wüsste"], ["wir", "wüssten"], ["ihr", "wüsstet"], ["sie", "wüssten"]] },
  gäbe: { inf: "geben", ind: "gibt", rows: [["ich", "gäbe"], ["du", "gäbest"], ["er, sie", "gäbe"], ["wir", "gäben"], ["ihr", "gäbet"], ["sie", "gäben"]] },
  käme: { inf: "kommen", ind: "kommt", rows: [["ich", "käme"], ["du", "kämest"], ["er, sie", "käme"], ["wir", "kämen"], ["ihr", "kämet"], ["sie", "kämen"]] },
  kämen: { inf: "kommen", ind: "kommen", rows: [["ich", "käme"], ["du", "kämest"], ["er, sie", "käme"], ["wir", "kämen"], ["ihr", "kämet"], ["sie", "kämen"]] },
  ginge: { inf: "gehen", ind: "geht", rows: [["ich", "ginge"], ["du", "gingest"], ["er, sie", "ginge"], ["wir", "gingen"], ["ihr", "ginget"], ["sie", "gingen"]] },
  bliebe: { inf: "bleiben", ind: "bleibt", rows: [["ich", "bliebe"], ["du", "bliebest"], ["er, sie", "bliebe"], ["wir", "blieben"], ["ihr", "bliebet"], ["sie", "blieben"]] },
  nähme: { inf: "nehmen", ind: "nimmt", rows: [["ich", "nähme"], ["du", "nähmest"], ["er, sie", "nähme"], ["wir", "nähmen"], ["ihr", "nähmet"], ["sie", "nähmen"]] },
  täte: { inf: "tun", ind: "tut", rows: [["ich", "täte"], ["du", "tätest"], ["er, sie", "täte"], ["wir", "täten"], ["ihr", "tätet"], ["sie", "täten"]] },
  sähe: { inf: "sehen", ind: "sieht", rows: [["ich", "sähe"], ["du", "sähest"], ["er, sie", "sähe"], ["wir", "sähen"], ["ihr", "sähet"], ["sie", "sähen"]] },
  fände: { inf: "finden", ind: "findet", rows: [["ich", "fände"], ["du", "fändest"], ["er, sie", "fände"], ["wir", "fänden"], ["ihr", "fändet"], ["sie", "fänden"]] },
  ließe: { inf: "lassen", ind: "lässt", rows: [["ich", "ließe"], ["du", "ließest"], ["er, sie", "ließe"], ["wir", "ließen"], ["ihr", "ließet"], ["sie", "ließen"]] },
  bräuchte: { inf: "brauchen", ind: "braucht", rows: [["ich", "bräuchte"], ["du", "bräuchtest"], ["er, sie", "bräuchte"], ["wir", "bräuchten"], ["ihr", "bräuchtet"], ["sie", "bräuchten"]] },
};

/** Antes de un imperativo alemán solo cabe un conector o un nombre con dos
 *  puntos. Sin esta red, `halt` de "verliert den Halt" y `ruf` de "Nur ein Ruf"
 *  salían de orden: el sustantivo y el imperativo son la misma palabra en
 *  minúscula, y la clave del lookup va en minúscula. */
const DE_ANTES_OK = new Set([
  "und", "dann", "aber", "oder", "so", "also", "na", "gut", "jetzt", "nur",
  "doch", "mal", "ja", "nein", "bitte", "hey", "komm", "da", "sell", "noch",
]);
export function esOrdenDE(oracion: string, forma: string): boolean {
  const i = oracion.toLowerCase().search(new RegExp(`\\b${forma.toLowerCase()}\\b`));
  if (i < 0) return false;
  const trozo = oracion.slice(0, i);
  const corte = Math.max(...[..."“”\"'.,;:!?()"].map((c) => trozo.lastIndexOf(c)));
  const antes = trozo.slice(corte + 1).toLowerCase().split(/[^\p{L}äöüß]+/u).filter(Boolean);
  return antes.every((w) => DE_ANTES_OK.has(w));
}

/** Imperativo de du. Solo las formas que NINGÚN indicativo comparte: `komm` sin
 *  -e no es "ich komme", pero `warte` sí, y por eso `warte` no está aquí. */
export const DE_IMP: Record<string, { inf: string; ihr: string; sie: string }> = {
  komm: { inf: "kommen", ihr: "kommt", sie: "kommen Sie" },
  geh: { inf: "gehen", ihr: "geht", sie: "gehen Sie" },
  sag: { inf: "sagen", ihr: "sagt", sie: "sagen Sie" },
  nimm: { inf: "nehmen", ihr: "nehmt", sie: "nehmen Sie" },
  gib: { inf: "geben", ihr: "gebt", sie: "geben Sie" },
  schau: { inf: "schauen", ihr: "schaut", sie: "schauen Sie" },
  hör: { inf: "hören", ihr: "hört", sie: "hören Sie" },
  lass: { inf: "lassen", ihr: "lasst", sie: "lassen Sie" },
  sieh: { inf: "sehen", ihr: "seht", sie: "sehen Sie" },
  iss: { inf: "essen", ihr: "esst", sie: "essen Sie" },
  lies: { inf: "lesen", ihr: "lest", sie: "lesen Sie" },
  hilf: { inf: "helfen", ihr: "helft", sie: "helfen Sie" },
  sprich: { inf: "sprechen", ihr: "sprecht", sie: "sprechen Sie" },
  bleib: { inf: "bleiben", ihr: "bleibt", sie: "bleiben Sie" },
  mach: { inf: "machen", ihr: "macht", sie: "machen Sie" },
  hol: { inf: "holen", ihr: "holt", sie: "holen Sie" },
  zeig: { inf: "zeigen", ihr: "zeigt", sie: "zeigen Sie" },
  frag: { inf: "fragen", ihr: "fragt", sie: "fragen Sie" },
  denk: { inf: "denken", ihr: "denkt", sie: "denken Sie" },
  ruf: { inf: "rufen", ihr: "ruft", sie: "rufen Sie" },
  fahr: { inf: "fahren", ihr: "fahrt", sie: "fahren Sie" },
  halt: { inf: "halten", ihr: "haltet", sie: "halten Sie" },
  schreib: { inf: "schreiben", ihr: "schreibt", sie: "schreiben Sie" },
};

// ── Italiano ────────────────────────────────────────────────────────────
// El congiuntivo sale de la PRIMERA persona del presente, que es la regla real
// de la lengua: `vado` da `vada`, `dico` da `dica`, `tolgo` da `tolga`. Noi y
// voi NO la siguen (vada pero andiamo), asi que esas dos casillas se sacan de
// la raiz del infinitivo. Las que ni siquiera eso resuelve van escritas.
const IT_SUBJ_IRR: Record<string, string[]> = {
  essere: ["sia", "sia", "sia", "siamo", "siate", "siano"],
  avere: ["abbia", "abbia", "abbia", "abbiamo", "abbiate", "abbiano"],
  dare: ["dia", "dia", "dia", "diamo", "diate", "diano"],
  stare: ["stia", "stia", "stia", "stiamo", "stiate", "stiano"],
  sapere: ["sappia", "sappia", "sappia", "sappiamo", "sappiate", "sappiano"],
  dovere: ["debba", "debba", "debba", "dobbiamo", "dobbiate", "debbano"],
};

export function congiuntivoIT(inf: string): string[] | null {
  if (IT_SUBJ_IRR[inf]) return [...IT_SUBJ_IRR[inf]];
  const pres = itConjuga(inf, "presente");
  if (!pres) return null;
  const yo = pres[0];
  if (!yo.endsWith("o") || yo.includes(" ")) return null;
  const raizYo = yo.slice(0, -1);
  const raiz = inf.slice(0, -3);
  const fin = inf.slice(-3);
  if (fin !== "are" && fin !== "ere" && fin !== "ire") return null;
  const t = fin === "are" ? "i" : "a";
  // La i de la raiz se cae delante de otra i: mangiare da `mangi`, no `mangii`,
  // y soffiare da `soffi`. Es la misma regla que ya aplica el indicativo.
  const yoT = itRaiz(raizYo, t);
  const noi = `${itRaiz(raiz, "iamo")}iamo`;
  const voi = `${itRaiz(raiz, "iate")}iate`;
  return [`${yoT}${t}`, `${yoT}${t}`, `${yoT}${t}`, noi, voi, `${yoT}${t}no`];
}

/** Congiuntivo imperfetto. Regular desde el infinitivo salvo seis verbos, que
 *  llevan la raiz larga (fare da facessi, no "fassi"). */
const IT_IMPF_IRR: Record<string, string> = {
  essere: "fo", dare: "de", stare: "ste", fare: "face", dire: "dice",
  bere: "beve", tradurre: "traduce",
};
export function congiuntivoImperfettoIT(inf: string): string[] | null {
  const irr = IT_IMPF_IRR[inf];
  const fin = inf.slice(-3);
  if (!irr && fin !== "are" && fin !== "ere" && fin !== "ire") return null;
  const base = irr ? `${irr}ss` : `${inf.slice(0, -3)}${fin[0]}ss`;
  return [`${base}i`, `${base}i`, `${base}e`, `${base}imo`, `${base}e`, `${base}ero`]
    .map((f, i) => (i === 4 ? `${base.slice(0, -2)}ste` : f));
}

const IT_COND_RAIZ: Record<string, string> = {
  essere: "sar", avere: "avr", andare: "andr", fare: "far", dare: "dar",
  stare: "star", potere: "potr", volere: "vorr", dovere: "dovr", sapere: "sapr",
  venire: "verr", vedere: "vedr", rimanere: "rimarr", tenere: "terr", bere: "berr",
  vivere: "vivr",
};
export function condizionaleIT(inf: string): string[] | null {
  let r = IT_COND_RAIZ[inf];
  if (!r) {
    const fin = inf.slice(-3);
    if (fin !== "are" && fin !== "ere" && fin !== "ire") return null;
    r = fin === "ire" ? inf.slice(0, -1) : `${inf.slice(0, -3)}er`;
  }
  return [`${r}ei`, `${r}esti`, `${r}ebbe`, `${r}emmo`, `${r}este`, `${r}ebbero`];
}

/** Imperativo. La celda de `tu` en los -are es la raiz + a, que es la MISMA
 *  palabra que la tercera del indicativo, asi que el modo lo decide la posicion
 *  en la oracion, igual que en aleman y en frances. */
const IT_IMP_TU: Record<string, string> = {
  dire: "di'", fare: "fa'", dare: "da'", stare: "sta'", andare: "va'",
  essere: "sii", avere: "abbi",
};
export function imperativoIT(inf: string): string[][] | null {
  const pres = itConjuga(inf, "presente");
  const subj = congiuntivoIT(inf);
  if (!pres || !subj) return null;
  const fin = inf.slice(-3);
  const tu = IT_IMP_TU[inf] ?? (fin === "are" ? `${inf.slice(0, -3)}a` : pres[1]);
  return [["Lei", subj[2]], ["tu", tu], ["voi", pres[4]]];
}

/**
 * En italiano y en frances el imperativo es LA MISMA PALABRA que el indicativo:
 * `guarda` es "el mira" y "mira tu", `regarde` igual. La posicion en la frase
 * que basta en espanol (donde `deje` no es `deja`) aqui marca de orden medio
 * corpus: leyendo la salida salian "riapre il rifugio, guarda fuori",
 * "mangia un panino", "ne chauffe rien" y "demande sa mere", todas indicativo.
 *
 * Asi que aqui se pide la posicion MAS fuerte que existe: la palabra abre una
 * linea de dialogo. Entre la comilla y la forma caben una negacion, un
 * pronombre atono y un conector, y nada mas. Se pierden las ordenes de media
 * frase ("adesso guardate quanta gente"), y se prefiere perderlas: una orden
 * que no se marca no ensena nada, una indicativo marcada de orden ensena algo
 * falso y ningun lint la ve.
 */
const COMILLAS_ABRE = ["\u201c", "\u201d", "\u00ab", "\u00bb", '"', "\u2014"];
/** Sujeto DETRAS del verbo. "Non paghi tu" y "Guidi tu fino a Savona" abren la
 *  linea de dialogo igual que una orden, pero llevan su sujeto pospuesto: son
 *  indicativo. Un imperativo nunca lleva sujeto. */
const SUJETOS_POSPUESTOS = new Set([
  "io", "tu", "lui", "lei", "noi", "voi", "loro",
  "je", "il", "elle", "on", "ils", "elles", "nous", "vous",
]);
function abreLineaDeDialogo(oracion: string, forma: string, permitidos: Set<string>): boolean {
  const limpia = oracion.trimStart();
  if (!COMILLAS_ABRE.some((c) => limpia.startsWith(c))) return false;
  const i = limpia.toLowerCase().search(new RegExp(`\\b${forma.toLowerCase()}\\b`));
  if (i < 0) return false;
  // Solo cuenta como sujeto pospuesto si va PEGADO, sin coma en medio:
  // "Non paghi tu" es indicativo, pero en "Entre, on prend l'aperitif" el `on`
  // es de la clausula siguiente y `Entre` sigue siendo una orden.
  const cola = limpia.slice(i + forma.length).split(/[,;:.!?"\u201c\u201d]/)[0];
  const detras = cola.toLowerCase().split(/[^\p{L}\u00e0-\u00ff]+/u).filter(Boolean)[0];
  if (detras && SUJETOS_POSPUESTOS.has(detras)) return false;
  const antes = limpia.slice(1, i).toLowerCase().split(/[^\p{L}\u00e0\u00e2\u00e7\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00fb\u00f9\u00fc\u00ff\u0153]+/u).filter(Boolean);
  return antes.length <= 2 && antes.every((w) => permitidos.has(w));
}

const IT_ANTES_OK = new Set([
  "e", "ma", "poi", "allora", "dai", "su", "beh", "no", "non", "ora", "adesso",
  "mi", "ti", "si", "ci", "vi", "lo", "la", "li", "le", "ne", "gli", "pero", "quindi",
]);
export function esOrdenIT(oracion: string, forma: string): boolean {
  return abreLineaDeDialogo(oracion, forma, IT_ANTES_OK);
}

// ── Portugués de Brasil ─────────────────────────────────────────────────
// Cinco casillas utiles, como en `buildGlossForms.ts`: `tu` casi no se usa y
// `vos` no existe, asi que la segunda persona la ocupa `você`.
const PT_SUBJ_IRR: Record<string, string> = {
  ser: "sej", estar: "estej", ter: "tenh", fazer: "faç", dizer: "dig",
  poder: "poss", querer: "queir", saber: "saib", haver: "haj", ver: "vej",
  vir: "venh", trazer: "trag", pôr: "ponh", ir: "vá", dar: "dê",
};
export function subjuntivoPresentePT(inf: string): string[] | null {
  const irr = PT_SUBJ_IRR[inf];
  if (inf === "ir") return ["vá", "vá", "vá", "vamos", "vão", "vão"];
  if (inf === "dar") return ["dê", "dê", "dê", "demos", "dêem", "dêem"];
  if (irr) return [`${irr}a`, `${irr}a`, `${irr}a`, `${irr}amos`, `${irr}am`, `${irr}am`];
  const pres = ptConjuga(inf, "presente");
  if (!pres) return null;
  const yo = pres[0];
  if (!yo.endsWith("o")) return null;
  const raiz = yo.slice(0, -1);
  const t = inf.slice(-2) === "ar" ? "e" : "a";
  return [`${raiz}${t}`, `${raiz}${t}`, `${raiz}${t}`, `${raiz}${t}mos`, `${raiz}${t}m`, `${raiz}${t}m`];
}

/** Imperfeito do subjuntivo, desde la TERCERA DEL PLURAL del preterito sin su
 *  -ram. Vale para toda la lengua: falaram da falasse, foram da fosse. */
export function subjuntivoImperfeitoPT(inf: string): string[] | null {
  const pret = ptConjuga(inf, "pretérito");
  if (!pret) return null;
  const base = pret[5].replace(/ram$/, "");
  if (base === pret[5]) return null;
  const i = Math.max(...["a", "e", "i", "o", "u"].map((v) => base.lastIndexOf(v)));
  const CIRC: Record<string, string> = { a: "á", e: "ê", i: "í", o: "ô", u: "ú" };
  if (i < 0) return null;
  const nos = `${base.slice(0, i)}${CIRC[base[i]]}${base.slice(i + 1)}ssemos`;
  return [`${base}sse`, `${base}sse`, `${base}sse`, nos, `${base}ssem`, `${base}ssem`];
}

/**
 * Futuro do subjuntivo, que en Brasil se oye a diario ("quando eu tiver",
 * "se for"). Solo los IRREGULARES: en los regulares esa forma es la misma
 * palabra que el infinitivo ("quando falar"), y marcar de subjuntivo un
 * infinitivo es peor que no marcar nada.
 */
export const PT_FUT_SUBJ: Record<string, string[]> = {
  ser: ["for", "for", "for", "formos", "forem", "forem"],
  ir: ["for", "for", "for", "formos", "forem", "forem"],
  ter: ["tiver", "tiver", "tiver", "tivermos", "tiverem", "tiverem"],
  estar: ["estiver", "estiver", "estiver", "estivermos", "estiverem", "estiverem"],
  fazer: ["fizer", "fizer", "fizer", "fizermos", "fizerem", "fizerem"],
  poder: ["puder", "puder", "puder", "pudermos", "puderem", "puderem"],
  vir: ["vier", "vier", "vier", "viermos", "vierem", "vierem"],
  saber: ["souber", "souber", "souber", "soubermos", "souberem", "souberem"],
  querer: ["quiser", "quiser", "quiser", "quisermos", "quiserem", "quiserem"],
  haver: ["houver", "houver", "houver", "houvermos", "houverem", "houverem"],
  trazer: ["trouxer", "trouxer", "trouxer", "trouxermos", "trouxerem", "trouxerem"],
  dizer: ["disser", "disser", "disser", "dissermos", "disserem", "disserem"],
};

const PT_COND_RAIZ: Record<string, string> = {
  fazer: "far", dizer: "dir", trazer: "trar", pôr: "por",
};
export function condicionalPT(inf: string): string[] | null {
  const r = PT_COND_RAIZ[inf] ?? (/(ar|er|ir|ôr)$/.test(inf) ? inf : null);
  if (!r) return null;
  const i = ["ia", "ia", "ia", "íamos", "iam", "iam"];
  return i.map((x, n) => (n === 3 ? `${r}${x}` : `${r}${x}`));
}

/** Imperativo de você, que es la forma de subjuntivo. La de `tu` coincide con
 *  el indicativo ("olha", "espera") y por eso NO se marca: en Brasil esa misma
 *  palabra es la tercera del presente en la mayoria de las frases. */
export function imperativoPT(inf: string): string[][] | null {
  const subj = subjuntivoPresentePT(inf);
  if (!subj) return null;
  return [["você", subj[2]], ["vocês", subj[5]]];
}

const PT_ANTES_OK = new Set([
  "e", "mas", "então", "aí", "olha", "não", "nem", "já", "agora", "depois",
  "me", "te", "se", "nos", "lhe", "lhes", "o", "a", "os", "as", "por", "favor",
]);
export function esOrdenPT(oracion: string, forma: string): boolean {
  const i = oracion.toLowerCase().search(new RegExp(`\\b${forma.toLowerCase()}\\b`));
  if (i < 0) return false;
  const trozo = oracion.slice(0, i);
  const corte = Math.max(...[..."“”\"'.,;:¿?¡!()"].map((c) => trozo.lastIndexOf(c)));
  const antes = trozo.slice(corte + 1).toLowerCase().split(/[^\p{L}áéíóúâêôãõç]+/u).filter(Boolean);
  return antes.every((w) => PT_ANTES_OK.has(w));
}

// ── Italiano y portugués ─────────────────────────────────────────────────
// Tablas cortas y escritas a mano, no un motor: en estos dos paquetes el modo
// no indicativo aparece en un puñado de formas, y un motor a medio hacer
// conjuga mal las otras cinco filas sin que ningún lint lo vea.
export const IT_MODOS: Record<string, { modo: Modo; inf: string; ind: string; rows: string[][] }> = {
  sia: { modo: "Subjunctive", inf: "essere", ind: "è", rows: [["io", "sia"], ["tu", "sia"], ["lui, lei", "sia"], ["noi", "siamo"], ["voi", "siate"], ["loro", "siano"]] },
  siano: { modo: "Subjunctive", inf: "essere", ind: "sono", rows: [["io", "sia"], ["tu", "sia"], ["lui, lei", "sia"], ["noi", "siamo"], ["voi", "siate"], ["loro", "siano"]] },
  abbia: { modo: "Subjunctive", inf: "avere", ind: "ha", rows: [["io", "abbia"], ["tu", "abbia"], ["lui, lei", "abbia"], ["noi", "abbiamo"], ["voi", "abbiate"], ["loro", "abbiano"]] },
  faccia: { modo: "Subjunctive", inf: "fare", ind: "fa", rows: [["io", "faccia"], ["tu", "faccia"], ["lui, lei", "faccia"], ["noi", "facciamo"], ["voi", "facciate"], ["loro", "facciano"]] },
  venga: { modo: "Subjunctive", inf: "venire", ind: "viene", rows: [["io", "venga"], ["tu", "venga"], ["lui, lei", "venga"], ["noi", "veniamo"], ["voi", "veniate"], ["loro", "vengano"]] },
  vada: { modo: "Subjunctive", inf: "andare", ind: "va", rows: [["io", "vada"], ["tu", "vada"], ["lui, lei", "vada"], ["noi", "andiamo"], ["voi", "andiate"], ["loro", "vadano"]] },
  possa: { modo: "Subjunctive", inf: "potere", ind: "può", rows: [["io", "possa"], ["tu", "possa"], ["lui, lei", "possa"], ["noi", "possiamo"], ["voi", "possiate"], ["loro", "possano"]] },
  voglia: { modo: "Subjunctive", inf: "volere", ind: "vuole", rows: [["io", "voglia"], ["tu", "voglia"], ["lui, lei", "voglia"], ["noi", "vogliamo"], ["voi", "vogliate"], ["loro", "vogliano"]] },
  stia: { modo: "Subjunctive", inf: "stare", ind: "sta", rows: [["io", "stia"], ["tu", "stia"], ["lui, lei", "stia"], ["noi", "stiamo"], ["voi", "stiate"], ["loro", "stiano"]] },
  dica: { modo: "Formal command", inf: "dire", ind: "dice", rows: [["Lei", "dica"], ["tu", "di'"], ["voi", "dite"]] },
  senta: { modo: "Formal command", inf: "sentire", ind: "sente", rows: [["Lei", "senta"], ["tu", "senti"], ["voi", "sentite"]] },
  sarebbe: { modo: "Conditional", inf: "essere", ind: "è", rows: [["io", "sarei"], ["tu", "saresti"], ["lui, lei", "sarebbe"], ["noi", "saremmo"], ["voi", "sareste"], ["loro", "sarebbero"]] },
  avrebbe: { modo: "Conditional", inf: "avere", ind: "ha", rows: [["io", "avrei"], ["tu", "avresti"], ["lui, lei", "avrebbe"], ["noi", "avremmo"], ["voi", "avreste"], ["loro", "avrebbero"]] },
  potrebbe: { modo: "Conditional", inf: "potere", ind: "può", rows: [["io", "potrei"], ["tu", "potresti"], ["lui, lei", "potrebbe"], ["noi", "potremmo"], ["voi", "potreste"], ["loro", "potrebbero"]] },
  vorrei: { modo: "Conditional", inf: "volere", ind: "voglio", rows: [["io", "vorrei"], ["tu", "vorresti"], ["lui, lei", "vorrebbe"], ["noi", "vorremmo"], ["voi", "vorreste"], ["loro", "vorrebbero"]] },
};

export const PT_MODOS: Record<string, { modo: Modo; inf: string; ind: string; rows: string[][] }> = {
  seja: { modo: "Subjunctive", inf: "ser", ind: "é", rows: [["eu", "seja"], ["você", "seja"], ["ele, ela", "seja"], ["nós", "sejamos"], ["vocês", "sejam"], ["eles", "sejam"]] },
  sejam: { modo: "Subjunctive", inf: "ser", ind: "são", rows: [["eu", "seja"], ["você", "seja"], ["ele, ela", "seja"], ["nós", "sejamos"], ["vocês", "sejam"], ["eles", "sejam"]] },
  esteja: { modo: "Subjunctive", inf: "estar", ind: "está", rows: [["eu", "esteja"], ["você", "esteja"], ["ele, ela", "esteja"], ["nós", "estejamos"], ["vocês", "estejam"], ["eles", "estejam"]] },
  tenha: { modo: "Subjunctive", inf: "ter", ind: "tem", rows: [["eu", "tenha"], ["você", "tenha"], ["ele, ela", "tenha"], ["nós", "tenhamos"], ["vocês", "tenham"], ["eles", "tenham"]] },
  faça: { modo: "Subjunctive", inf: "fazer", ind: "faz", rows: [["eu", "faça"], ["você", "faça"], ["ele, ela", "faça"], ["nós", "façamos"], ["vocês", "façam"], ["eles", "façam"]] },
  vá: { modo: "Subjunctive", inf: "ir", ind: "vai", rows: [["eu", "vá"], ["você", "vá"], ["ele, ela", "vá"], ["nós", "vamos"], ["vocês", "vão"], ["eles", "vão"]] },
  possa: { modo: "Subjunctive", inf: "poder", ind: "pode", rows: [["eu", "possa"], ["você", "possa"], ["ele, ela", "possa"], ["nós", "possamos"], ["vocês", "possam"], ["eles", "possam"]] },
  queira: { modo: "Subjunctive", inf: "querer", ind: "quer", rows: [["eu", "queira"], ["você", "queira"], ["ele, ela", "queira"], ["nós", "queiramos"], ["vocês", "queiram"], ["eles", "queiram"]] },
  diga: { modo: "Subjunctive", inf: "dizer", ind: "diz", rows: [["eu", "diga"], ["você", "diga"], ["ele, ela", "diga"], ["nós", "digamos"], ["vocês", "digam"], ["eles", "digam"]] },
  venha: { modo: "Subjunctive", inf: "vir", ind: "vem", rows: [["eu", "venha"], ["você", "venha"], ["ele, ela", "venha"], ["nós", "venhamos"], ["vocês", "venham"], ["eles", "venham"]] },
  fosse: { modo: "Past subjunctive", inf: "ser", ind: "foi", rows: [["eu", "fosse"], ["você", "fosse"], ["ele, ela", "fosse"], ["nós", "fôssemos"], ["vocês", "fossem"], ["eles", "fossem"]] },
  tivesse: { modo: "Past subjunctive", inf: "ter", ind: "teve", rows: [["eu", "tivesse"], ["você", "tivesse"], ["ele, ela", "tivesse"], ["nós", "tivéssemos"], ["vocês", "tivessem"], ["eles", "tivessem"]] },
  estivesse: { modo: "Past subjunctive", inf: "estar", ind: "esteve", rows: [["eu", "estivesse"], ["você", "estivesse"], ["ele, ela", "estivesse"], ["nós", "estivéssemos"], ["vocês", "estivessem"], ["eles", "estivessem"]] },
  fizesse: { modo: "Past subjunctive", inf: "fazer", ind: "fez", rows: [["eu", "fizesse"], ["você", "fizesse"], ["ele, ela", "fizesse"], ["nós", "fizéssemos"], ["vocês", "fizessem"], ["eles", "fizessem"]] },
  seria: { modo: "Conditional", inf: "ser", ind: "é", rows: [["eu", "seria"], ["você", "seria"], ["ele, ela", "seria"], ["nós", "seríamos"], ["vocês", "seriam"], ["eles", "seriam"]] },
  teria: { modo: "Conditional", inf: "ter", ind: "tem", rows: [["eu", "teria"], ["você", "teria"], ["ele, ela", "teria"], ["nós", "teríamos"], ["vocês", "teriam"], ["eles", "teriam"]] },
  faria: { modo: "Conditional", inf: "fazer", ind: "faz", rows: [["eu", "faria"], ["você", "faria"], ["ele, ela", "faria"], ["nós", "faríamos"], ["vocês", "fariam"], ["eles", "fariam"]] },
  desculpe: { modo: "Formal command", inf: "desculpar", ind: "desculpa", rows: [["você", "desculpe"], ["vocês", "desculpem"]] },
};
