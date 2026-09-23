/**
 * Gate de distractores: un ejercicio de opcion multiple no se puede acertar
 * SIN SABER la palabra. Modulo puro; lo llaman `_validateSets.ts` (al escribir
 * un set curado, y desde ahi `_seedAllSets.ts`, que no siembra si falla) y
 * `checkDistractors.ts` (lint sobre lo que ya esta en la base).
 *
 * Cada regla nace de una fuga medida el 2026-09-21 sobre los 11.127 ejercicios
 * de los journeys live (`scripts/_auditDistractorLeaks.ts`):
 *
 *   D1 relleno    glosas rellenadas ("today today today"), opcion vacia u
 *                 opcion igual a la palabra ensenada.
 *   D2 estilo     la respuesta es la UNICA opcion con mayuscula inicial, punto
 *                 final, parentesis, punto y coma o particula inicial distinta
 *                 ("To defend; to argue..." entre "a perfume", "crunchy").
 *                 En tres journeys era asi en 200 de 203 tarjetas.
 *   D3 longitud   la respuesta dobla en palabras a todos los distractores
 *                 ("the fenced track where riders chase the bull" / "a horse
 *                 stable"): 678 tarjetas, la mas larga era la buena.
 *   D4 antonimo   exactamente un par de antonimos entre las cuatro opciones y
 *                 la respuesta esta en el: el alumno queda a 50% sin leer
 *                 (peor/mejor/igual/raro). Compara por TOKEN y en los dos
 *                 lados, asi que ve los pares de varias palabras ("me too" /
 *                 "not me", "papel cae" / "costo sube"), y mira tambien las
 *                 opciones en el idioma meta, no solo las glosas inglesas.
 *   D5 pista      gentilicio, ciudad o "(slang)" en UNA sola opcion ("a sweet
 *                 strong Chilean drink" en el journey de Chile).
 *   D6 forma      fill_blank: infinitivo mezclado con formas conjugadas
 *                 (disparar / guardaba / escondia), y genero o numero que no
 *                 casa con el determinante que precede al hueco ("mucha" +
 *                 lluvia / viento / sol / polvo). El genero se lee del CORPUS,
 *                 no de la desinencia (feedback_practice_distractors_must_agree);
 *                 la desinencia solo cuando la palabra nunca lleva articulo.
 *   D7 en frase   fill_blank y listen: un distractor aparece literal en la
 *                 propia oracion ("Le billet d'Olivier ... _____" con `billet`
 *                 de opcion).
 *   D8 silabas    listen_choose: un distractor con mas de una silaba de
 *                 diferencia no se confunde al oido (cajon / sinfonia).
 *
 * Lo que NO mide, y hay que leer: que un distractor tambien encaje en el
 * hueco por sentido ("Alle klatschen und _____": pfeifen, singen y tanzen
 * valen las tres). Un gate verde no es un set bueno.
 *
 * Aviso (no bloquea): W1 cognado, la respuesta se parece a la palabra y ningun
 * distractor se le parece (provavelmente: probably / certainly / never).
 */

export type GateCtx = {
  /** "spanish" | "french" | "german" | "italian" | "portuguese" | ... */
  language: string;
  /** Cuerpos de las historias del journey, concatenados. Vota genero y numero. */
  corpus?: string;
};

export type GateResult = { issues: string[]; warnings: string[] };

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const words = (s: string) => (s || "").trim().split(/\s+/).filter(Boolean);

// ── D2 estilo ───────────────────────────────────────────────────────
const PARTICLES = /^(to|a|an|the)$/i;
function styleSig(o: string): string {
  const t = o.trim();
  const first = words(t)[0] ?? "";
  const particle = PARTICLES.test(first) ? first.toLowerCase().replace(/^an$/, "a") : "-";
  return [
    /^[A-Z]/.test(t) && !/^I\b/.test(t) ? "U" : "l",
    /[.]$/.test(t) ? "." : "",
    /;/.test(t) ? ";" : "",
    /[()]/.test(t) ? "()" : "",
    particle,
  ].join("|");
}

// -- D4 antonimos ----------------------------------------------------
// Un par de opuestos entre las cuatro opciones se resuelve sin saber la
// palabra: el alumno reconoce la pareja y descarta las otras dos.
//
// Hasta el 2026-09-24 la comparacion era de CADENA COMPLETA contra una lista
// inglesa, asi que solo veia pares de UNA palabra. Lo que se escapaba, medido
// a mano despues de que el gate saliera en verde:
//   - "me too" / "not me" (Conversations ES latam A0): mismo nucleo con la
//     polaridad cambiada.
//   - "papel cae" / "costo sube", "mirada suave" / "voz fuerte",
//     "guarda vuelto" / "pide plata" (Friends ES Colombia A0): el par vive en
//     las opciones EN ESPANOL de un fill_blank, que D4 ni miraba.
// Ahora compara por TOKEN, y corre tambien sobre las opciones en el idioma
// meta, no solo sobre las glosas inglesas.
//
// Tres frenos contra el ruido, porque un gate que canta de mas se ignora:
//   a) las dos opciones tienen que ser cortas (4 palabras de contenido como
//      mucho). En una definicion larga ("a hand held flat and open") un
//      opuesto suelto no hace pareja.
//   b) si UNA opcion lleva los dos lados del par, es una definicion por
//      contraste ("right, not wrong", "hot to the touch, not cold at all") y
//      no cuenta.
//   c) un opuesto negado en su propia opcion ("not cold") no cuenta.
// Y se conserva el filtro de siempre: solo salta con EXACTAMENTE un par entre
// las cuatro y la respuesta dentro de el.
const ANTONYMS: Array<[string, string]> = [
  ["good", "bad"], ["better", "worse"], ["best", "worst"], ["big", "small"], ["large", "small"],
  ["wet", "dry"], ["hot", "cold"], ["warm", "cold"], ["open", "closed"], ["open", "close"],
  ["opening", "closing"], ["on", "off"], ["up", "down"], ["asleep", "awake"], ["in", "out"],
  ["inside", "outside"], ["early", "late"], ["near", "far"], ["close", "far"], ["closer", "further"],
  ["closer", "farther"], ["more", "less"], ["fast", "slow"], ["quick", "slow"], ["empty", "full"],
  ["new", "old"], ["young", "old"], ["right", "wrong"], ["happy", "sad"], ["first", "last"],
  ["begin", "end"], ["start", "finish"], ["buy", "sell"], ["give", "take"], ["come", "go"],
  ["remember", "forget"], ["win", "lose"], ["arrive", "leave"], ["day", "night"],
  ["morning", "evening"], ["always", "never"], ["get on", "get off"], ["go up", "go down"],
  ["push", "pull"], ["cheap", "expensive"], ["clean", "dirty"], ["light", "dark"], ["light", "heavy"],
  ["loud", "quiet"], ["strong", "weak"], ["rich", "poor"], ["true", "false"], ["easy", "hard"],
  ["easy", "difficult"], ["before", "after"], ["above", "below"], ["over", "under"], ["high", "low"],
  ["long", "short"], ["tall", "short"], ["wide", "narrow"], ["thick", "thin"], ["fat", "thin"],
  ["alive", "dead"], ["love", "hate"], ["laugh", "cry"], ["sit down", "stand up"], ["sit", "stand"],
  ["include", "exclude"], ["included", "excluded"], ["accept", "refuse"], ["accept", "reject"],
  ["agree", "disagree"], ["safe", "dangerous"], ["same", "different"], ["together", "apart"],
  ["hungry", "full"], ["tired", "rested"], ["sober", "drunk"], ["probably", "certainly"],
  ["stuck", "loose"], ["found", "lost"], ["remembered", "forgot"], ["won", "lost"],
  ["earlier", "later"], ["still", "already"], ["few", "many"], ["little", "much"],
  ["midday", "midnight"], ["noon", "midnight"], ["dawn", "dusk"], ["north", "south"], ["east", "west"],
  ["left", "right"], ["top", "bottom"], ["front", "back"], ["yes", "no"], ["male", "female"],
  ["gained", "lost"], ["gain", "lose"], ["borrow", "lend"], ["forbid", "allow"], ["forbidden", "allowed"],
  // Pronombres y cuantificadores: el par se lee sin saber la palabra igual
  // que "always" / "never", y varios son de dos piezas ("no one").
  ["everyone", "no one"], ["everyone", "nobody"], ["everybody", "nobody"], ["someone", "no one"],
  ["someone", "nobody"], ["somebody", "nobody"], ["something", "nothing"], ["everything", "nothing"],
  ["somewhere", "nowhere"], ["everywhere", "nowhere"], ["all", "none"], ["also", "either"],
];

// Pares en el idioma META, para las opciones que NO son glosas inglesas
// (fill_blank y listen_choose). Cada lado lista las formas de superficie que
// salen en el nivel que escribimos; generar formas a ciegas daba mas ruido
// que cobertura. Solo espanol por ahora: los tres casos medidos son de ahi,
// y una lista a medias en otro idioma seria peor que ninguna.
const adj = (m: string) => (/o$/.test(m) ? [m, m.replace(/o$/, "a"), m + "s", m.replace(/o$/, "as")] : [m, m + "s"]);
const ES_ANTONYMS: Array<[string[], string[]]> = [
  [["sube", "suben", "subir", "subio"], ["baja", "bajan", "bajar"]],
  [["sube", "suben", "subir", "subio"], ["cae", "caen", "caer", "cayo"]],
  [["entra", "entran", "entrar"], ["sale", "salen", "salir"]],
  [["abre", "abren", "abrir"], ["cierra", "cierran", "cerrar"]],
  [["llega", "llegan", "llegar"], ["sale", "salen", "salir"]],
  [["compra", "compran", "comprar"], ["vende", "venden", "vender"]],
  [["empieza", "empiezan", "empezar"], ["termina", "terminan", "terminar"]],
  [["gana", "ganan", "ganar"], ["pierde", "pierden", "perder"]],
  [["prende", "prenden", "prender", "enciende", "encender"], ["apaga", "apagan", "apagar"]],
  [["pone", "ponen", "poner"], ["quita", "quitan", "quitar"]],
  [["recuerda", "recuerdan", "recordar"], ["olvida", "olvidan", "olvidar"]],
  [["rie", "rien", "reir"], ["llora", "lloran", "llorar"]],
  [["duerme", "duermen", "dormir"], ["despierta", "despiertan", "despertar"]],
  [["habla", "hablan", "hablar"], ["calla", "callan", "callar"]],
  [["da", "dan", "dar", "guarda", "guardan", "guardar"], ["pide", "piden", "pedir"]],
  [["suave", "suaves"], ["fuerte", "fuertes"]],
  [["grande", "grandes"], ["pequeno", "pequena", "pequenos", "pequenas", "chico", "chica", "chicos", "chicas"]],
  [adj("alto"), ["bajo", "baja", "bajos", "bajas"]],
  [adj("largo"), adj("corto")],
  [adj("nuevo"), adj("viejo")],
  [adj("limpio"), adj("sucio")],
  [adj("frio"), adj("caliente")],
  [adj("seco"), adj("mojado")],
  [adj("lleno"), adj("vacio")],
  [adj("rapido"), adj("lento")],
  [adj("caro"), adj("barato")],
  [adj("bueno"), adj("malo")],
  [["facil", "faciles"], ["dificil", "dificiles"]],
  [adj("claro"), adj("oscuro")],
  [adj("primero"), adj("ultimo")],
  [adj("abierto"), adj("cerrado")],
  [adj("mucho"), adj("poco")],
  [["mas"], ["menos"]],
  [["antes"], ["despues"]],
  [["arriba"], ["abajo"]],
  [["dentro", "adentro"], ["fuera", "afuera"]],
  [["cerca"], ["lejos"]],
  [["encima"], ["debajo"]],
  [["delante", "enfrente"], ["detras", "atras"]],
  [["izquierda"], ["derecha"]],
  [["siempre"], ["nunca", "jamas"]],
  [["todo", "toda", "todos", "todas"], ["nada"]],
  [["alguien"], ["nadie"]],
  [["algo"], ["nada"]],
  [["tambien"], ["tampoco"]],
  [["dia", "dias"], ["noche", "noches"]],
  [["verdad"], ["mentira"]],
  [["joven", "jovenes"], ["viejo", "vieja", "viejos", "viejas"]],
];

const STOP = new Set([
  "a", "an", "the", "to", "of", "and", "is", "are", "was", "were", "be", "it", "its", "that", "this",
  "there", "very", "his", "her", "their", "for", "at", "by", "with", "from", "one",
  "el", "la", "lo", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "y", "o", "que",
  "es", "son", "muy", "se", "su", "sus", "mi", "tu", "por", "para", "en", "con",
]);
const NEG: Record<string, Set<string>> = {
  en: new Set(["not", "no", "never", "nor", "neither", "without", "nothing", "nobody", "none", "cannot"]),
  es: new Set(["no", "nunca", "jamas", "nada", "nadie", "ningun", "ninguna", "ninguno", "sin", "tampoco"]),
};
// Particulas de polaridad AFIRMATIVA: no son contenido, marcan el lado
// positivo del par ("me too" frente a "not me").
const AFF: Record<string, Set<string>> = {
  en: new Set(["too", "also", "either"]),
  es: new Set(["tambien", "tampoco"]),
};
const tokenize = (s: string) => norm(s).replace(/[^\p{L}\p{N}'\s]/gu, " ").split(/\s+/).filter(Boolean);
const contentTokens = (t: string[]) => t.filter((w) => !STOP.has(w));

/** Idioma de las OPCIONES: "en" para las glosas, el del journey para el resto. */
function esFlavour(lang: string): "es" | null {
  return /^(spanish|espanol|es)$/.test(lang) ? "es" : null;
}

type Side = { raw: string[]; content: string[]; set: Set<string>; neg: boolean; core: string[] };
function side(o: string, key: "en" | "es"): Side {
  const raw = tokenize(o);
  const content = contentTokens(raw);
  const neg = raw.some((w) => NEG[key].has(w));
  const core = content.filter((w) => !NEG[key].has(w) && !AFF[key].has(w));
  return { raw, content, set: new Set(content), neg, core };
}

const glossHead = (o: string) => norm(o).replace(/^(to|a|an|the)\s+/, "").replace(/[.,;!?]+$/, "");
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.length > 0 && a.every((w) => b.includes(w));

/** Un lado del par aparece en la opcion, sin negar y sin que el otro lado
 *  este tambien en ella (definicion por contraste). */
function carries(s: Side, mine: string[], other: string[], key: "en" | "es"): boolean {
  if (other.some((w) => s.set.has(w))) return false;
  return mine.some((w) => {
    const i = s.raw.indexOf(w);
    if (i < 0) return false;
    return !(i > 0 && NEG[key].has(s.raw[i - 1]));
  });
}

const MAX_TOKENS = 4; // ver freno (a)

function isAntonymPair(a: Side, b: Side, rawA: string, rawB: string, key: "en" | "es"): boolean {
  // 1. Cadena completa contra la lista inglesa (lo de siempre; cubre las
  //    entradas de dos piezas: "get on" / "get off").
  if (key === "en") {
    const ha = glossHead(rawA), hb = glossHead(rawB);
    if (ANTONYMS.some(([x, y]) => (ha === x && hb === y) || (ha === y && hb === x))) return true;
  }
  if (a.content.length > MAX_TOKENS || b.content.length > MAX_TOKENS) return false;
  // 2. Mismo nucleo con la polaridad cambiada ("me too" / "not me").
  if (a.neg !== b.neg && sameSet(a.core, b.core)) return true;
  // 3. Un opuesto a cada lado ("papel cae" / "costo sube"). SOLO en el idioma
  //    meta. En las glosas inglesas se probo y se retiro: marcaba 472
  //    ejercicios del catalogo, casi todos PARES PARALELOS, que este proyecto
  //    ya juzgo buen diseno de distractor el 2026-09-20 ("to turn on" / "to
  //    turn off", "at the first try" / "at the last minute", "out loud" / "in
  //    a hurry"). Las direccionales (in/out, up/down, on/off) aparecen en
  //    media glosa inglesa y no hacen pareja por si solas; en el idioma meta
  //    el par es la opcion entera y se lee de un vistazo.
  if (key !== "es") return false;
  return ES_ANTONYMS.some(([x, y]) => (carries(a, x, y, key) && carries(b, y, x, key)) || (carries(a, y, x, key) && carries(b, x, y, key)));
}

function antonymPairs(opts: string[], key: "en" | "es"): Array<[number, number]> {
  const sides = opts.map((o) => side(o, key));
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < opts.length; i++)
    for (let j = i + 1; j < opts.length; j++)
      if (isAntonymPair(sides[i], sides[j], opts[i], opts[j], key)) pairs.push([i, j]);
  return pairs;
}

// ── D5 pista ────────────────────────────────────────────────────────
const HINT = /\b(mexican|chilean|argentin(e|ian)|colombian|peruvian|spanish|spain|brazilian|brazil|portuguese|french|france|german|germany|italian|italy|uruguayan|cuban|venezuelan|andalusian|catalan|bavarian|salamanca|madrid|barcelona|lisbon|rio|paris|berlin|rome|bogot[aá]|lima|santiago|buenos aires|mexico|slang|usage|dialect|colloquial|regional)\b/i;

// ── D6 forma ────────────────────────────────────────────────────────
const INFINITIVE: Record<string, RegExp> = {
  spanish: /(ar|er|ir|arse|erse|irse)$/,
  portuguese: /(ar|er|ir|por)$/, // -por: compor, propor; la preposicion 'por' se excluye abajo
  italian: /(are|ere|ire|arsi|ersi|irsi)$/,
  // Frances sin -re: ouvre, entre, prefere y montre son formas conjugadas.
  french: /(er|ir|oir)$/,
  // Aleman fuera a proposito: -en es infinitivo, participio fuerte
  // (geschlafen), adjetivo plural (neuen) y dativo a la vez, asi que la
  // regla solo daba ruido (16 falsos de 16 en el Friends C1).
};
// Excepciones frecuentes que terminan como infinitivo sin serlo (formas
// conjugadas o nombres). Lista corta a proposito: lo que importa es el cruce
// infinitivo / conjugado en el MISMO set, y ahi el error es visible.
const NOT_INF: Record<string, RegExp> = {
  spanish: /^(ayer|mujer|lugar|mar|azucar|bar|par|hogar|taller|quehacer|familiar|regular|popular|escolar|similar|particular|singular|vulgar|solar|polar|lunar|celular|militar|espectacular|circular|titular|ejemplar|pilar|collar|altar|azar|bienestar|malestar|hangar|nectar|caviar|dolar|cesar|alcazar|hogar|papel|hotel|cualquier|mejor|peor|mayor|menor|alrededor|calor|color|dolor|flor|senor|senora|amor|sabor|olor)$/,
  portuguese: /^(mulher|lugar|mar|acucar|bar|par|lar|melhor|apesar|devagar|familiar|regular|popular|escolar|similar|particular|singular|vulgar|solar|polar|lunar|celular|militar|espetacular|circular|titular|exemplar|pilar|colar|altar|azar|bem-estar|pomar|luar|paladar|pior|maior|menor|calor|cor|dor|flor|senhor|amor|sabor)$/,
  italian: /^(mare|pane|cane|sale|sole|fiore|nome|cuore|madre|padre|notte|arte|parte|gente|mese|paese|piede|pesce|carne|latte|mente|volte|forse|sempre|mentre|oltre|altre|molte|tante|quante|poche|dolce|verde|grande|forte|felice|semplice|difficile|facile|giovane|insieme|niente|lontane|vicine|tre|re|sere|ore|sedie|frontiere|pere|mele|cellulare|bicchiere|mestiere|quartiere|cameriere|pensiere|sentiere|genere|carattere|particolare|regolare|popolare|familiare|scolare|militare|solare|polare|esemplare|singolare|circolare|spettacolare|elementare|nucleare|lineare|volgare|auricolare|esercitazione|cellulari|bicchieri|lettere|camere|opere|torre|terre|nere|vere|intere|povere|misere|libere)$/,
  french: /^(hier|cher|fier|mer|fer|hiver|cahier|papier|quartier|premier|dernier|entier|calendrier|escalier|panier|clavier|pompier|boulanger|fermier|policier|ouvrier|infirmier|cuisinier|janvier|fevrier|dossier|courrier|metier|rocher|verger|potager|atelier|chantier|sentier|pommier|cerisier|oranger|rosier|olivier|collier|soulier|tablier|oreiller|palier|passager|etranger|leger|amer|plaisir|loisir|avenir|souvenir|soir|noir|bonsoir|espoir|devoir|pouvoir|savoir|vouloir|voir|miroir|mouchoir|couloir|trottoir|livre|libre|propre|pauvre|autre|notre|votre|quatre|entre|contre|arbre|ombre|nombre|chambre|septembre|octobre|novembre|decembre|lettre|fenetre|maitre|ventre|centre|theatre|ordre|cadre|verre|terre|guerre|pierre|mere|pere|frere|derriere|premiere|derniere|lumiere|riviere|maniere|matiere|colere|biere|carriere|frontiere|sur|pour|jour|tour|amour|toujours|bonjour|leur|coeur|soeur|fleur|couleur|heure|peur|meilleur)$/,
};
// Verbo y sustantivo a la vez (al amanecer / van a amanecer): no se juzgan, y
// la regla de formas mezcladas se salta cuando aparece uno.
const AMBIG_INF: Record<string, RegExp> = {
  spanish: /^(amanecer|anochecer|atardecer|poder|deber|placer|parecer|haber|querer|pesar|andar|cantar|saber|sentir)$/,
  portuguese: /^(amanhecer|anoitecer|entardecer|poder|dever|prazer|parecer|saber|jantar|almocar|andar|olhar|jogar)$/,
  italian: /^(potere|dovere|piacere|sapere|essere|avere|parere|dispiacere)$/,
  french: /^(pouvoir|devoir|savoir|avoir|plaisir|souvenir|loisir|diner|dejeuner|gouter|baiser|rire|sourire|devenir)$/,
};
function isInfinitive(w: string, lang: string): boolean | null {
  const re = INFINITIVE[lang];
  if (!re) return null;
  if (AMBIG_INF[lang]?.test(norm(w).split(/\s+/)[0] ?? "")) return null;
  // Frances -re: vendre y lire son infinitivos, ouvre y entre no; sin lexico
  // no se distingue, asi que no se juzga y la regla se salta en ese set.
  if (lang === "french" && /re$/.test(norm(w).split(/\s+/)[0] ?? "")) return null;
  let t = norm(w).split(/\s+/)[0] ?? "";
  // Encliticos (cobrarla, vestirse, dar-lhe): se quitan para mirar la desinencia.
  if (/^(spanish|portuguese)$/.test(lang)) {
    // Sin -te ni -me: fuerte, muerte, parte, advierte no llevan clitico y
    // caian como infinitivo ("advier" + "te"). Un "ayudarte" entre infinitivos
    // se escribe como "ayudar".
    // Y solo con raiz de 5+ letras (o dar/ver/ser/ir): "charla" y "perla" no
    // son "char" + "la" ni "per" + "la".
    const m = /^(.+?(?:ar|er|ir))(se|nos|lo|la|los|las|le|les|lhe|lhes)$/.exec(t);
    if (m && (m[1].length >= 5 || /^(dar|ver|ser|ir|oir)$/.test(m[1]))) t = m[1];
  }
  // Cortos que SI son infinitivo (dar, ser, ver, ir); el resto de 3 letras no.
  if (t === "ir") return true;
  if (t === "por") return false;
  if (!t || t.length < 3) return false;
  if (NOT_INF[lang]?.test(t)) return false;
  return re.test(t);
}

type GN = { g: "m" | "f" | "n" | null; n: "s" | "p" | null };
// Determinantes que fijan genero y/o numero. `null` = no fija.
const DETS: Record<string, Record<string, GN>> = {
  spanish: {
    el: { g: "m", n: "s" }, la: { g: "f", n: "s" }, los: { g: "m", n: "p" }, las: { g: "f", n: "p" },
    un: { g: "m", n: "s" }, una: { g: "f", n: "s" }, unos: { g: "m", n: "p" }, unas: { g: "f", n: "p" },
    este: { g: "m", n: "s" }, esta: { g: "f", n: "s" }, estos: { g: "m", n: "p" }, estas: { g: "f", n: "p" },
    ese: { g: "m", n: "s" }, esa: { g: "f", n: "s" }, esos: { g: "m", n: "p" }, esas: { g: "f", n: "p" },
    mucho: { g: "m", n: "s" }, mucha: { g: "f", n: "s" }, muchos: { g: "m", n: "p" }, muchas: { g: "f", n: "p" },
    poco: { g: "m", n: "s" }, poca: { g: "f", n: "s" }, pocos: { g: "m", n: "p" }, pocas: { g: "f", n: "p" },
    otro: { g: "m", n: "s" }, otra: { g: "f", n: "s" }, otros: { g: "m", n: "p" }, otras: { g: "f", n: "p" },
    todo: { g: "m", n: "s" }, toda: { g: "f", n: "s" }, todos: { g: "m", n: "p" }, todas: { g: "f", n: "p" },
    ningun: { g: "m", n: "s" }, ninguna: { g: "f", n: "s" }, algun: { g: "m", n: "s" }, alguna: { g: "f", n: "s" },
    mis: { g: null, n: "p" }, tus: { g: null, n: "p" }, sus: { g: null, n: "p" }, dos: { g: null, n: "p" }, tres: { g: null, n: "p" },
    del: { g: "m", n: "s" }, al: { g: "m", n: "s" },
  },
  portuguese: {
    o: { g: "m", n: "s" }, a: { g: "f", n: "s" }, os: { g: "m", n: "p" }, as: { g: "f", n: "p" },
    um: { g: "m", n: "s" }, uma: { g: "f", n: "s" }, uns: { g: "m", n: "p" }, umas: { g: "f", n: "p" },
    do: { g: "m", n: "s" }, da: { g: "f", n: "s" }, dos: { g: "m", n: "p" }, das: { g: "f", n: "p" },
    no: { g: "m", n: "s" }, na: { g: "f", n: "s" }, nos: { g: "m", n: "p" }, nas: { g: "f", n: "p" },
    ao: { g: "m", n: "s" }, aos: { g: "m", n: "p" }, pelo: { g: "m", n: "s" }, pela: { g: "f", n: "s" },
    este: { g: "m", n: "s" }, esta: { g: "f", n: "s" }, esse: { g: "m", n: "s" }, essa: { g: "f", n: "s" },
    outro: { g: "m", n: "s" }, outra: { g: "f", n: "s" }, todo: { g: "m", n: "s" }, toda: { g: "f", n: "s" },
    nenhum: { g: "m", n: "s" }, nenhuma: { g: "f", n: "s" }, algum: { g: "m", n: "s" }, alguma: { g: "f", n: "s" },
  },
  italian: {
    il: { g: "m", n: "s" }, lo: { g: "m", n: "s" }, la: { g: "f", n: "s" }, i: { g: "m", n: "p" }, gli: { g: "m", n: "p" }, le: { g: "f", n: "p" },
    un: { g: "m", n: "s" }, uno: { g: "m", n: "s" }, una: { g: "f", n: "s" },
    del: { g: "m", n: "s" }, dello: { g: "m", n: "s" }, della: { g: "f", n: "s" }, dei: { g: "m", n: "p" }, degli: { g: "m", n: "p" }, delle: { g: "f", n: "p" },
    al: { g: "m", n: "s" }, allo: { g: "m", n: "s" }, alla: { g: "f", n: "s" }, ai: { g: "m", n: "p" }, agli: { g: "m", n: "p" }, alle: { g: "f", n: "p" },
    nel: { g: "m", n: "s" }, nello: { g: "m", n: "s" }, nella: { g: "f", n: "s" }, nei: { g: "m", n: "p" }, negli: { g: "m", n: "p" }, nelle: { g: "f", n: "p" },
    sul: { g: "m", n: "s" }, sullo: { g: "m", n: "s" }, sulla: { g: "f", n: "s" }, sui: { g: "m", n: "p" }, sugli: { g: "m", n: "p" }, sulle: { g: "f", n: "p" },
    dal: { g: "m", n: "s" }, dalla: { g: "f", n: "s" }, dai: { g: "m", n: "p" }, dalle: { g: "f", n: "p" },
    questo: { g: "m", n: "s" }, questa: { g: "f", n: "s" }, questi: { g: "m", n: "p" }, queste: { g: "f", n: "p" },
    quello: { g: "m", n: "s" }, quella: { g: "f", n: "s" }, quelli: { g: "m", n: "p" }, quelle: { g: "f", n: "p" },
    poco: { g: "m", n: "s" }, poca: { g: "f", n: "s" }, pochi: { g: "m", n: "p" }, poche: { g: "f", n: "p" },
    tutto: { g: "m", n: "s" }, tutta: { g: "f", n: "s" }, tutti: { g: "m", n: "p" }, tutte: { g: "f", n: "p" },
    nessun: { g: "m", n: "s" }, nessuna: { g: "f", n: "s" }, qualche: { g: null, n: "s" },
  },
  french: {
    le: { g: "m", n: "s" }, la: { g: "f", n: "s" }, les: { g: null, n: "p" },
    un: { g: "m", n: "s" }, une: { g: "f", n: "s" }, des: { g: null, n: "p" },
    du: { g: "m", n: "s" }, au: { g: "m", n: "s" }, aux: { g: null, n: "p" },
    ce: { g: "m", n: "s" }, cet: { g: "m", n: "s" }, cette: { g: "f", n: "s" }, ces: { g: null, n: "p" },
    mon: { g: "m", n: "s" }, ma: { g: "f", n: "s" }, mes: { g: null, n: "p" },
    ton: { g: "m", n: "s" }, ta: { g: "f", n: "s" }, tes: { g: null, n: "p" },
    son: { g: "m", n: "s" }, sa: { g: "f", n: "s" }, ses: { g: null, n: "p" },
    notre: { g: null, n: "s" }, votre: { g: null, n: "s" }, nos: { g: null, n: "p" }, vos: { g: null, n: "p" }, leurs: { g: null, n: "p" },
    quel: { g: "m", n: "s" }, quelle: { g: "f", n: "s" }, quels: { g: "m", n: "p" }, quelles: { g: "f", n: "p" },
    tout: { g: "m", n: "s" }, toute: { g: "f", n: "s" }, tous: { g: "m", n: "p" }, toutes: { g: "f", n: "p" },
    aucun: { g: "m", n: "s" }, aucune: { g: "f", n: "s" }, chaque: { g: null, n: "s" }, plusieurs: { g: null, n: "p" },
  },
  german: {
    // Nominativo y acusativo, que es donde cae casi todo hueco de sustantivo.
    // `der`, `die`, `das` no fijan solos (der = m nom, pero tambien f dat/gen;
    // die = f sg y pl): solo los inequivocos.
    das: { g: "n", n: "s" }, ein: { g: null, n: "s" }, eine: { g: "f", n: "s" }, einen: { g: "m", n: "s" },
    keinen: { g: "m", n: "s" }, den: { g: "m", n: "s" },
    meinen: { g: "m", n: "s" }, deinen: { g: "m", n: "s" }, seinen: { g: "m", n: "s" }, ihren: { g: "m", n: "s" },
    viele: { g: null, n: "p" }, alle: { g: null, n: "p" }, zwei: { g: null, n: "p" }, drei: { g: null, n: "p" },
  },
};
const CORPUS_ARTICLES: Record<string, string[]> = {
  spanish: ["el", "la", "los", "las", "un", "una", "unos", "unas", "del", "al", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "mucho", "mucha", "muchos", "muchas", "otro", "otra", "otros", "otras", "todo", "toda", "todos", "todas"],
  portuguese: ["o", "a", "os", "as", "um", "uma", "uns", "umas", "do", "da", "dos", "das", "no", "na", "nos", "nas", "ao", "aos", "pelo", "pela", "este", "esta", "esse", "essa", "outro", "outra", "todo", "toda"],
  italian: ["il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "del", "dello", "della", "dei", "degli", "delle", "al", "allo", "alla", "ai", "agli", "alle", "nel", "nello", "nella", "nei", "negli", "nelle", "sul", "sullo", "sulla", "sui", "sugli", "sulle", "dal", "dalla", "dai", "dalle", "questo", "questa", "questi", "queste", "quello", "quella", "quelli", "quelle", "tutto", "tutta", "tutti", "tutte"],
  french: ["le", "la", "les", "un", "une", "des", "du", "au", "aux", "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "quel", "quelle", "quels", "quelles", "tout", "toute", "tous", "toutes", "aucun", "aucune"],
  german: ["das", "eine", "einen", "keinen", "den", "meinen", "deinen", "seinen", "ihren", "viele", "alle"],
};

// Determinantes que NO son homografos de un clitico: `la entrega` puede ser
// "la" + sustantivo o "la" + verbo, pero `una entrega` solo es sustantivo.
// Deciden si la palabra es un sustantivo; los votos de genero luego cuentan
// con todos.
const NOUN_EVIDENCE: Record<string, string[]> = {
  spanish: ["el", "un", "una", "unos", "unas", "del", "al", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "mucho", "mucha", "muchos", "muchas", "otro", "otra", "otros", "otras", "todo", "toda", "todos", "todas"],
  portuguese: ["um", "uma", "uns", "umas", "do", "da", "dos", "das", "no", "na", "nos", "nas", "ao", "aos", "pelo", "pela", "este", "esta", "esse", "essa", "outro", "outra", "todo", "toda"],
  italian: ["il", "i", "gli", "un", "uno", "una", "del", "dello", "della", "dei", "degli", "delle", "al", "allo", "alla", "ai", "agli", "alle", "nel", "nello", "nella", "nei", "negli", "nelle", "sul", "sullo", "sulla", "sui", "sugli", "sulle", "dal", "dalla", "dai", "dalle", "questo", "questa", "questi", "queste", "quello", "quella", "quelli", "quelle", "tutto", "tutta", "tutti", "tutte"],
  french: ["un", "une", "des", "du", "au", "aux", "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "quel", "quelle", "quels", "quelles", "tout", "toute", "tous", "toutes", "aucun", "aucune"],
  german: ["das", "eine", "einen", "keinen", "den", "meinen", "deinen", "seinen", "ihren", "viele", "alle"],
};

// Minusculas y NFC, CON acentos: `el` es articulo y `el` con acento es
// pronombre; quitarlos hacia sustantivo a cualquier verbo tras "el".
const low = (s: string) => (s || "").toLowerCase().normalize("NFC").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Genero y numero de `word` leidos del corpus: cada aparicion precedida de un
 * determinante vota. Devuelve null cuando la palabra nunca aparece tras un
 * determinante que no pueda ser clitico (es decir, cuando no hay prueba de
 * que sea sustantivo).
 */
export function genderFromCorpus(word: string, corpus: string, lang: string): GN | null {
  const dets = DETS[lang];
  const arts = CORPUS_ARTICLES[lang];
  const evidence = NOUN_EVIDENCE[lang];
  if (!dets || !arts || !evidence || !corpus) return null;
  const w = low(word).replace(/[.,;!?]+$/, "");
  if (!w) return null;
  const text = low(corpus);
  const nounRe = new RegExp(`(?<![\\p{L}])(${evidence.join("|")})\\s+${escapeRe(w)}(?![\\p{L}])`, "u");
  if (!nounRe.test(text)) return null;
  const re = new RegExp(`(?<![\\p{L}])(${arts.join("|")})\\s+${escapeRe(w)}(?![\\p{L}])`, "gu");
  const votes: Record<string, number> = {};
  for (const m of text.matchAll(re)) {
    const d = dets[m[1]];
    if (!d) continue;
    const key = `${d.g ?? "?"}${d.n ?? "?"}`;
    votes[key] = (votes[key] ?? 0) + 1;
  }
  const keys = Object.keys(votes);
  if (!keys.length) return null;
  // agua, hambre, aula...: llevan "el/un" por la a- tonica y siguen siendo
  // femeninas; el voto masculino de esos articulos no cuenta.
  if (lang === "spanish" && FEM_EL_ES.has(w)) return { g: "f", n: keys.some((k) => k[1] === "p") && !keys.some((k) => k[1] === "s") ? "p" : "s" };
  const tally = (pos: 0 | 1, vals: string[]) => {
    const c = vals.map((v) => [v, keys.filter((k) => k[pos] === v).reduce((a, k) => a + votes[k], 0)] as const).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    return c.length && (c.length === 1 || c[0][1] > c[1][1]) ? c[0][0] : null;
  };
  return { g: tally(0, ["m", "f", "n"]) as GN["g"], n: tally(1, ["s", "p"]) as GN["n"] };
}

const FEM_EL_ES = new Set(["agua", "alma", "hambre", "aguila", "águila", "aula", "area", "área", "arma", "ala", "hacha", "hada", "ancla", "asma", "ave", "habla", "acta", "alba", "ama", "arca", "aya", "ansia", "asa", "aspa", "haba", "hampa", "ánfora", "anfora", "águila"]);
// Masculinos en -a (dia, problema, mapa...): la desinencia miente.
const MASC_A_ES = new Set(["dia", "día", "mediodia", "mediodía", "mapa", "problema", "programa", "sistema", "clima", "tema", "idioma", "planeta", "poema", "drama", "sofa", "sofá", "tranvia", "tranvía", "pijama", "aroma", "fantasma", "diploma", "esquema", "sintoma", "síntoma", "dilema", "panorama", "cometa", "telegrama", "diagrama", "trauma", "coma", "enigma", "lema", "teorema", "axioma", "carisma", "estigma", "dogma", "magma", "prisma", "sofa"]);

const MASC_A_PT = new Set(["dia", "mapa", "problema", "programa", "sistema", "clima", "tema", "idioma", "planeta", "poema", "drama", "sofa", "sofá", "cinema", "telefonema", "esquema", "sintoma", "dilema", "panorama", "cometa", "telegrama", "diagrama", "trauma", "coma", "enigma", "lema", "teorema", "carisma", "dogma", "fantasma", "diploma", "aroma", "pijama", "guarana", "guaraná", "samba", "grama"]);

/** Desinencia, solo para las tres lenguas donde es regular y como ultimo recurso. */
function genderFromEnding(word: string, lang: string): GN | null {
  if (!/^(spanish|portuguese|italian)$/.test(lang)) return null;
  const w = norm(word).split(/\s+/).pop() ?? "";
  if (lang === "italian") {
    if (/o$/.test(w)) return { g: "m", n: "s" };
    if (/a$/.test(w)) return { g: "f", n: "s" };
    if (/i$/.test(w)) return { g: "m", n: "p" };
    return null; // la clase -e no dice nada (memoria: gettone/mucche)
  }
  // En -s no hay desinencia fiable: plural, invariable (paraguas, crisis) o
  // lema ya plural (gafas). Sin corpus no se dice nada.
  if (/s$/.test(w)) return null;
  if (lang === "spanish" && MASC_A_ES.has(w)) return { g: "m", n: "s" };
  if (lang === "portuguese" && MASC_A_PT.has(w)) return { g: "m", n: "s" };
  // -ão portugues: canção y televisão son femeninas, coração masculino; sin corpus no se sabe.
  if (lang === "portuguese" && /(ao|ão)$/.test(w)) return null;
  if (/o$/.test(w)) return { g: "m", n: "s" };
  if (/a$/.test(w)) return { g: "f", n: "s" };
  return null;
}

function compatible(det: GN, opt: GN): boolean {
  if (det.g && opt.g && det.g !== opt.g) return false;
  if (det.n && opt.n && det.n !== opt.n) return false;
  return true;
}

// ── D8 silabas ──────────────────────────────────────────────────────
const syllables = (w: string) => (norm(w).match(/[aeiouy]+/g) ?? []).length;

// ── W1 cognado ──────────────────────────────────────────────────────
const stripArt = (s: string) => norm(s).replace(/^(el|la|los|las|le|les|l|un|une|der|die|das|il|lo|gli|i|o|a|os|as|um|uma|to|an|the)\s+/, "").replace(/^l'/, "");

/**
 * Evalua UN ejercicio (fila de la BD o objeto del JSON curado: mismos campos
 * `type`, `word`, `sentence`, `payload`).
 */
export function distractorIssues(ex: any, ctx: GateCtx): GateResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const lang = (ctx.language || "").toLowerCase();
  const p = ex?.payload ?? {};
  const type: string = ex?.type ?? "";
  const word: string = ex?.word ?? "";
  const opts: string[] = Array.isArray(p.options) ? p.options.map((o: any) => String(o ?? "")) : [];
  const answer: string = String(p.answer ?? "");
  if (!opts.length || !answer || type === "match_meaning") return { issues, warnings };
  const ai = opts.indexOf(answer);
  const dis = opts.filter((_, i) => i !== ai);
  const tag = `'${word}'`;

  // Las glosas en ingles que ve el alumno: en meaning son las opciones; en
  // fill_blank y listen, `optionTranslations` (mismo orden que options).
  const glosses: string[] | null =
    type === "meaning_in_context" ? opts
    : Array.isArray(p.optionTranslations) && p.optionTranslations.length === opts.length ? p.optionTranslations.map(String)
    : null;
  const gAns = glosses ? glosses[ai] : null;

  // D1 relleno
  for (const o of opts) {
    if (!o.trim()) issues.push(`${tag} D1 opcion vacia`);
    // La propia palabra puede repetir token ("luego luego"): solo se mira el relleno en glosas.
    if (norm(o) !== norm(word) && /\b(\w+)\s+\1\b/i.test(o)) issues.push(`${tag} D1 glosa con relleno repetido: "${o}"`);
    if (o !== answer && norm(o) === norm(word)) issues.push(`${tag} D1 distractor igual a la palabra`);
  }
  if (glosses && glosses !== opts) for (const g of glosses) if (/\b(\w+)\s+\1\b/i.test(g)) issues.push(`${tag} D1 traduccion con relleno repetido: "${g}"`);

  if (glosses && gAns != null) {
    const gDis = glosses.filter((_, i) => i !== ai);
    // D2 estilo
    const sig = styleSig(gAns);
    if (!gDis.some((d) => styleSig(d) === sig)) issues.push(`${tag} D2 la respuesta es la unica con su estilo (${sig}): "${gAns}" vs ${JSON.stringify(gDis)}`);
    // D3 longitud
    const aw = words(gAns).length;
    const dw = gDis.map((d) => words(d).length);
    const mx = Math.max(...dw), mn = Math.min(...dw);
    if (aw >= 2 * mx && aw - mx >= 3) issues.push(`${tag} D3 la respuesta dobla en palabras a todos los distractores (${aw} vs ${dw.join("/")})`);
    if (aw * 2 <= mn && mn - aw >= 3) issues.push(`${tag} D3 la respuesta es la unica corta (${aw} vs ${dw.join("/")})`);
    // D4 antonimo (glosas inglesas)
    const pairs = antonymPairs(glosses, "en");
    if (pairs.length === 1 && pairs[0].includes(ai)) issues.push(`${tag} D4 un solo par de antonimos y la respuesta esta en el: "${glosses[pairs[0][0]]}" / "${glosses[pairs[0][1]]}"`);
    // D5 pista
    const hinted = glosses.filter((g) => HINT.test(g));
    if (hinted.length === 1) issues.push(`${tag} D5 pista de lugar/registro en una sola opcion: "${hinted[0]}"`);
    // W1 cognado (solo meaning: en fill_blank la palabra no se muestra)
    if (type === "meaning_in_context") {
      const h = stripArt(word).slice(0, 4), a = stripArt(gAns).slice(0, 4);
      if (h.length === 4 && h === a && !gDis.some((d) => stripArt(d).slice(0, 3) === h.slice(0, 3)))
        warnings.push(`${tag} W1 cognado sin distractor parecido: "${gAns}" vs ${JSON.stringify(gDis)}`);
    }
  }

  if (type === "fill_blank" || type === "listen_choose") {
    // D4 antonimo en el IDIOMA META: en estos dos tipos las opciones no son
    // glosas, y ahi vivian los tres pares que el gate dejo pasar el 2026-09-24
    // ("papel cae" / "costo sube").
    const key = esFlavour(lang);
    if (key) {
      const esPairs = antonymPairs(opts, key);
      if (esPairs.length === 1 && esPairs[0].includes(ai))
        issues.push(`${tag} D4 un solo par de antonimos y la respuesta esta en el: "${opts[esPairs[0][0]]}" / "${opts[esPairs[0][1]]}"`);
    }
    // D6 forma: infinitivo mezclado con conjugado
    const inf = opts.map((o) => isInfinitive(o, lang));
    if (inf.every((x) => x !== null) && new Set(inf).size > 1) {
      const which = inf[ai] ? "la respuesta es infinitivo y hay conjugadas" : "hay infinitivos entre formas conjugadas";
      issues.push(`${tag} D6 formas mezcladas (${which}): ${opts.join(" / ")}`);
    }
  }

  if (type === "fill_blank") {
    // D6 forma: genero y numero contra el determinante que precede al hueco
    const before = norm(ex.sentence ?? "").match(/(\S+)\s+_{3,}/)?.[1]?.replace(/[^\p{L}']/gu, "") ?? "";
    const det = DETS[lang]?.[before];
    // Aleman fuera: el adjetivo tras "eine" no dice el genero del hueco y el
    // corpus vota mal ("eine runde Brille" daba neue(ns)).
    if (det && (det.g || det.n) && lang !== "german") {
      // Solo cuando la respuesta es un sustantivo segun el corpus (lleva
      // articulo alguna vez); si no, "la"/"lo" son cliticos ante un verbo.
      const ansGN = ctx.corpus ? genderFromCorpus(answer, ctx.corpus, lang) : null;
      if (ansGN) {
        const bad: string[] = [];
        for (const o of opts) {
          // "el agua", "un hambre": articulo masculino singular legitimo.
          if (lang === "spanish" && FEM_EL_ES.has(norm(o)) && /^(el|un|del|al)$/.test(before)) continue;
          const gn = (ctx.corpus ? genderFromCorpus(o, ctx.corpus, lang) : null) ?? genderFromEnding(o, lang);
          if (gn && !compatible(det, gn)) bad.push(`${o}(${gn.g ?? "?"}${gn.n ?? "?"})`);
        }
        if (bad.length) issues.push(`${tag} D6 "${before} _____" no admite: ${bad.join(", ")}`);
      }
    }
    // D7 en frase
    const sent = norm((ex.sentence ?? "").replace(/_{3,}/, " "));
    for (const d of dis) {
      const t = norm(d);
      if (t.length >= 3 && new RegExp(`(?<![\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(sent))
        issues.push(`${tag} D7 el distractor "${d}" aparece en la propia oracion`);
    }
  }

  if (type === "listen_choose") {
    // D8 silabas
    const s = syllables(answer);
    const far = dis.filter((d) => Math.abs(syllables(d) - s) > 1);
    if (far.length) issues.push(`${tag} D8 distractores que no se confunden al oido (silabas ${s} vs ${far.map((d) => `${d}:${syllables(d)}`).join(", ")})`);
    // D7 en frase (la oracion es el fragmento real; un distractor que suena en el es pista)
    const sent = norm(ex.sentence ?? "");
    for (const d of dis) if (norm(d) !== norm(answer) && new RegExp(`(?<![\\p{L}])${norm(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(sent))
      issues.push(`${tag} D7 el distractor "${d}" suena en el propio fragmento`);
  }

  return { issues, warnings };
}
