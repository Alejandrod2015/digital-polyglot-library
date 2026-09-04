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
import { presente, preterito, personas, indicePorForma } from "./buildGlossForms";

export type Modo =
  | "Subjunctive"
  | "Past subjunctive"
  | "Conditional"
  | "Formal command"
  | "Negative command"
  | "Command"
  | "Command + pronoun"
  | "Verb + pronoun"
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
  // La raiz del subjuntivo es la PRIMERA PERSONA del presente sin su -o, y eso
  // vale para toda la lengua: enciendo -> encienda, devuelvo -> devuelva,
  // conozco -> conozca, tengo -> tenga. Sacarla del infinitivo, que es lo que
  // se hacia, no diptonga: daba "encenda" por "encienda" (2026-09-04).
  const yo = presente(inf, "spain")?.[0];
  let raiz = yo && yo.endsWith("o") ? yo.slice(0, -1) : inf.slice(0, -2);
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

/** Los -ir que cambian de raiz llevan TRES raices en el subjuntivo (pido /
 *  pidamos, duermo / durmamos), asi que van escritas enteras. Los -ar y -er
 *  solo llevan dos y salen de la regla de abajo. */
const ES_SUBJ_IR: Record<string, string[]> = {
  dormir: ["duerma", "duermas", "duerma", "durmamos", "durmáis", "duerman"],
  morir: ["muera", "mueras", "muera", "muramos", "muráis", "mueran"],
  sentir: ["sienta", "sientas", "sienta", "sintamos", "sintáis", "sientan"],
  mentir: ["mienta", "mientas", "mienta", "mintamos", "mintáis", "mientan"],
  preferir: ["prefiera", "prefieras", "prefiera", "prefiramos", "prefiráis", "prefieran"],
  pedir: ["pida", "pidas", "pida", "pidamos", "pidáis", "pidan"],
  repetir: ["repita", "repitas", "repita", "repitamos", "repitáis", "repitan"],
  seguir: ["siga", "sigas", "siga", "sigamos", "sigáis", "sigan"],
  conseguir: ["consiga", "consigas", "consiga", "consigamos", "consigáis", "consigan"],
  servir: ["sirva", "sirvas", "sirva", "sirvamos", "sirváis", "sirvan"],
  vestir: ["vista", "vistas", "vista", "vistamos", "vistáis", "vistan"],
  medir: ["mida", "midas", "mida", "midamos", "midáis", "midan"],
  teñir: ["tiña", "tiñas", "tiña", "tiñamos", "tiñáis", "tiñan"],
  corregir: ["corrija", "corrijas", "corrija", "corrijamos", "corrijáis", "corrijan"],
  elegir: ["elija", "elijas", "elija", "elijamos", "elijáis", "elijan"],
};

export function subjuntivoPresenteES(inf: string): string[] | null {
  if (ES_SUBJ[inf]) return [...ES_SUBJ[inf]];
  if (ES_SUBJ_IR[inf]) return [...ES_SUBJ_IR[inf]];
  const r = raizSubjES(inf);
  if (!r) return null;
  const e = r.vocal === "e"
    ? ["e", "es", "e", "emos", "éis", "en"]
    : ["a", "as", "a", "amos", "áis", "an"];
  const salida = e.map((x) => `${r.raiz}${x}`);
  // En -ar y -er el cambio de raiz NO llega a nosotros ni a vosotros: piense
  // pero pensemos, encienda pero encendamos. Esas dos se rehacen desde la raiz
  // del infinitivo.
  const fin = inf.slice(-2);
  if ((fin === "ar" || fin === "er") && r.raiz !== inf.slice(0, -2)) {
    const llana = raizAtonaES(inf);
    if (llana) { salida[3] = `${llana}${e[3]}`; salida[4] = `${llana}${e[4]}`; }
  }
  return salida;
}

/** La raiz sin diptongo, con los mismos ajustes ortograficos que la tonica. */
function raizAtonaES(inf: string): string | null {
  const fin = inf.slice(-2);
  let raiz = inf.slice(0, -2);
  if (fin === "ar") {
    if (/c$/.test(raiz)) raiz = `${raiz.slice(0, -1)}qu`;
    else if (/gu$/.test(raiz)) raiz = `${raiz}ü`;
    else if (/g$/.test(raiz)) raiz = `${raiz}u`;
    else if (/z$/.test(raiz)) raiz = `${raiz.slice(0, -1)}c`;
  }
  return raiz;
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
 *  (me vaya, te vayas, se vaya); de objeto, se queda igual en las seis. */
const REFLEXIVOS = ["me", "te", "se", "nos", "se", "se"];
export function conClitico(filas: string[], clitico: string): string[] {
  const c = clitico.trim();
  if (!c) return filas;
  const refl = ["me", "te", "se", "nos"].includes(c);
  return filas.map((f, i) => `${refl ? REFLEXIVOS[i] : c} ${f}`);
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
