/**
 * Saca del catalogo las historias que salen en los anuncios: el texto, la
 * portada, el audio YA NARRADO y sus tiempos por palabra.
 *
 *   npx tsx scripts/_ads/buildStories.ts
 *
 * No sintetiza nada. La narracion y la alineacion existen desde que se publico
 * la historia, asi que el karaoke del anuncio no es una aproximacion: son los
 * mismos milisegundos que ve un usuario en la app.
 *
 * Escribe scripts/_ads/adStories.js (lo lee la pagina) y adStories.json (lo lee
 * el render para cortar y pegar el audio).
 */
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const p = new PrismaClient();
const AUDIO_CACHE = "/tmp/claude-501/dpl-ads/audio";

/** Nombre en cache de un mp3: el de su URL. Dos historias distintas nunca
 *  comparten archivo, aunque compartan ventana. */
function cacheName(url: string): string {
  return (url.split("/").pop() ?? "audio.mp3").replace(/[^\w.-]/g, "_");
}

type W = { text: string; startSec: number; endSec: number; charStart: number; charEnd: number };

/**
 * La ventana de cada anuncio: palabras CONTIGUAS, para que el audio no salte.
 *
 * El vocabulario va por RANGO de indices y con su TIPO, que es lo que decide
 * el color en el lector (verbo coral, sustantivo azul, adjetivo verde,
 * adverbio morado, expresion rosa). Por indices y no por texto porque una
 * locucion como "muertos de frio" lleva un "de" que sale cinco veces mas en
 * el mismo parrafo. Y solo la PRIMERA aparicion de cada entrada lleva
 * pastilla, igual que en la app.
 */
type Vocab = Array<[number, number, string]>;

const WINDOWS: Array<{ key: string; title: string; from?: number; to?: number; vocab: Vocab; lead?: number; align?: number; segments?: [number, number]; fragments?: [number, number]; clip?: [number, number] }> = [
  {
    key: "ahorita",
    title: "Ahorita salgo",
    from: 14, to: 54,
    vocab: [
      [16, 16, "adverb"], [32, 33, "expression"], [37, 39, "expression"], [40, 40, "noun"],
    ] as Vocab,
  },
  {
    key: "hormigas",
    title: "Las hormigas culonas",
    from: 10, to: 47,
    vocab: [[12, 12, "verb"], [14, 15, "noun"]] as Vocab,
  },
  // Lima. Narrador del tema "la jerga" del Friends LATAM C1.
  {
    key: "causa",
    title: "Pilar no entiende nada",
    from: 19, to: 62,
    vocab: [
      [23, 23, "expression"], [25, 26, "expression"], [30, 30, "noun"], [54, 55, "expression"],
    ] as Vocab,
  },
  // Chile. Narradora del tema "el weveo".
  {
    key: "escoba",
    title: "El asado a la orilla",
    from: 0, to: 43,
    vocab: [
      [7, 7, "noun"], [14, 16, "expression"], [36, 36, "verb"], [38, 38, "adjective"],
    ] as Vocab,
  },
  // Berlin. Narrador del Expat y el Friends alemanes.
  {
    key: "spaeti",
    title: "Der Späti in der Weserstraße",
    from: 24, to: 51,
    vocab: [
      [29, 29, "noun"], [36, 36, "noun"], [45, 45, "noun"], [48, 48, "noun"],
    ] as Vocab,
  },
  // España, A1 Traveler. La escena de la barra: sin carta y se pide de pie.
  {
    key: "barra",
    title: "La barra manda",
    from: 86, to: 150,
    vocab: [
      [89, 89, "noun"], [90, 90, "expression"], [96, 96, "noun"],
      [128, 128, "noun"], [141, 141, "expression"], [146, 148, "noun"],
    ] as Vocab,
  },
  // España, A1 Traveler. La hora de comer: a la una y media el bar esta vacio.
  // Hasta el final: el texto tiene que seguir POR DEBAJO de la tarjeta, o el
  // telefono se queda medio vacio.
  {
    key: "gato",
    title: "A las dos no cabe nadie",
    from: 46, to: 160,
    // Ocho entradas en 115 palabras y ninguna pegada a otra: cinco rosas
    // seguidas se leian como una mancha, y dos pastillas juntas chocaban.
    vocab: [
      [56, 58, "expression"], [72, 76, "expression"], [95, 96, "expression"],
      [108, 108, "verb"], [116, 116, "noun"], [120, 120, "adjective"],
      [131, 131, "verb"], [160, 160, "noun"],
    ] as Vocab,
  },
  // Oaxaca. Iteracion sobre lo que funciono: revelacion literal de un modismo.
  {
    key: "suelos",
    title: "Café y pan de yema",
    from: 18, to: 71,
    vocab: [
      [28, 31, "expression"], [34, 34, "verb"], [39, 40, "expression"],
      [50, 50, "noun"], [63, 63, "noun"], [70, 71, "expression"],
    ] as Vocab,
  },
  // Buenos Aires, la barra. Mismo molde.
  {
    key: "pancho",
    title: "El psicólogo de la barra",
    from: 0, to: 51,
    vocab: [
      [2, 2, "adjective"], [13, 13, "verb"], [15, 15, "noun"],
      [24, 24, "adjective"], [44, 44, "noun"], [50, 50, "adjective"],
    ] as Vocab,
  },
  // Buenos Aires. Narrador del tema "el desahogo".
  {
    key: "previa",
    title: "El mismo chabón",
    from: 0, to: 41,
    vocab: [
      [2, 2, "noun"], [6, 6, "noun"], [16, 16, "adverb"], [18, 18, "noun"],
      [39, 39, "adjective"],
    ] as Vocab,
  },
  // Lector + Practice, Bucaramanga: la frase de "no sea delicada", que tiene
  // su ejercicio Meaning en el set publicado.
  {
    key: "delicada",
    title: "Las hormigas culonas",
    from: 57, to: 105,
    vocab: [[60, 62, "expression"], [66, 67, "expression"]] as Vocab,
  },
  // Lector + Practice, Buenos Aires: empieza en "Estoy re mal" para que
  // "embalada" llegue antes y no haya que esperar quince segundos.
  {
    key: "embalada",
    title: "El mismo chabón",
    from: 15, to: 60,
    vocab: [[16, 16, "adverb"], [18, 18, "noun"], [39, 39, "adjective"]] as Vocab,
  },
  // Lector + Practice con jerga mas divertida (2026-09-14). Cada ventana
  // arranca en la frase de la expresion, que tiene su ejercicio Meaning.
  {
    key: "pedo",
    title: "Ahorita salgo",
    from: 61, to: 110,
    vocab: [[70, 71, "expression"], [94, 94, "verb"], [101, 101, "adjective"]] as Vocab,
  },
  {
    key: "comedera",
    title: "Las hormigas culonas",
    from: 199, to: 238,
    vocab: [[216, 217, "noun"]] as Vocab,
  },
  // Valparaiso. El fragmento 6 entero: la respuesta de Ignacio.
  {
    key: "altiro",
    title: "La once con chirrido",
    fragments: [2, 2],
    vocab: [[59, 60, "expression"]] as Vocab,
  },
  // Colombia, costa. Solo la frase de "bailaba sabroso" (segmento 1): el
  // fragmento entero dura 20 s y el anuncio tiene que quedar en 15. Corta en
  // las pausas que guardo la narracion, no en mitad de una palabra.
  {
    key: "sabroso",
    title: "Andrés en la pista",
    segments: [1, 1],
    vocab: [[24, 25, "expression"]] as Vocab,
  },
  // Aguascalientes. El fragmento 6 entero: la oferta del corredor.
  {
    key: "fiado",
    title: "El gallo colorado",
    fragments: [5, 5],
    vocab: [[84, 84, "expression"]] as Vocab,
  },
  // Cali. Saludo de Yamileth en el Traveler B2 latam: "que mas pues" es el
  // hola de todos los dias, y su lectura literal en ingles no dice nada.
  {
    key: "quemas",
    title: "Aquí se dice arrendando",
    from: 35, to: 56, lead: -0.45,
    vocab: [[37, 37, "noun"], [48, 49, "expression"]] as Vocab,
  },
  {
    key: "roche",
    title: "Pilar no entiende nada",
    from: 77, to: 125,
    vocab: [[86, 86, "noun"], [96, 96, "noun"], [111, 111, "noun"], [123, 123, "adjective"], [125, 125, "noun"]] as Vocab,
  },
  /* Tour de variantes (anuncio 67): una oracion entera por pais, sin
   * ejercicio. El corte va MEDIDO en el mp3 con silencedetect a -40 dB
   * (scripts/_ads/_clipmeas.ts), porque en estas cuatro el alineado no cierra
   * donde acaba la voz y en tres de ellas adelanta la PRIMERA palabra hasta un
   * segundo. Esa primera se queda
   * pegada al inicio del clip (tiempo negativo, se pinta en 0) y el resto
   * del karaoke cae donde suena. */
  {
    key: "vmx",
    title: "Ahorita salgo",
    clip: [26.58, 28.56], from: 70, to: 76, align: 0.38,
    vocab: [[70, 71, "expression"]] as Vocab,
  },
  {
    key: "var",
    title: "La porteña mete mano",
    clip: [52.26, 54.79], from: 113, to: 118,
    vocab: [[116, 116, "expression"]] as Vocab,
  },
  {
    key: "vco",
    title: "La Mesa no perdona",
    clip: [31.10, 33.86], from: 68, to: 75,
    vocab: [[69, 69, "expression"]] as Vocab,
  },
  /* Tour de variantes, segunda pieza (anuncio 68): otras cuatro historias y
   * otro titular. Mismos cortes medidos con _speechRuns.ts. */
  {
    key: "wco",
    title: "La Última Pola",
    clip: [21.20, 23.88], from: 44, to: 49,
    vocab: [[45, 45, "noun"]] as Vocab,
  },
  {
    key: "wmx",
    title: "Le toca a Mateo",
    clip: [61.24, 63.86], from: 155, to: 162,
    vocab: [[156, 156, "noun"]] as Vocab,
  },
  {
    key: "war",
    title: "El mismo chabón",
    // Frase de MITAD de historia, no del final: una ventana en la ultima
    // frase deja el lector medio vacio, porque debajo no queda texto.
    clip: [70.90, 74.20], from: 182, to: 192,
    vocab: [[183, 183, "noun"]] as Vocab,
  },
  /* Variante de la 68 (anuncio 69): mismas Colombia y Mexico, pero Argentina
   * con "chamuyero" y Espana con "cuñada". */
  {
    key: "xar",
    title: "El mismo chabón",
    clip: [94.68, 97.92], from: 248, to: 260,
    vocab: [[249, 249, "noun"]] as Vocab,
  },
  {
    key: "xes",
    title: "La caña de Marcos",
    clip: [50.50, 53.16], from: 109, to: 116,
    vocab: [[114, 114, "noun"]] as Vocab,
  },
  {
    key: "yco",
    title: "Apagaron el picó",
    clip: [31.36, 32.70], from: 78, to: 80,
    vocab: [[80, 80, "adjective"]] as Vocab,
  },
  {
    key: "ymx",
    title: "Día de Muertos en Oaxaca",
    // Dos oraciones seguidas: el corte abarca las dos y la pausa de en medio.
    clip: [21.94, 25.42], from: 51, to: 61,
    vocab: [[54, 54, "noun"], [59, 59, "noun"]] as Vocab,
  },
  /* Tours 70 y 71: palabras nuevas y mas paises. Todos los cortes medidos con
   * _speechRuns.ts; las historias que no aparecen aqui es porque su narracion
   * va sin pausas y no hay donde cortar limpio. */
  {
    key: "zpe",
    title: "La cortesía más cara",
    clip: [59.70, 62.78], from: 143, to: 152,
    vocab: [[145, 145, "noun"]] as Vocab,
  },
  {
    key: "zco",
    title: "Apagaron el picó",
    clip: [21.36, 24.58], from: 51, to: 63,
    vocab: [[52, 52, "noun"]] as Vocab,
  },
  {
    key: "zar",
    title: "La porteña mete mano",
    clip: [43.82, 45.06], from: 91, to: 94,
    vocab: [[92, 92, "slang"]] as Vocab,
  },
  {
    key: "zes",
    title: "Apúntame la de mañana",
    clip: [38.76, 41.42], from: 83, to: 92,
    vocab: [[85, 85, "noun"]] as Vocab,
  },
  {
    key: "yco2",
    title: "Aquí la máscara baila",
    clip: [24.14, 25.84], from: 45, to: 47,
    vocab: [[47, 47, "noun"]] as Vocab,
  },
  {
    key: "ype",
    title: "Una yapa de sobremesa",
    clip: [63.28, 66.38], from: 154, to: 164,
    vocab: [[155, 155, "noun"]] as Vocab,
  },
  {
    key: "yar",
    title: "La porteña mete mano",
    clip: [46.50, 48.34], from: 95, to: 103,
    vocab: [[103, 103, "expression"]] as Vocab,
  },
  {
    key: "wes",
    title: "La sobremesa se estira",
    clip: [7.58, 9.98], from: 16, to: 23,
    vocab: [[17, 17, "noun"]] as Vocab,
  },
  {
    key: "ves",
    title: "Invita el que cumple años",
    // El final va en 55,44: entre 55,01 y 55,20 hay una oclusion de "aqui" que
    // silencedetect leia como silencio, y el corte se comia la ultima silaba
    // ("paga aqu"). Medido con _speechRuns.ts, que cierra la voz solo tras
    // 0,18 s por debajo de -52 dB.
    clip: [52.42, 55.44], from: 126, to: 133,
    vocab: [[131, 131, "noun"]] as Vocab,
  },
];

/** Tipo de la entrada que cubre esa palabra, o null. */
/** La misma baraja que `shuffleOptionsDeterministic` en la API de practica
 *  (src/app/api/story-practice/route.ts): mismo hash FNV, mismo mulberry32 y
 *  misma semilla, para que el anuncio muestre el orden real. */
function shuffleLikeApi(options: string[], seedStr: string): string[] {
  if (options.length < 2) return options;
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  const rand = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function vocabType(i: number, vocab: Vocab): string | null {
  const hit = vocab.find(([a, b]) => i >= a && i <= b);
  return hit ? hit[2] : null;
}

async function main() {
  mkdirSync(AUDIO_CACHE, { recursive: true });
  const out: Record<string, unknown> = {};

  for (const win of WINDOWS) {
    const row = await p.journeyStory.findFirst({
      where: { title: win.title },
      select: { title: true, coverUrl: true, audioUrl: true, audioWordTimings: true, audioSegments: true, audioFragments: true, vocab: true,
                practiceSet: { select: { exercises: { select: { id: true, type: true, word: true, payload: true } } } } },
    });
    if (!row?.audioUrl || !row.audioWordTimings) throw new Error(`${win.title}: sin audio alineado`);

    const tim = row.audioWordTimings as unknown as { words: W[]; storyPlainText: string; audioDurationSec: number };
    const words = tim.words;
    // Algunas historias guardan comillas rectas. Se cambian por curvas UNA a
    // una (misma longitud, asi los offsets siguen valiendo): abre si viene
    // detras de un espacio, cierra en cualquier otro caso. Sin esto la
    // ventana se queda con comillas de cierre sueltas.
    const raw = tim.storyPlainText;
    let plain = "";
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '"') {
        const prev = i === 0 ? "\n" : raw[i - 1];
        plain += /[\s(¿¡]/.test(prev) ? "\u201c" : "\u201d";
      } else {
        plain += raw[i];
      }
    }

    // El corte empieza un pelo antes de la primera palabra, pero nunca dentro
    // de la anterior: cortar a media silaba se oye.
    const first = words[win.from];
    const prevEnd = win.from > 0 ? words[win.from - 1].endSec : 0;
    // lead: cuanto se abre ANTES de la primera palabra. En negativo entra ya
    // empezada, que es lo que hace falta cuando la voz va detras del alineado.
    // segments: la ventana es uno o varios FRAGMENTOS enteros del audio, con el
    // inicio y el fin que guardo la propia narracion (audioSegments). Nada de
    // cortar por dentro ni de estimar silencios.
    /* fragments: el anuncio usa el MP3 del fragmento tal cual salio de la
     * narracion. No se recorta el audio completo: el corte ya viene hecho de
     * fabrica, asi que ninguna palabra se parte. */
    const frags = (row.audioFragments as unknown as Array<{ index: number; startSec: number; endSec: number; url: string; text: string }> | null) ?? [];
    let fragFile: string | null = null, fragStart = 0, fragDur = 0;
    if (win.fragments) {
      const picked = frags.filter((f) => f.index >= win.fragments![0] && f.index <= win.fragments![1]).sort((a, b) => a.index - b.index);
      if (!picked.length) throw new Error(`${win.title}: faltan los fragmentos ${win.fragments}`);
      fragStart = picked[0].startSec;
      const parts: string[] = [];
      for (const f of picked) {
        const file = `${AUDIO_CACHE}/${cacheName(f.url)}`;
        if (!existsSync(file)) {
          const res = await fetch(f.url);
          if (!res.ok) throw new Error(`${win.title}: el fragmento ${f.index} devolvio ${res.status}`);
          writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        }
        parts.push(file);
      }
      fragFile = `${AUDIO_CACHE}/${win.key}-frag-${cacheName(picked[0].url).slice(0, 40)}.mp3`;
      if (parts.length === 1) copyFileSync(parts[0], fragFile);
      else {
        const list = `${fragFile.replace(/\.mp3$/, "")}.txt`;
        writeFileSync(list, parts.map((f) => `file '${f}'`).join("\n"));
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", fragFile]);
      }
      fragDur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fragFile]).toString().trim());
      win.from = words.findIndex((w) => w.startSec >= fragStart - 0.02);
      // Cuantas palabras trae el fragmento las dice su propio texto: el
      // alineado puede llevar la frase siguiente unas decimas antes.
      const nWords = picked.map((f) => f.text).join(" ").split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;
      win.to = win.from + nWords - 1;
    }
    const segs = (row.audioSegments as unknown as Array<{ index: number; startSec: number; endSec: number }> | null) ?? [];
    let segStart = 0, segEnd = 0;
    /* clip: el corte va MEDIDO sobre el mp3 (silencedetect a -40 dB), no por
     * los limites que guardo el alineado. En varias historias el alineado
     * cierra la oracion decimas antes de que la voz la acabe, o arranca la
     * primera palabra un segundo antes de que suene; ahi el limite bueno es
     * el silencio de verdad. Las palabras las da `from`/`to`, a mano. */
    if (win.clip) {
      segStart = win.clip[0]; segEnd = win.clip[1];
      if (win.from == null || win.to == null) throw new Error(`${win.title}: clip sin from/to`);
    } else if (win.segments) {
      const a = segs.find((g) => g.index === win.segments![0]);
      const b = segs.find((g) => g.index === win.segments![1]);
      if (!a || !b) throw new Error(`${win.title}: faltan los fragmentos ${win.segments}`);
      segStart = a.startSec; segEnd = b.endSec;
      win.from = words.findIndex((w) => w.startSec >= segStart - 0.02);
      // La ultima palabra cuenta si EMPIEZA dentro del fragmento: el alineado
      // puede cerrarla un pelo despues del final que guardo la narracion.
      for (let i = words.length - 1; i >= 0; i--) if (words[i].startSec < segEnd - 0.02) { win.to = i; break; }
    }
    const lead = win.lead ?? 0.25;
    // align: cuanto va ADELANTADO el alineado respecto a la voz real en ESTA
    // parte de la historia (medido con scripts/_ads/_cuts.ts). Se suma a los
    // tiempos de palabra, asi el karaoke cae donde suena y no antes.
    const align = win.align ?? 0;
    const start = win.fragments ? fragStart : win.clip ? segStart - 0.06 : win.segments ? segStart - 0.08 : Math.max(prevEnd, first.startSec + align - lead);

    const tokens = [];
    for (let i = win.from; i <= win.to; i++) {
      const w = words[i];
      const raw = plain.slice(w.charStart, w.charEnd);
      // La primera palabra tambien mira hacia atras: si la ventana empieza
      // dentro de un dialogo, sin su comilla de apertura queda una de cierre
      // suelta al final y parece un fallo.
      const gapBefore = i > win.from
        ? plain.slice(words[i - 1].charEnd, w.charStart)
        : plain.slice(Math.max(0, w.charStart - 2), w.charStart);
      // La comilla de apertura pertenece a la palabra SIGUIENTE, no a esta:
      // si se queda aqui sale duplicada.
      const post = i < win.to
        ? plain.slice(w.charEnd, words[i + 1].charStart).replace(/\s+/g, "").replace(/[“¿¡]/g, "")
        : (plain.slice(w.charEnd, w.charEnd + 1).match(/[.,;:!?”]/) ? plain.slice(w.charEnd, w.charEnd + 1) : "");
      tokens.push({
        t: raw,
        pre: (gapBefore.match(/[“¿¡]/g) ?? []).join(""),
        post: post,
        s: Math.max(0, w.startSec + align - start),
        e: Math.max(0, w.endSec + align - start),
        br: gapBefore.indexOf("\n") !== -1,
        kind: vocabType(i, win.vocab),
      });
    }
    // La primera palabra de la ventana abre frase en el anuncio.
    tokens[0].t = tokens[0].t.charAt(0).toUpperCase() + tokens[0].t.slice(1);

    /* El nombre del archivo en cache sale de la URL, no de la clave de la
     * ventana: con `${win.key}.mp3` bastaba cambiar de historia dentro de la
     * misma ventana para que se reusara el mp3 ANTERIOR, y el anuncio salia
     * con el texto de una historia y la voz de otra. Paso el 2026-09-21 en
     * tres de las cuatro piezas del tour. */
    const file = `${AUDIO_CACHE}/${cacheName(row.audioUrl)}`;
    if (!existsSync(file)) {
      const res = await fetch(row.audioUrl);
      if (!res.ok) throw new Error(`${win.title}: el audio devolvio ${res.status}`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }

    out[win.key] = {
      title: row.title,
      cover: row.coverUrl,
      total: Math.round(tim.audioDurationSec),
      /* Texto que VA ANTES del fragmento, por si el que sigue no llega para
       * llenar la pantalla (una ventana al final de la historia deja el
       * telefono medio vacio). Se pinta apagado encima, como en el lector. */
      before: (() => {
        const first = words[win.from!];
        const head = plain.slice(0, first.charStart).replace(/[^\S\n]*[“¡¿]?$/, "");
        // UNA linea, no mas: el relleno de arriba esta para que la pagina no
        // se vea vacia, no para empujar la frase que suena fuera de cuadro.
        const cut = head.slice(-46).split(/\n/).pop() ?? "";
        const trimmed = cut.slice(cut.indexOf(" ") + 1).replace(/\s+/g, " ").trim();
        return trimmed ? [trimmed] : [];
      })(),
      // Texto que SIGUE al fragmento: se pinta apagado debajo para que el
      // lector no parezca vacio. No suena ni se resalta.
      after: (() => {
        const last = words[win.to!];
        const rest = plain.slice(last.charEnd).replace(/^[^\S\n]*[\u201d”.,;:!?]*[^\S\n]*/, "");
        const cut = rest.slice(0, 340);
        const trimmed = cut.slice(0, Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n")));
        // Se conservan los saltos: son los parrafos de la historia.
        return trimmed.split(/\n+/).map((p) => p.replace(/[^\S\n]+/g, " ").trim()).filter(Boolean);
      })(),
      /* Los ejercicios Meaning, tal y como los sirve la API al movil: las
       * opciones van BARAJADAS con la misma funcion y la misma semilla (el id
       * de la fila), asi el anuncio ensena el orden que ve un usuario. */
      practice: Object.fromEntries(
        (row.practiceSet?.exercises ?? [])
          .filter((e) => e.type === "meaning_in_context")
          .map((e) => {
            const pay = e.payload as unknown as { options?: string[]; answer?: string };
            const opts = shuffleLikeApi(pay.options ?? [], e.id);
            return [e.word.toLowerCase(), { word: e.word, options: opts, correct: opts.indexOf(pay.answer ?? "") }];
          }),
      ),
      /* Las definiciones salen de la BASE, no de la escena: la tarjeta del
       * anuncio tiene que decir exactamente lo que ve el usuario en la app. */
      glossary: Object.fromEntries(
        ((row.vocab as unknown as Array<{ word: string; type?: string; definition?: string }>) ?? [])
          .map((v) => [v.word.toLowerCase(), { pos: (v.type ?? "").toUpperCase(), def: v.definition ?? "" }]),
      ),
      // Con fragmentos, el audio ES el mp3 del fragmento y empieza en cero.
      audio: fragFile ?? file,
      audioStart: fragFile ? 0 : Math.round(start * 1000) / 1000,
      clipEnd: win.fragments ? Math.round(fragDur * 100) / 100 : win.clip ? Math.round((segEnd + 0.08 - start) * 100) / 100 : win.segments ? Math.round((segEnd + 0.12 - start) * 100) / 100 : null,
      // Donde va la barra de progreso: el minuto real de la historia.
      offset: Math.round(start * 1000) / 1000,
      words: tokens,
    };
    console.log(`${win.key}: ${tokens.length} palabras, corte en ${start.toFixed(2)}s de ${Math.round(tim.audioDurationSec)}s`);
  }

  writeFileSync("scripts/_ads/adStories.json", JSON.stringify(out, null, 1));
  writeFileSync("scripts/_ads/adStories.js", "window.__AD_STORIES = " + JSON.stringify(out) + ";\n");
  await p.$disconnect();
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
