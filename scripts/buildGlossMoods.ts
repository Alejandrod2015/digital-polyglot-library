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
  aVarianteModo, conReflexivo, vosSubjuntivo,
  DE_K2, DE_IMP, IT_MODOS, PT_MODOS,
} from "./glossMoods";

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

/**
 * Qué papel hace el clítico de delante, que es lo que decide las filas.
 *
 *   reflexivo  concuerda con el sujeto (se quede, te quedes, nos quedemos). Las
 *              filas lo conjugan por persona y el lema lleva `se`.
 *   objeto     no cambia con la persona ("que me guarden", "aunque le
 *              costara"), o es el `se` impersonal ("lo que se pueda"). El head
 *              lo lleva porque así sale en la frase; las filas van sin él.
 *   sube       es de un infinitivo que va detrás: en "Me tendría que ir" el
 *              `me` es de ir(se), no de tener. Ni el head ni las filas lo llevan.
 *
 * Hasta el 2026-09-10 todo clítico se trataba como reflexivo: "que me guarden"
 * enseñaba `te guardes / se guarden` y un verbo "guardarse" que no estaba en
 * la frase.
 *
 * Decidirlo pide prueba. `le`, `les`, `lo`, `la`, `los`, `las` nunca son el
 * reflexivo. `me`, `te`, `nos` lo son cuando su persona es la del sujeto de la
 * forma: con una tercera persona son objeto. Si la forma sirve a la vez para
 * esa persona y para la tercera (`quede` es yo y él), desempata que el paquete
 * conozca el verbo con `se`. `se` delante de una tercera persona pide lo mismo;
 * sin esa prueba es el impersonal y no se conjuga.
 */
type Rol = { tipo: "reflexivo" | "objeto" | "sube" | "ninguno"; persona: number; lemaSe?: boolean };
const PERSONA_CL: Record<string, number> = { me: 0, te: 1, nos: 3 };

/** Verbos que llevan detrás un infinitivo y le prestan el hueco del clítico,
 *  con la palabra que va entre los dos (vacía si no hay ninguna). */
const SUBIDA: Record<string, string> = {
  tener: "que", ir: "a", volver: "a", empezar: "a", acabar: "de", dejar: "de",
  poder: "", querer: "", deber: "", soler: "", necesitar: "", saber: "",
  pensar: "", preferir: "", intentar: "",
};

function rolClitico(
  oracion: string, w: string, cl: string, inf: string, persona: number,
  tabla: string[], pronominales: Set<string>, glosa: string
): Rol {
  const c = cl.trim().toLowerCase();
  if (!c) return { tipo: "ninguno", persona };
  const pc = PERSONA_CL[c];
  const sirve = (p: number | undefined) => p !== undefined && tabla[p]?.toLowerCase() === w.toLowerCase();
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // La prueba de que el verbo es pronominal: la glosa de ESTA palabra lo nombra
  // con `se` ("leaves, goes away (irse)"), o el paquete lo conoce así.
  const conSe = (v: string) =>
    pronominales.has(`${v}se`) || new RegExp(`(?<![\\p{L}])${v}se(?![\\p{L}])`, "iu").test(glosa);

  const puente = SUBIDA[inf];
  if (puente !== undefined) {
    const m = new RegExp(
      `(?<![\\p{L}])${esc}\\s+${puente ? `${puente}\\s+` : ""}(\\p{L}*(?:ar|er|ir|ír))(?![\\p{L}])`, "iu"
    ).exec(oracion);
    if (m) {
      // Con un infinitivo pronominal el clítico nombra al sujeto: "me tendría
      // que ir" es yo, aunque `tendría` sirva también para él.
      const destino = m[1].toLowerCase();
      const p = sirve(pc) && pronominales.has(`${destino}se`) ? pc! : persona;
      return { tipo: "sube", persona: p };
    }
  }

  // "se me apague", "se te ocurra", "se le acerque": el `se` es del verbo
  // (apagarse) y el de delante de la forma es un dativo que no se conjuga.
  if (["me", "te", "le", "nos", "les"].includes(c)
      && new RegExp(`(?<![\\p{L}])se\\s+${c}\\s+${esc}(?![\\p{L}])`, "iu").test(oracion)) {
    return { tipo: "objeto", persona, lemaSe: true };
  }
  if (c === "se") {
    const tercera = persona === 2 || persona === 5;
    return { tipo: tercera && conSe(inf) ? "reflexivo" : "objeto", persona };
  }
  if (pc === undefined) return { tipo: "objeto", persona };
  if (pc === persona) return { tipo: "reflexivo", persona };
  if (sirve(pc) && conSe(inf)) return { tipo: "reflexivo", persona: pc };
  return { tipo: "objeto", persona };
}

/** El head lleva el clítico como en la frase, salvo cuando es de otro verbo. */
const delante = (cl: string, rol: Rol) => (rol.tipo === "sube" ? "" : cl);
const filasDe = (filas: string[], rol: Rol, variante: string) =>
  rol.tipo === "reflexivo" ? conReflexivo(filas, variante) : filas;
/** El infinitivo tal como se dice: con `se` solo si es pronominal de verdad.
 *  "ir (present subjunctive)" sobre `se vaya` nombra otro verbo. */
const lema = (inf: string, rol: Rol) => (rol.tipo === "reflexivo" || rol.lemaSe ? `${inf}se` : inf);

export function bloqueES(
  w: string, oracion: string, variante: string,
  idxSubj: Map<string, { inf: string; i: number }>,
  idxPas: Map<string, { inf: string; i: number }>,
  idxCond: Map<string, { inf: string; i: number }>,
  infinitivos: Set<string>,
  P: string[],
  pronominales: Set<string> = new Set(),
  glosa = ""
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
    const rol = rolClitico(oracion, w, cl, sp.inf, sp.i, tabla, pronominales, glosa);
    const pre = delante(cl, rol);
    return {
      mood: "Subjunctive", kind: "expand", link: "See subjunctive",
      lemma: lema(sp.inf, rol),
      head: [["present", `${pre}${ind[rol.persona]}`], ["subjunctive", `${pre}${w}`]],
      rows: filasDe(aVarianteModo(tabla, variante), rol, variante).map((f, i) => [P[i], f]),
      here: rol.persona,
    };
  }

  const pa = idxPas.get(w);
  if (pa) {
    const pret = preterito(pa.inf);
    const tabla = subjuntivoPasadoES(pa.inf);
    if (!pret || !tabla) return null;
    const cl = clitico(oracion, w);
    const rol = rolClitico(oracion, w, cl, pa.inf, pa.i, tabla, pronominales, glosa);
    const pre = delante(cl, rol);
    return {
      mood: "Past subjunctive", kind: "expand", link: "See past subjunctive",
      lemma: lema(pa.inf, rol),
      head: [["preterite", `${pre}${pret[rol.persona]}`], ["past subjunctive", `${pre}${w}`]],
      rows: filasDe(aVarianteModo(tabla, variante), rol, variante).map((f, i) => [P[i], f]),
      here: rol.persona,
    };
  }

  const co = idxCond.get(w);
  if (co) {
    const ind = presente(co.inf, variante);
    const tabla = condicionalES(co.inf);
    if (!ind || !tabla) return null;
    const cl = clitico(oracion, w);
    const rol = rolClitico(oracion, w, cl, co.inf, co.i, tabla, pronominales, glosa);
    const pre = delante(cl, rol);
    return {
      mood: "Conditional", kind: "expand", link: "See conditional",
      lemma: lema(co.inf, rol),
      head: [["present", `${pre}${ind[rol.persona]}`], ["conditional", `${pre}${w}`]],
      rows: filasDe(aVarianteModo(tabla, variante), rol, variante).map((f, i) => [P[i], f]),
      here: rol.persona,
    };
  }

  const inf = Object.entries(ES_IMP_TU).find(([, f]) => f === w)?.[0];
  if (inf && infinitivos.has(inf)) {
    const cel = imperativoES(inf, variante);
    if (cel) return { mood: "Command", kind: "line", head: [], rows: cel, here: 2 };
  }
  return null;
}

function bloqueOtro(idioma: string, w: string, oracion: string): Bloque | null {
  if (idioma === "german") {
    const k = DE_K2[w];
    if (k) return {
      mood: "Konjunktiv II", kind: "expand", link: `See ${k.inf}`,
      lemma: k.inf,
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
  const tabla = idioma === "italian" ? IT_MODOS : idioma === "portuguese" ? PT_MODOS : null;
  const m = tabla?.[w];
  if (!m) return null;
  if (m.modo === "Formal command") {
    return { mood: m.modo, kind: "line", head: [], rows: m.rows, here: 0 };
  }
  const etiqueta: Record<string, string> = {
    Subjunctive: "subjunctive", "Past subjunctive": "past subjunctive", Conditional: "conditional",
  };
  return {
    mood: m.modo, kind: "expand", link: `See ${m.inf}`,
    lemma: m.inf,
    head: [[m.modo === "Past subjunctive" ? "preterite" : "present", m.ind], [etiqueta[m.modo] ?? "", w]],
    rows: m.rows, here: m.rows.findIndex((r) => r[1] === w),
  };
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
  if (!["spanish", "german", "italian", "portuguese"].includes(idioma)) {
    return { pendientes: [], idioma, capas: [] };
  }
  const capas = filas.filter((f) => f.slug !== "");
  const plana = global.glosses as Record<string, Entrada>;

  // Las historias del paquete, con su VOCAB: hace falta antes de armar el
  // indice de infinitivos (ver abajo) y despues para el texto de cada una.
  const historias = (await prismaC.journeyStory.findMany({
    where: { slug: { in: capas.map((c) => c.slug) } },
    select: {
      slug: true, title: true, text: true, vocab: true,
      journey: { select: { language: true, variant: true } },
    },
  })).filter((s) => s.journey.language === global.language && s.journey.variant === global.variant);

  const infinitivos = new Set<string>(idioma === "spanish" ? Object.keys(IRREGULARES) : []);
  const FIN = idioma === "italian" ? /(are|ere|ire)$/ : idioma === "german" ? /(en|eln|ern)$/ : /(ar|er|ir|ír)$/;
  const TOK = idioma === "italian"
    ? /\b([a-zàèéìòù]{3,}(?:are|ere|ire))(?:si)?\b/g
    : /\b([a-záéíóúñãõçü]{2,}(?:ar|er|ir|ír))(?:se|me|te|nos)?\b/g;

  // El VOCAB de la historia declara el par lema-forma (`word` es el infinitivo,
  // `surface` la forma que sale en el texto), asi que es la fuente MAS fiable
  // de infinitivos y hasta el 2026-09-08 no se miraba. Sin ella, una forma no
  // indicativa cuya definicion no nombra su infinitivo entre parentesis era
  // invisible: el usuario toco `aconsejaria` ("would advise", sin `(aconsejar)`)
  // y la tarjeta salio sin tabla de conjugacion. El lint no lo veia porque
  // reusa este mismo detector, asi que compartia el punto ciego. Eran 6 formas
  // en el catalogo español (aconsejaria, supiera, pescara, cuadremos,
  // desparramara, reemplazaran).
  for (const s of historias) {
    for (const v of ((s.vocab as Array<{ word?: unknown; type?: unknown }> | null) ?? [])) {
      if (v?.type !== "verb") continue;
      const lema = String(v?.word ?? "").trim().toLowerCase();
      if (lema && FIN.test(lema)) infinitivos.add(lema);
    }
  }

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

  // Los verbos que el paquete conoce CON `se` (irse, quedarse): es la prueba de
  // que un `me` o un `se` delante de la forma es el reflexivo y no un objeto.
  // Salen del vocab, de las claves de glosa y de los infinitivos entre
  // parentesis de las definiciones ("(quedarse)").
  const pronominales = new Set<string>();
  if (idioma === "spanish") {
    const PRON = /^\p{L}*(?:ar|er|ir|ír)se$/u;
    for (const s of historias) {
      for (const v of ((s.vocab as Array<{ word?: unknown }> | null) ?? [])) {
        const lema = String(v?.word ?? "").trim().toLowerCase();
        if (PRON.test(lema)) pronominales.add(lema);
      }
    }
    for (const fuente of [plana, ...capas.map((c) => c.glosses as Record<string, Entrada>)]) {
      for (const k of Object.keys(fuente)) if (PRON.test(k)) pronominales.add(k);
    }
    for (const x of infinitivos) if (PRON.test(x)) pronominales.add(x);
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

  const textos = new Map<string, string>();
  for (const s of historias) textos.set(s.slug, `${s.title}. ${s.text}`);

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
      if (indicativo.has(w) || AMBIGUAS.has(w) || SIN_BLOQUE.has(w)) continue;
      const oracion = oracionDe(texto, e.c?.es ?? "", w);
      const b = idioma === "spanish"
        ? bloqueES(w, oracion, variante, idxSubj, idxPas, idxCond, infinitivos, P, pronominales,
            `${capa[w]?.g ?? ""} ${plana[w]?.g ?? ""}`)
        : bloqueOtro(idioma, w, oracion);
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
    if (!["spanish", "german", "italian", "portuguese"].includes(r.idioma)) {
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
