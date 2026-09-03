/**
 * Escribe la capa GRAMATICAL de las glosas: el distintivo de modo y las formas
 * de las palabras que NO son indicativo.
 *
 *   npx tsx scripts/buildGlossMoods.ts <bundle|--all> [--dry]
 *
 * Solo toca `f` y añade `f.mood`. No mira ni escribe `g`, `t` ni `c`: la
 * definición y el trozo traducido son trabajo de otra pasada y están escritos a
 * mano. A diferencia de `buildGlossForms.ts`, esta NO salta las historias con
 * capa escrita a mano, porque justo esas son las que se quedaron sin bloque.
 *
 * Reparto de la tarjeta:
 *   contraste (subjuntivo, condicional, Konjunktiv II)  head + rows + enlace
 *   imperativo y enclítico                              rows a la vista, sin enlace
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { presente, preterito, personas, indicePorForma, IRREGULARES } from "./buildGlossForms";
import {
  type Bloque, type Modo, subjuntivoPresenteES, subjuntivoPasadoES, condicionalES,
  imperativoES, esOrdenES, esOrdenDE, negadaAquiES, parteEncliticaES, ES_IMP_TU, ES_PRON_EN,
  aVarianteModo, conClitico, vosSubjuntivo, DE_K2, DE_IMP,
  congiuntivoIT, congiuntivoImperfettoIT, condizionaleIT, imperativoIT, esOrdenIT,
  subjuntivoPresentePT, subjuntivoImperfeitoPT, PT_FUT_SUBJ, condicionalPT, imperativoPT, esOrdenPT,
  presenteFR, subjonctifFR, conditionnelFR, imperatifFR, esOrdenFR, FR_PERSONAS,
} from "./glossMoods";
import { itConjuga, ptConjuga, IT_PERSONAS, PT_PERSONAS } from "./buildGlossForms";

/**
 * Un idioma = un motor. Lo que el motor tiene que saber decir es: el presente
 * (para la celda de contraste), que formas son INDICATIVO (lo que no se toca),
 * los modos, y si una forma en una oracion dada es una orden.
 *
 * Un idioma que no este aqui NO se marca. Hoy estan los cinco que tienen
 * paquete: espanol, aleman, italiano, portugues y frances; el espanol y el
 * aleman van por su propio camino mas abajo (encliticos y voseo el uno,
 * tablas cerradas de Konjunktiv II el otro).
 */
type Motor = {
  personas: string[];
  presente: (inf: string) => string[] | null;
  indicativos: Array<(inf: string) => string[] | null>;
  subj?: (inf: string) => string[] | null;
  subjPasado?: (inf: string) => string[] | null;
  subjFuturo?: (inf: string) => string[] | null;
  cond?: (inf: string) => string[] | null;
  imper?: (inf: string) => string[][] | null;
  esOrden: (oracion: string, forma: string) => boolean;
  /**
   * Formas que PODRIAN ser indicativo aunque el motor no sepa conjugar ese
   * verbo. Es la red que faltaba: `ptConjuga` se niega a conjugar `cobrir` y
   * `sentir` (raiz que cambia), asi que `cobre` y `sente` no estaban en el
   * indice de indicativo y los reclamaba el subjuntivo de `cobrar` y de
   * `sentar`, que son la misma palabra. Un homografo sin resolver se queda sin
   * bloque.
   */
  posibleIndicativo: (inf: string) => string[];
  /** El infinitivo, para el enlace y el lema. */
  finales: RegExp;
};

export const MOTORES: Record<string, Motor> = {
  italian: {
    personas: IT_PERSONAS,
    presente: (inf) => itConjuga(inf, "presente"),
    indicativos: [(inf) => itConjuga(inf, "presente"), (inf) => itConjuga(inf, "imperfecto")],
    subj: congiuntivoIT,
    subjPasado: congiuntivoImperfettoIT,
    cond: condizionaleIT,
    imper: imperativoIT,
    esOrden: esOrdenIT,
    posibleIndicativo: (inf) => {
      const r = inf.slice(0, -3);
      if (!/(are|ere|ire)$/.test(inf)) return [];
      return inf.endsWith("are") ? [`${r}a`, `${r}i`, `${r}ano`] : [`${r}e`, `${r}i`, `${r}ono`];
    },
    finales: /(are|ere|ire)$/,
  },
  portuguese: {
    personas: PT_PERSONAS,
    presente: (inf) => ptConjuga(inf, "presente"),
    indicativos: [
      (inf) => ptConjuga(inf, "presente"),
      (inf) => ptConjuga(inf, "pretérito"),
      (inf) => ptConjuga(inf, "imperfecto"),
    ],
    subj: subjuntivoPresentePT,
    subjPasado: subjuntivoImperfeitoPT,
    subjFuturo: (inf) => PT_FUT_SUBJ[inf] ?? null,
    cond: condicionalPT,
    imper: imperativoPT,
    esOrden: esOrdenPT,
    posibleIndicativo: (inf) => {
      const r = inf.slice(0, -2);
      if (!/(ar|er|ir)$/.test(inf)) return [];
      if (inf.endsWith("ar")) return [`${r}a`, `${r}am`];
      // Los -ir de Brasil suben la vocal de la raiz en la tercera: sumir da
      // `some`, subir da `sobe`, fugir da `foge`. Sin esta variante, `some`
      // se lo quedaba el subjuntivo de `somar`, que es la misma palabra, y
      // salieron seis "O sol some" marcados de subjuntivo.
      const subida = r.replace(/u([^aeiou]*)$/, "o$1");
      return [`${r}e`, `${r}em`, `${subida}e`, `${subida}em`];
    },
    finales: /(ar|er|ir|ôr)$/,
  },
  french: {
    personas: FR_PERSONAS,
    presente: presenteFR,
    indicativos: [presenteFR],
    subj: subjonctifFR,
    cond: conditionnelFR,
    imper: imperatifFR,
    esOrden: esOrdenFR,
    posibleIndicativo: (inf) => {
      const r = inf.slice(0, -2);
      if (inf.endsWith("er")) return [`${r}e`, `${r}es`, `${r}ent`];
      if (inf.endsWith("ir")) return [`${r}is`, `${r}it`, `${r}issent`];
      if (inf.endsWith("re")) return [`${r}s`, r, `${r}ent`];
      return [];
    },
    finales: /(er|ir|re|oir)$/,
  },
};

type Idx = Map<string, { inf: string; i: number }>;

/** Los idiomas con capa gramatical escrita. Uno que no este aqui no se marca,
 *  y el lint lo NOMBRA en cada pasada en vez de callarse. */
export const CON_MOTOR = ["spanish", "german", "italian", "portuguese", "french"];

/** El bloque de un idioma con motor generico (italiano, portugues, frances). */
function bloqueMotor(
  motor: Motor, w: string, oracion: string,
  idx: { subj: Idx; pas: Idx; fut: Idx; cond: Idx; imper: Idx }
): Bloque | null {
  const P = motor.personas;
  const par = (etiqueta: string, izq: string, aqui: string): string[][] =>
    [[etiqueta, izq], [etiqueta === "preterite" ? "past subjunctive" : "subjunctive", aqui]];

  // El imperativo va PRIMERO, y solo si la posicion en la frase lo prueba: en
  // frances `regarde` es la tercera del indicativo y el imperativo de tu, y en
  // italiano `scusi` es la segunda del indicativo y la orden de cortesia.
  const im = idx.imper.get(w);
  if (im && motor.imper && motor.esOrden(oracion, w)) {
    const cel = motor.imper(im.inf)!;
    const formal = cel[im.i]?.[0];
    return {
      mood: formal === "Lei" || formal === "você" || formal === "vous" ? "Formal command" : "Command",
      kind: "line", head: [], rows: cel, here: im.i,
    };
  }

  const sp = idx.subj.get(w);
  if (sp) {
    const tabla = motor.subj!(sp.inf)!;
    const ind = motor.presente(sp.inf);
    if (!ind) return null;
    return {
      mood: "Subjunctive", kind: "expand", link: `See ${sp.inf}`,
      lemma: `${sp.inf} (present subjunctive)`,
      head: par("present", ind[sp.i], w),
      rows: tabla.map((f, i) => [P[i], f]), here: sp.i,
    };
  }

  const pa = idx.pas.get(w);
  if (pa && motor.subjPasado) {
    const ind = motor.indicativos[1]?.(pa.inf) ?? motor.presente(pa.inf);
    if (!ind) return null;
    return {
      mood: "Past subjunctive", kind: "expand", link: `See ${pa.inf}`,
      lemma: `${pa.inf} (past subjunctive)`,
      head: par("preterite", ind[pa.i], w),
      rows: motor.subjPasado(pa.inf)!.map((f, i) => [P[i], f]), here: pa.i,
    };
  }

  const fu = idx.fut.get(w);
  if (fu && motor.subjFuturo) {
    const ind = motor.presente(fu.inf);
    if (!ind) return null;
    return {
      mood: "Future subjunctive", kind: "expand", link: `See ${fu.inf}`,
      lemma: `${fu.inf} (future subjunctive)`,
      head: [["present", ind[fu.i]], ["future subjunctive", w]],
      rows: motor.subjFuturo(fu.inf)!.map((f, i) => [P[i], f]), here: fu.i,
    };
  }

  const co = idx.cond.get(w);
  if (co && motor.cond) {
    const ind = motor.presente(co.inf);
    if (!ind) return null;
    return {
      mood: "Conditional", kind: "expand", link: `See ${co.inf}`,
      lemma: `${co.inf} (conditional)`,
      head: [["present", ind[co.i]], ["conditional", w]],
      rows: motor.cond(co.inf)!.map((f, i) => [P[i], f]), here: co.i,
    };
  }

  return null;
}

const prisma = new PrismaClient();
type Entrada = { g?: string; t?: string; c?: { es: string; en: string }; f?: Record<string, unknown> };

/** Formas que son a la vez indicativo de un verbo y no indicativo de otro y que
 *  el índice de indicativo no atrapa. Se quedan SIN bloque a propósito. */
const AMBIGUAS = new Set(["sienta", "siente", "sientan", "sientas"]);

/** `haber` solo aparece de auxiliar ("si hubiera abierto"), y ahi la forma que
 *  contrasta no es `hubo` sino todo el tiempo compuesto. Sin bloque. */
const SIN_BLOQUE = new Set(["hubiera", "hubieras", "hubiéramos", "hubieran", "hubiese",
  "hubieses", "hubiésemos", "hubiesen", "haya", "hayas", "hayamos", "hayan",
  "habría", "habrías", "habríamos", "habrían"]);

function oracionDe(texto: string, ancla: string, palabra: string): string {
  const frases = texto.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/);
  // Con `includes` a secas, "No seas miedoso" se daba por la frase de `sea` y
  // la clasificacion salia de una oracion que no era la suya.
  const con = (s: string, x: string) =>
    new RegExp(`(^|[^\\p{L}])${x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(s);
  return frases.find((s) => ancla && con(s, ancla)) ?? frases.find((s) => con(s, palabra)) ?? "";
}

/** El pronombre atono pegado delante de la forma en la frase real ("se vaya").
 *  Vacio cuando no lo hay. */
function clitico(oracion: string, w: string): string {
  const m = new RegExp(`\\b(me|te|se|nos|le|les|lo|la|los|las)\\s+${w}\\b`, "i").exec(oracion);
  return m ? `${m[1].toLowerCase()} ` : "";
}

/** Cuando la frase dice el sujeto, manda la frase. En subjuntivo `cuente` es a
 *  la vez "yo cuente" y "ella cuente", y la tabla no puede saberlo: en "de que
 *  yo cuente" lo dice el `yo` que va delante. Solo se acepta si esa persona
 *  tiene de verdad esa forma. */
const SUJETOS: Array<[RegExp, number]> = [
  [/\byo\b/, 0], [/\b(tú|tu|vos)\b/, 1], [/\b(usted|él|ella)\b/, 2],
  [/\bnosotr[oa]s\b/, 3], [/\b(ustedes|vosotr[oa]s)\b/, 4], [/\b(ellos|ellas)\b/, 5],
];
function personaDicha(oracion: string, w: string, tabla: string[], porDefecto: number): number {
  const bajo = oracion.toLowerCase();
  const i = bajo.indexOf(w.toLowerCase());
  if (i < 0) return porDefecto;
  const antes = bajo.slice(0, i).split(/[^\p{L}]+/u).filter(Boolean).slice(-3).join(" ");
  for (const [re, p] of SUJETOS) {
    if (re.test(antes) && tabla[p]?.toLowerCase() === w.toLowerCase()) return p;
  }
  return porDefecto;
}

/** El infinitivo tal como se dice: con `se` cuando el clítico es reflexivo.
 *  "ir (present subjunctive)" sobre `se vaya` nombra otro verbo. */
function lema(inf: string, clitico: string): string {
  return ["me", "te", "se", "nos"].includes(clitico.trim()) ? `${inf}se` : inf;
}

function bloqueES(
  w: string, oracion: string, variante: string,
  idxSubj: Map<string, { inf: string; i: number }>,
  idxPas: Map<string, { inf: string; i: number }>,
  idxCond: Map<string, { inf: string; i: number }>,
  infinitivos: Set<string>,
  P: string[]
): Bloque | null {
  const enc = parteEncliticaES(w);
  if (enc) {
    for (const base of enc.bases) {
      const esInf = infinitivos.has(base);
      const impUsted = idxSubj.get(base);
      const impTu = [...infinitivos].find((inf) => (imperativoES(inf, variante) ?? [])[2]?.[1] === base);
      if (!esInf && !impUsted && !impTu) continue;
      // Ojo: solo se acepta cuando la base ES un verbo conocido. `hable` acaba
      // en `le` y se partia en `hab` + `le`; si aqui se devolviera null, esa
      // palabra se quedaba sin bloque en vez de seguir hasta el subjuntivo.

      const filas: string[][] = [[esInf ? "verb" : "command", base]];
      for (const p of enc.pron) filas.push([p, ES_PRON_EN[p] ?? p]);
      return {
        mood: esInf ? "Verb + pronoun" : "Command + pronoun",
        kind: "line", rows: filas, head: [], here: 0,
      };
    }
    // Ninguna base valia: no era un enclitico, sigue el camino normal.
  }

  const sp0 = idxSubj.get(w);
  const sp = sp0 ? { ...sp0, i: personaDicha(oracion, w, subjuntivoPresenteES(sp0.inf) ?? [], sp0.i) } : undefined;
  if (sp) {
    const tabla = subjuntivoPresenteES(sp.inf)!;
    const orden = esOrdenES(oracion, w, sp.inf);
    const negada = negadaAquiES(oracion, w);
    // La segunda persona en subjuntivo SOLO es orden cuando esta negada: el
    // imperativo afirmativo de tu usa el indicativo ("come"), no "comas".
    if (orden && (sp.i === 2 || sp.i === 5 || (sp.i === 1 && negada))) {
      const cel = imperativoES(sp.inf, variante);
      if (!cel) return null;
      const neg = negada;
      // En negativo la orden de tuteo cambia de modo: "come" pero "no comas".
      // Pegarle un `no` a la afirmativa daba "no busca", que no existe.
      // La de tuteo va en subjuntivo, y en voseo con su acento: "no comas"
      // pero "no comás". `aVarianteModo` ya lo resuelve, asi que aqui se usa la
      // tabla adaptada y no la cruda.
      const tv = aVarianteModo(tabla, variante);
      const negadas = (): string[][] => [
        ["usted", `no ${tv[2]}`], ["ustedes", `no ${tv[5]}`], [cel[2][0], `no ${tv[1]}`],
      ];
      if (sp.i === 1) {
        // Segunda persona en subjuntivo sin disparador: es una orden negada.
        return {
          mood: "Negative command", kind: "line", head: [],
          rows: [[cel[2][0], `no ${tv[1]}`], ["usted", `no ${tv[2]}`]],
          here: 0,
        };
      }
      // En LATAM `ustedes` es el plural de tu y de usted a la vez: llamar
      // "formal" a "Miren hacia el valle" entre amigas es falso. En España si,
      // porque ahi el plural de tu es vosotros.
      const plural = sp.i === 5;
      return {
        mood: plural && variante !== "spain" ? "Command" : "Formal command",
        kind: "line", head: [],
        rows: neg ? negadas() : cel,
        here: plural ? 1 : 0,
      };
    }
    const ind = presente(sp.inf, variante);
    if (!ind) return null;
    // "se vaya" contra "se va", no "vaya" contra "va": sin el pronombre las dos
    // celdas dejan de parecerse a lo que el lector tiene en la frase.
    const cl = clitico(oracion, w);
    return {
      mood: "Subjunctive", kind: "expand", link: "See subjunctive",
      lemma: `${lema(sp.inf, cl)} (present subjunctive)`,
      head: [["present", `${cl}${ind[sp.i]}`], ["subjunctive", `${cl}${w}`]],
      rows: conClitico(aVarianteModo(tabla, variante), cl).map((f, i) => [P[i], f]), here: sp.i,
    };
  }

  const pa = idxPas.get(w);
  if (pa) {
    const clp = clitico(oracion, w);
    const pret = preterito(pa.inf);
    if (!pret) return null;
    return {
      mood: "Past subjunctive", kind: "expand", link: "See past subjunctive",
      lemma: `${lema(pa.inf, clp)} (past subjunctive)`,
      head: [["preterite", `${clp}${pret[pa.i]}`], ["past subjunctive", `${clp}${w}`]],
      rows: conClitico(aVarianteModo(subjuntivoPasadoES(pa.inf)!, variante), clp).map((f, i) => [P[i], f]),
      here: pa.i,
    };
  }

  const co = idxCond.get(w);
  if (co) {
    const clc = clitico(oracion, w);
    const ind = presente(co.inf, variante);
    if (!ind) return null;
    return {
      mood: "Conditional", kind: "expand", link: "See conditional",
      lemma: `${co.inf} (conditional)`,
      head: [["present", `${clc}${ind[co.i]}`], ["conditional", `${clc}${w}`]],
      rows: conClitico(aVarianteModo(condicionalES(co.inf)!, variante), clc).map((f, i) => [P[i], f]),
      here: co.i,
    };
  }

  const inf = Object.entries(ES_IMP_TU).find(([, f]) => f === w)?.[0];
  if (inf && infinitivos.has(inf)) {
    const cel = imperativoES(inf, variante);
    if (cel) return { mood: "Command", kind: "line", head: [], rows: cel, here: 2 };
  }
  return null;
}

/** Aleman: tablas cerradas, no motor. Solo entra la forma de Konjunktiv II que
 *  NO coincide con el Prateritum, y el imperativo de du que ningun indicativo
 *  comparte. Ver los comentarios de `DE_K2` y `DE_IMP`. */
function bloqueDE(w: string, oracion: string): Bloque | null {
    const k = DE_K2[w];
    if (k) return {
      mood: "Konjunktiv II", kind: "expand", link: `See ${k.inf}`,
      lemma: `${k.inf} (Konjunktiv II)`,
      head: [["present", k.ind], ["Konjunktiv II", w]],
      rows: k.rows, here: k.rows.findIndex((r) => r[1] === w),
    };
    const im = DE_IMP[w];
    if (im && !esOrdenDE(oracion, w)) return null;
    if (im) return {
      mood: "Command", kind: "line", head: [],
      rows: [["du", w], ["ihr", im.ihr], ["Sie", im.sie]], here: 0,
    };
    return null;
}


/** Los bloques que le tocan a un paquete, sin escribir nada. Lo comparten el
 *  generador y el lint `checkGlossMoods.ts`, para que el lint mida exactamente
 *  lo que el generador haria y no una copia que se desincroniza. */
export type Pendiente = { slug: string; palabra: string; bloque: Bloque; oracion: string };

export async function moodsDeBundle(
  prismaC: PrismaClient,
  bundleNombre: string,
  fuerza = false
): Promise<{ pendientes: Pendiente[]; idioma: string; capas: Array<{ slug: string; glosses: unknown }> } | null> {
  const filas = await prismaC.tapGlossSet.findMany({ where: { bundle: bundleNombre } });
  const global = filas.find((f) => f.slug === "");
  if (!global) return null;
  const idioma = (global.language ?? "").toLowerCase();
  const variante = (global.variant ?? "").trim().toLowerCase();
  if (!CON_MOTOR.includes(idioma)) return { pendientes: [], idioma, capas: [] };
  const capas = filas.filter((f) => f.slug !== "");
  const plana = global.glosses as Record<string, Entrada>;

  const infinitivos = new Set<string>(idioma === "spanish" ? Object.keys(IRREGULARES) : []);
  // Las terminaciones del infinitivo son de cada idioma. Con la regex espanola,
  // los `-re` y los `-oir` franceses no entraban en el barrido y medio motor se
  // quedaba sin verbos.
  const FIN = idioma === "italian" ? /(are|ere|ire)$/
    : idioma === "german" ? /(en|eln|ern)$/
    : idioma === "french" ? /(er|ir|re|oir)$/
    : /(ar|er|ir|ír)$/;
  const TOK = idioma === "italian"
    ? /\b([a-zàèéìòù]{3,}(?:are|ere|ire))(?:si)?\b/g
    : idioma === "french"
      ? /\b([a-zàâçéèêëîïôûùüÿœ]{2,}(?:er|ir|re|oir))\b/g
      : /\b([a-záéíóúñãõçü]{2,}(?:ar|er|ir|ír))(?:se|me|te|nos)?\b/g;
  for (const fuente of [plana, ...capas.map((c) => c.glosses as Record<string, Entrada>)]) {
    for (const [k, v] of Object.entries(fuente)) {
      if (v?.t === "verb" && FIN.test(k)) infinitivos.add(k);
      for (const par of (v?.g ?? "").match(/\(([^)]*)\)/g) ?? []) {
        for (const m of par.matchAll(TOK)) {
          infinitivos.add(m[1]);
          if (/(se)$/.test(m[0]) && m[0] !== m[1]) infinitivos.add(m[0]);
        }
      }
    }
  }

  const indicativo = new Set<string>();
  if (idioma === "spanish") {
    for (const [f] of indicePorForma([...infinitivos], variante, "spanish")) {
      indicativo.add(f);
      const ult = f.split(" ").pop(); if (ult) indicativo.add(ult);
    }
  }

  const P = personas(variante);
  const PREF = [2, 5, 1, 3, 0, 4];
  const mejor = (a: number, b: number) => (PREF.indexOf(a) <= PREF.indexOf(b) ? a : b);
  const mk = (gen: (inf: string) => string[] | null) => {
    const m = new Map<string, { inf: string; i: number }>();
    for (const inf of infinitivos) {
      const t = gen(inf); if (!t) continue;
      t.forEach((f, i) => {
        const k = f.toLowerCase();
        const y = m.get(k);
        if (!y) m.set(k, { inf, i });
        else if (y.inf === inf) m.set(k, { inf, i: mejor(y.i, i) });
      });
    }
    return m;
  };
  const idxSubj = idioma === "spanish" ? mk(subjuntivoPresenteES) : new Map();
  const idxPas = idioma === "spanish" ? mk(subjuntivoPasadoES) : new Map();
  const idxCond = idioma === "spanish" ? mk(condicionalES) : new Map();

  // Italiano, portugues y frances: un motor por idioma. El indice de indicativo
  // se llena con TODOS los tiempos que el motor sabe, porque lo que ya es
  // indicativo no se toca; el de imperativo indexa las celdas de la orden, que
  // en estos tres idiomas son las que chocan con el indicativo.
  const motor = MOTORES[idioma];
  const idxM = { subj: new Map() as Idx, pas: new Map() as Idx, fut: new Map() as Idx, cond: new Map() as Idx, imper: new Map() as Idx };
  if (motor) {
    for (const gen of motor.indicativos) {
      for (const inf of infinitivos) {
        for (const f of gen(inf) ?? []) indicativo.add(f.toLowerCase());
      }
    }
    for (const inf of infinitivos) {
      for (const f of motor.posibleIndicativo(inf)) indicativo.add(f.toLowerCase());
    }
    // Misma preferencia de persona que en espanol: cuando varias casillas son
    // la MISMA palabra (`tiver` es eu, voce y ele a la vez), gana la tercera
    // del singular, que es la lectura corriente en narracion. Quedarse con la
    // primera que aparece dejaba `tiver` rotulado de "eu".
    const PREF_M = [2, 1, 5, 3, 0, 4];
    const llena = (destino: Idx, gen?: (inf: string) => string[] | null) => {
      if (!gen) return;
      for (const inf of infinitivos) {
        (gen(inf) ?? []).forEach((f, i) => {
          const k = f.toLowerCase();
          const y = destino.get(k);
          if (!y) destino.set(k, { inf, i });
          else if (y.inf === inf && PREF_M.indexOf(i) < PREF_M.indexOf(y.i)) destino.set(k, { inf, i });
        });
      }
    };
    llena(idxM.subj, motor.subj);
    llena(idxM.pas, motor.subjPasado);
    llena(idxM.fut, motor.subjFuturo);
    llena(idxM.cond, motor.cond);
    for (const inf of infinitivos) {
      (motor.imper?.(inf) ?? []).forEach(([, f], i) => {
        const k = f.toLowerCase();
        if (!idxM.imper.has(k)) idxM.imper.set(k, { inf, i });
      });
    }
  }

  const textos = new Map<string, string>();
  {
    const st = await prismaC.journeyStory.findMany({
      where: { slug: { in: capas.map((c) => c.slug) } },
      select: { slug: true, title: true, text: true, journey: { select: { language: true, variant: true } } },
    });
    for (const s of st) {
      if (s.journey.language !== global.language || s.journey.variant !== global.variant) continue;
      textos.set(s.slug, `${s.title}. ${s.text}`);
    }
  }

  const pendientes: Pendiente[] = [];
  for (const fila of capas) {
    const capa = fila.glosses as Record<string, Entrada>;
    const texto = textos.get(fila.slug) ?? "";
    const palabras = new Set((texto.match(/\p{L}+/gu) ?? []).map((x) => x.toLowerCase()));
    for (const w of new Set([...palabras, ...Object.keys(capa)])) {
      const fuente = capa[w] ?? plana[w];
      if (fuente?.t !== "verb") continue;
      const e = capa[w] ?? plana[w];
      if (!fuerza && e.f && (e.f as { mood?: string }).mood) continue;
      if (AMBIGUAS.has(w) || SIN_BLOQUE.has(w)) continue;
      const oracion = oracionDe(texto, e.c?.es ?? "", w);
      // El imperativo GANA al indicativo, pero solo con la posicion de la frase
      // de su parte: en frances `regarde` es la tercera del indicativo y la
      // orden de tu, y en italiano `scusi` es la segunda del indicativo y la
      // orden de cortesia. Sin esta precedencia, o se pierden todas las ordenes
      // o el presente entero sale marcado de subjuntivo (en frances el
      // subjonctif de los -er es la misma palabra que el indicativo).
      const ordenProbada = !!motor && idxM.imper.has(w) && motor.esOrden(oracion, w);
      if (!ordenProbada && indicativo.has(w)) continue;
      const b = idioma === "spanish"
        ? bloqueES(w, oracion, variante, idxSubj, idxPas, idxCond, infinitivos, P)
        : idioma === "german"
          ? bloqueDE(w, oracion)
          : motor
            ? bloqueMotor(motor, w, oracion, idxM)
            : null;
      if (!b) continue;
      if (b.here < 0 && b.kind === "expand") continue;
      pendientes.push({ slug: fila.slug, palabra: w, bloque: b, oracion });
    }
  }
  return { pendientes, idioma, capas: capas.map((c) => ({ slug: c.slug, glosses: c.glosses })) };
}

/** Los paquetes de journeys vivos (live + draft). */
export async function paquetesVivos(prismaC: PrismaClient): Promise<string[]> {
  const vivos = await prismaC.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { language: true, variant: true },
  });
  const permitidos = new Set(vivos.map((j) => `${j.language}|${j.variant}`));
  const globales = await prismaC.tapGlossSet.findMany({ where: { slug: "" } });
  return globales.filter((g) => permitidos.has(`${g.language}|${g.variant}`)).map((g) => g.bundle);
}

async function main() {
  const arg = process.argv[2];
  const dry = process.argv.includes("--dry");
  const verboso = process.argv.includes("-v");
  // Rehace los bloques ya escritos: la tabla se REHACE, no se hereda, igual
  // que en `buildGlossForms.ts`, o un arreglo del motor deja viva la tabla mala.
  const fuerza = process.argv.includes("--force");
  if (!arg) { console.error("uso: buildGlossMoods.ts <bundle|--all> [--dry] [--force] [-v]"); process.exit(2); }

  const objetivo = arg === "--all" ? await paquetesVivos(prisma) : [arg];

  for (const nombre of objetivo) {
    const r = await moodsDeBundle(prisma, nombre, fuerza);
    if (!r) { console.error(`el paquete ${nombre} no existe en la base`); process.exitCode = 1; continue; }
    if (!CON_MOTOR.includes(r.idioma)) {
      console.log(`${nombre}: idioma "${r.idioma}" sin tablas de modo, no toco nada`);
      continue;
    }
    const porSlug = new Map<string, Record<string, Entrada>>(
      r.capas.map((c) => [c.slug, c.glosses as Record<string, Entrada>])
    );
    const porModo = new Map<Modo, number>();
    const tocadas = new Set<string>();
    for (const { slug, palabra, bloque, oracion } of r.pendientes) {
      const capa = porSlug.get(slug)!;
      const e: Entrada = capa[palabra] ?? { g: undefined, t: "verb" };
      const f: Record<string, unknown> = {
        kind: bloque.kind, mood: bloque.mood, rows: bloque.rows, here: bloque.here,
      };
      if (bloque.head.length) f.head = bloque.head;
      if (bloque.link) f.link = bloque.link;
      if (bloque.lemma) f.lemma = bloque.lemma;
      e.f = f;
      capa[palabra] = e;
      tocadas.add(slug);
      porModo.set(bloque.mood, (porModo.get(bloque.mood) ?? 0) + 1);
      if (verboso) {
        const vis = (bloque.head.length ? bloque.head : bloque.rows).map(([a, c2]) => `${a}: ${c2}`).join("  |  ");
        console.log(`  ${palabra.padEnd(16)} ${bloque.mood.padEnd(18)} ${vis}`);
        console.log(`  ${" ".repeat(16)} ${(oracion || "(sin frase)").slice(0, 96)}`);
      }
    }
    if (!dry) {
      for (const slug of tocadas) {
        await prisma.tapGlossSet.update({
          where: { bundle_slug: { bundle: nombre, slug } },
          data: { glosses: porSlug.get(slug) as never },
        });
      }
    }
    const detalle = [...porModo].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(", ");
    console.log(`${nombre.padEnd(32)} ${String(r.pendientes.length).padStart(4)} bloques  ${detalle}`);
  }
  if (dry) console.log("\n(--dry: no se ha escrito nada)");
  await prisma.$disconnect();
}
// Este fichero es tambien la BIBLIOTECA de la capa gramatical: el lint
// `checkGlossMoods.ts` importa `moodsDeBundle` y `paquetesVivos` para medir
// exactamente lo que este generador haria. Por eso `main()` solo corre cuando
// se invoca el fichero directamente.
if (/buildGlossMoods\.ts$/.test(process.argv[1] ?? "")) main();
