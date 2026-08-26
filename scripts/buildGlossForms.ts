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
 *   npx tsx scripts/buildGlossForms.ts <bundle.json> [--dry]
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
import fs from "node:fs";

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
};

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
  const fin = inf.slice(-2);
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
  if (PRET_Y.test(inf) && !cambio) {
    return [`${raiz}í`, `${raiz}iste`, `${raiz}yó`, `${raiz}imos`, `${raiz}isteis`, `${raiz}yeron`];
  }
  const tercera = cambio === "ri" || cambio === "sonri" ? `${r3}o` : `${r3}ió`;
  const ellos = cambio === "ri" || cambio === "sonri" ? `${r3}eron` : `${r3}ieron`;
  return [`${raiz}í`, `${raiz}iste`, tercera, `${raiz}imos`, `${raiz}isteis`, ellos];
}

/** Imperfecto. Tres irregulares en toda la lengua y ni uno mas. */
function imperfecto(inf: string): string[] | null {
  if (inf === "ser") return ["era", "eras", "era", "éramos", "erais", "eran"];
  if (inf === "ir") return ["iba", "ibas", "iba", "íbamos", "ibais", "iban"];
  if (inf === "ver") return ["veía", "veías", "veía", "veíamos", "veíais", "veían"];
  const raiz = inf.slice(0, -2);
  const fin = inf.slice(-2);
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

export type Tiempo = "presente" | "pretérito" | "imperfecto";
const TIEMPOS: Array<{ id: Tiempo; fn: (inf: string, v: string) => string[] | null }> = [
  { id: "presente", fn: (inf, v) => presente(inf, v) },
  { id: "pretérito", fn: (inf, v) => { const f = preterito(inf); return f ? aVariante(f, v) : null; } },
  { id: "imperfecto", fn: (inf, v) => { const f = imperfecto(inf); return f ? aVariante(f, v) : null; } },
];

/** Del infinitivo a las formas: sirve para saber qué palabra del texto es qué.
 *  Indexa los tres tiempos, y el primero que reclame una forma se la queda. El
 *  orden importa poco porque las formas casi no chocan entre tiempos; donde
 *  chocan (hablamos, presente y preterito) gana el presente, que es el que un
 *  hispanohablante lee por defecto. */
function indicePorForma(infinitivos: string[], variante: string) {
  const mapa = new Map<string, { inf: string; i: number; tiempo: Tiempo }>();
  for (const { id, fn } of TIEMPOS) {
    for (const inf of infinitivos) {
      const filas = fn(inf, variante);
      if (!filas) continue;
      filas.forEach((f, i) => {
        const clave = f.toLowerCase();
        if (!mapa.has(clave)) mapa.set(clave, { inf, i, tiempo: id });
      });
    }
  }
  return mapa;
}

/** La tabla del tiempo que toca, ya adaptada a la variante. */
function tablaDe(inf: string, tiempo: Tiempo, variante: string): string[] | null {
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

function main() {
  const ruta = process.argv[2];
  const dry = process.argv.includes("--dry");
  if (!ruta) {
    console.error("uso: npx tsx scripts/buildGlossForms.ts <bundle.json> [--dry]");
    process.exit(1);
  }
  const bundle = JSON.parse(fs.readFileSync(ruta, "utf8")) as Bundle;
  const variante = (bundle.variant ?? "").trim().toLowerCase();
  const P = personas(variante);

  // Los infinitivos que este bundle conoce: los que ya están glosados como
  // verbo en su forma de diccionario, más los irregulares de la tabla.
  const infinitivos = new Set<string>(Object.keys(IRREGULARES));
  for (const [k, v] of Object.entries(bundle.glosses)) {
    if (v?.t === "verb" && /(ar|er|ir)$/.test(k)) infinitivos.add(k);
    const m = /\(([a-záéíóúñ]+(?:ar|er|ir))\)/.exec(v?.g ?? "");
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
      const m = /^(.+?)(ó|aron|aba|abas|ábamos|aban|é|aste|amos|asteis)$/.exec(w);
      if (m && m[1].length >= 2) infinitivos.add(`${m[1]}ar`);
    }
  }
  const porForma = indicePorForma([...infinitivos], variante);

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

      if (base.t === "verb") {
        const hit = porForma.get(palabra);
        if (hit) {
          // El tiempo lo decide la forma que sale en la historia, no el script:
          // estas narran en pasado y una tabla de presente enseñaria otro
          // paradigma que el que el lector tiene delante.
          const filas = tablaDe(hit.inf, hit.tiempo, variante)!;
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
    `${ruta.split("/").pop()}: ${verbos} verbos conjugados, ${sustantivos} sustantivos con número, ` +
      `${adjetivos} adjetivos con concordancia, ${sinNada} sin bloque` +
      (saltadas.length ? `\n  intactas por estar escritas a mano: ${saltadas.join(", ")}` : "")
  );
  if (dry) {
    console.log("(--dry: no se ha escrito nada)");
    return;
  }
  bundle.byStory = salida;
  fs.writeFileSync(ruta, JSON.stringify(bundle, null, 1) + "\n", "utf8");
}

main();
