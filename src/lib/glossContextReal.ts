/**
 * Contexto REAL de una glosa `c`, no solo su presencia.
 *
 * `checkGlossContext.ts` comprobaba que hubiera un `c` en la fila de la
 * historia; no comprobaba que ESE `c` fuera de verdad el trozo de la
 * historia traducido. Dos capas pasaron limpias con contexto falso:
 *   - FR A1 Friends (Codex, 2026-09-13): c.es = la palabra sola, c.en = la
 *     definicion de diccionario cortada, no una frase.
 *   - FR B1 Friends (2026-09-14): c.en = la glosa `g` de la palabra
 *     ("staff member at a counter"), no la traduccion del trozo citado.
 *
 * Esta funcion es la lectura pura, sin base de datos, para que sea
 * testeable: recibe una entrada y el texto de SU historia y dice si el
 * contexto es real.
 */

/** Quita mayusculas, parentesis, puntuacion de borde y espacios repetidos,
 *  para comparar frases sin que una coma o una mayuscula esconda un match. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,;:!?¿¡"'`´""'']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿La ORACION del texto contiene a `palabra` como frase completa por si
 *  sola? Detecta replicas reales de una sola palabra, tipo "Voilà." o "Ya."
 *  dichas como frase entera, para no confundirlas con el fallo (a). */
function esReplicaDeUnaPalabra(palabra: string, texto: string): boolean {
  const p = palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Inicio de oracion (arranque de texto, o tras . ! ? con espacio y/o
  // comilla) + la palabra + cierre de oracion (. ! ? o fin de texto).
  //
  // El espacio tras la comilla es OPCIONAL (2026-09-16): el estilo del
  // catalogo pega la comilla de apertura a la palabra ("¿Estás bien?”,
  // preguntó Rubén. “Claro." -> nada entre “ y Claro), asi que exigir \s+
  // ahi hacia que NINGUNA replica de una sola palabra se reconociera en
  // ningun journey, en cualquier idioma. La comilla curva de apertura (“) se
  // suma a la lista; las curvas de cierre no hacian falta porque el cierre
  // de la replica lo exige [.!?], no una comilla.
  //
  // Se acepta tambien un signo de apertura invertido del espanol (¿ o ¡)
  // entre la comilla y la palabra ("“¿Ves?"): sigue siendo una replica de
  // una sola palabra, la puntuacion de apertura no es parte de ella. No se
  // ablanda nada mas: la palabra sigue teniendo que cerrar con [.!?].
  //
  // Dos replicas de una palabra seguidas, de hablantes distintos, pegan un
  // cierre y una apertura con un espacio en medio ("?” “Vienes."): antes solo
  // se aceptaba UNA comilla tras el cierre, asi que ese hueco entre las dos
  // nunca coincidia y la replica se daba por no encontrada (2026-09-19).
  // Ahora se aceptan CERO O MAS comillas, cada una con su espacio opcional
  // delante: ensancha lo que ya aceptaba, nunca lo estrecha.
  const re = new RegExp(`(^|[.!?](?:\\s*["'\`»“”])*\\s*)[¿¡]?${p}[.!?]`, "iu");
  return re.test(texto);
}

/** Marcador de comodin de un verbo separable ("holt … ab": el verbo alemán
 *  se parte y el trozo con sentido va con las dos mitades y puntos suspensivos
 *  en medio, sin las palabras que caen entre ellas). No es un trozo falso: es
 *  como el proyecto anota estos verbos. */
const ELIPSIS = /…|\.\.\./;

/** Los trozos de `es` a los que se parte por el comodin, normalizados y sin
 *  vacios. */
function trozosPorElipsis(es: string): string[] {
  return es
    .split(ELIPSIS)
    .map((t) => normalizar(t))
    .filter((t) => t.length > 0);
}

/** ¿Aparecen los trozos, EN ORDEN aunque no pegados, dentro del texto? Es lo
 *  que hace falta para un verbo separable: "holt" antes que "ab", en algún
 *  punto posterior de la misma oracion. */
function aparecenEnOrden(trozos: string[], textoNorm: string): boolean {
  let desde = 0;
  for (const t of trozos) {
    const i = textoNorm.indexOf(t, desde);
    if (i === -1) return false;
    desde = i + t.length;
  }
  return true;
}

/** Determinantes y pronombres cortos de los cinco idiomas del catalogo
 *  (ES/FR/DE/IT/PT). Un trozo que, quitando la palabra tocada, solo trae uno
 *  de estos, es intrinsecamente corto: su traduccion coincide con la glosa
 *  sin que eso sea la glosa disfrazada de trozo ("Le chômage" -> el trozo ES
 *  el sustantivo con su articulo, no una definicion pegada). */
const DETERMINANTES_Y_PRONOMBRES = new Set([
  // Espanol
  "el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "le", "les",
  "se", "te", "me", "nos", "os", "tu", "tú", "su", "sus", "mi", "mis", "yo",
  "él", "ella", "ellos", "ellas", "usted", "ustedes", "esto", "eso", "aquello",
  "este", "esta", "ese", "esa", "aquel", "aquella",
  // Frances
  "l", "un", "une", "des", "ce", "cet", "cette", "ces", "mon", "ma", "mes",
  "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre", "vos",
  "leur", "leurs", "je", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "moi", "toi", "lui", "eux", "y", "en", "là", "ci", "tous", "tout", "toute",
  "toutes",
  // Aleman
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "einem",
  "einen", "eines", "ich", "du", "er", "sie", "es", "wir", "ihr", "mein",
  "dein", "sein", "ihre", "unser", "euer", "mich", "dich", "sich", "uns",
  "euch", "ihn", "ihm", "ihnen",
  // Italiano
  "il", "gli", "i", "uno", "io", "lui", "lei", "noi", "voi", "loro", "mi",
  "ti", "si", "ci", "vi", "li", "ne", "questo", "questa", "questi", "queste",
  "quello", "quella", "quelli", "quelle",
  // Portugues
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "eu", "ele", "ela", "nós",
  "vós", "eles", "elas", "vos", "lhe", "lhes", "meu", "minha", "teu", "tua",
  "seu", "sua", "esse", "essa", "aquele", "aquela",
]);

/** ¿Cuantas palabras quedan en `c.es` si se quita la palabra tocada y los
 *  determinantes/pronombres? Un trozo corto de verdad ("Le chômage", "tu
 *  verras") deja 0 o 1: no es una glosa disfrazada, es que el trozo ES
 *  corto. Separa tambien por guion para "soir-là" -> ["soir","là"]. */
function palabrasSustantivasRestantes(esNorm: string, palabraNorm: string): string[] {
  return esNorm
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((t) => t !== palabraNorm && !DETERMINANTES_Y_PRONOMBRES.has(t));
}

export type VeredictoGlossContext =
  | { ok: true }
  | { ok: false; motivo: "es-es-la-palabra-sola" | "en-es-la-glosa" | "es-no-esta-en-el-texto" };

export function evaluarEntradaGlossContext(args: {
  palabra: string;
  c: { es: string; en: string };
  /** La glosa (diccionario) de esa entrada: la propia `g` si la trae, si no
   *  la global del bundle para esa palabra. */
  g: string;
  /** título + texto de la historia donde cae la entrada. */
  texto: string;
}): VeredictoGlossContext {
  const { palabra, c, g, texto } = args;
  const esTieneElipsis = ELIPSIS.test(c.es);
  const esNorm = normalizar(c.es);
  const enNorm = normalizar(c.en);
  const palabraNorm = normalizar(palabra);
  const gNorm = normalizar(g);

  // (a) c.es es una sola palabra y es la propia palabra tocada, salvo que
  //     esa palabra aparezca de verdad como frase de una sola palabra en el
  //     texto (una replica real, "Voilà."). Un trozo con elipsis (verbo
  //     separable aleman) nunca es "una sola palabra": ya trae dos mitades.
  const esUnaSolaPalabra = !esTieneElipsis && !esNorm.includes(" ") && esNorm.length > 0;
  if (esUnaSolaPalabra && esNorm === palabraNorm) {
    if (!esReplicaDeUnaPalabra(palabra, texto)) {
      return { ok: false, motivo: "es-es-la-palabra-sola" };
    }
  }

  // (b) c.en es igual a la glosa g (o de la global) o empieza por ella.
  // "Empieza por ella" a secas dispara en falso sobre glosas de una palabra
  // ("and", "with", "without"): CUALQUIER trozo que traduzca literalmente
  // "y ...", "con ...", "sin ..." arranca con esa misma palabra en ingles sin
  // que la traduccion sea la glosa. Lo que de verdad delata la glosa
  // disfrazada de trozo es que la glosa cubre la MAYOR PARTE de c.en, no solo
  // su primer token: exigimos que las palabras de `g` sean al menos el 60%
  // de las de `c.en` ademas de ir al principio.
  //
  // Y no dispara cuando el TROZO mismo es corto de verdad: "Le chômage" ->
  // "Unemployment" o "tu verras" -> "you'll see" no son una glosa disfrazada,
  // son que el trozo es la palabra con su articulo o su pronombre, y su
  // traduccion coincide con la glosa porque ahi no hay mas que traducir. Si
  // quitando la palabra tocada y los determinantes/pronombres de c.es queda
  // 0 o 1 palabra, (b) no se aplica.
  const trozoEsCorto = palabrasSustantivasRestantes(esNorm, palabraNorm).length <= 1;
  if (!trozoEsCorto && gNorm.length > 0 && enNorm.length > 0 && enNorm.startsWith(gNorm)) {
    const palabrasG = gNorm.split(" ").length;
    const palabrasEn = enNorm.split(" ").length;
    if (palabrasG / palabrasEn >= 0.6) {
      return { ok: false, motivo: "en-es-la-glosa" };
    }
  }

  // (c) c.es no aparece literal en el texto de la historia. Con elipsis, las
  //     dos mitades del verbo separable tienen que aparecer, en ese orden,
  //     no necesariamente pegadas.
  const textoNorm = normalizar(texto);
  if (esTieneElipsis) {
    if (!aparecenEnOrden(trozosPorElipsis(c.es), textoNorm)) {
      return { ok: false, motivo: "es-no-esta-en-el-texto" };
    }
  } else if (!textoNorm.includes(esNorm)) {
    return { ok: false, motivo: "es-no-esta-en-el-texto" };
  }

  return { ok: true };
}
