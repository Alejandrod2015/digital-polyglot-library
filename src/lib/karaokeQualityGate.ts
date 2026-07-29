// Refuses to run the karaoke on stories where it is known to be wrong.
//
// Measured 2026-07-28: a group of catalog stories carries an `audio` that
// says considerably MORE than the stored `text`. Examples, text words vs
// words actually heard in the audio:
//
//   la-excursion-a-la-sierra-nevada   374 vs 781
//   la-leyenda-de-la-llorona          370 vs 678
//   el-tren-de-la-sabana              426 vs 691
//
// The audio starts and ends on the story's own first and last sentence, so
// the stored text is an abridged version of the same narration. Forced
// alignment then has to stretch 374 words over an audio containing 781, and
// the words land anywhere: median error 58 s, 40 s and 2.8 s against the
// whisper ruler, versus ~0.19 s on a healthy story.
//
// No aligner can fix that; the text (or the audio) has to change. Until it
// does, showing a confidently wrong highlight is worse than showing none, so
// these stories fall back to the plain reader.
//
// Pure module: safe on client and server.

import type { AudioWordTimingsPayload } from "./audioWordTimingsTypes";

/**
 * Narration across the healthy library runs at a median of 2.43 words/second
 * and no journey story sits below 1.96. A story far under that is not slow
 * narration, it is an audio saying more than the text.
 *
 * The threshold is deliberately loose: it is a backstop for stories nobody
 * has measured yet. Everything already measured is listed explicitly below,
 * because the rate alone does not separate the two groups cleanly (a story at
 * 1.83 words/s measured 0.52 s of error while another at 1.69 was fine).
 */
const MIN_WORDS_PER_SEC = 1.2;

/**
 * Every story measured below the bar, from scoring ALL 346 payloads against
 * the whisper ruler on 2026-07-28. The healthy library sits at 0.190 s of
 * median error (worst healthy story 0.450 s); the approved reference,
 * kehrwoche-bei-achim, at 0.170 s.
 *
 * Regenerate the list with `scripts/_karaokeFullScore.py` +
 * `scripts/_karaokeGateList.py`. A story leaves this list by having its
 * content fixed and re-measured, never by loosening the gate.
 */
export const KARAOKE_BLOCKED_SLUGS: ReadonlySet<string> = new Set([
  // Dos que estaban aquí y NO debían estar, comprobadas el 2026-07-28:
  //   la-tradicion-del-mate: figuraba con language "italian" dentro del libro
  //     argentino, así que se alineó (y se midió) con el idioma equivocado. Con
  //     el dato corregido mide 0,160 s y 76% dentro de 300 ms, mejor que la
  //     referencia aprobada. Estaba sana.
  //   el-vendedor-ambulante: son DOS historias distintas que comparten slug, una
  //     por libro, cada una con su audio correcto. Lo resuelve el chequeo de
  //     pertenencia de arriba, no una lista.

  // TEXTO RECORTADO: arreglado el 2026-07-28. El texto guardado era una
  // version condensada del manuscrito del libro (Google Doc enlazado desde la
  // hoja "Biblioteca"). Reimportadas las 20 historias de
  // colombian-spanish-stories-for-beginners desde ese manuscrito y
  // re-alineadas: el ratio de palabras oidas/texto paso de 1,56 a 1,00 y el
  // error mediano del libro de hasta 58 s a 0,235 s. 19 de las 20 salieron de
  // esta lista; la que queda esta abajo, y ya no por contenido.

  // AUDIO Y TEXTO NO COINCIDEN (misma familia que el bloque de arriba, pero
  // parcial: no es que el texto este recortado entero, es que a mitad de la
  // historia el audio dice cosas que el texto no tiene). Medido el 2026-07-28
  // con whisper small: 362 palabras de texto contra 437 oidas, ratio 1,21, y
  // solo el 75% del texto se reconoce en el audio. El error no esta repartido:
  // se dispara en 191-194 s, hasta 7,6 s de desvio, mientras el resto de la
  // historia va fina. Ningun alineador arregla esto; hay que arreglar el texto.
  // Las historias sanas de la misma tanda estan todas en ratio 0,96-0,99.
  //
  // ARREGLADA el 2026-07-29, ya no esta en la lista. Se restituyo el texto
  // desde el manuscrito (Doc "Short Stories from Mysterious Venice", carpeta
  // SS_IT_Mysterious-Venice, enlazado en la hoja "Biblioteca" fila 93) y se
  // re-alineo. Antes: ratio 1,21, match 0,75, mediana 0,310, p90 3,45 s.
  // Despues: ratio 0,94, match 0,91, mediana 0,200, p90 0,690 s, o sea mejor
  // que la peor historia sana del barrido (0,450) y a la altura de la
  // referencia aprobada (0,170).
  // El diff texto-viejo contra texto-nuevo reprodujo EXACTAMENTE, punto por
  // punto, las divergencias que se habian medido contra el audio, asi que el
  // manuscrito es sin duda la fuente de la grabacion. El 0,94 de ratio no es
  // deuda: son las 26 palabras de etiquetas de hablante y acotaciones que el
  // narrador no lee (463 en el texto, 437 oidas).
  // Convertido con scripts/_buildVeniceText.ts, que existe aparte del
  // colombiano porque este libro encadena los dialogos sin linea en blanco y
  // conserva las acotaciones entre parentesis dentro del blockquote.

  // VAN TARDE, SIN CAUSA IDENTIFICADA: el contenido esta bien (ratio 0,97-0,99,
  // 93-97% del texto se oye) pero el resaltado vive medio segundo por detras
  // del narrador. Medido con whisper small, error CON SIGNO, contra historias
  // de control de la misma tanda (el-mercado-de-medellin -0,13 s,
  // il-manoscritto-perduto -0,11 s):
  // CERRADO COMO "NO SE ARREGLA", no como pendiente (2026-07-29). Diez
  // hipotesis descartadas con medicion, ninguna en pie. Es UNA historia de 371,
  // y bloqueada no enseña un resaltado equivocado: simplemente no lo enseña.
  // Reabrirlo solo merece la pena con una idea NUEVA, no repitiendo las de
  // abajo. Para calibrar cuanto duele: descontando la apertura mide 0,460, y
  // la peor historia SANA de todo el barrido esta en 0,450. Esta al borde, no
  // rota de lejos.
  "la-leyenda-de-la-llorona", //     +0,68 s  (texto restaurado; ratio 0,98)
  "el-estudiante-universitario", //  +0,49 s
  "il-libro-dell-abisso", //         +0,43 s  (cama de ambiente: 3 pausas en toda la historia)
  //
  // FORMA del error (scripts/_karaokeShape.py, medianas con signo por octavos
  // de historia). No es un corrimiento unico, es un sesgo positivo que oscila:
  //   la-llorona   +2,37 +0,29 +0,71 +0,96 +0,52 +0,18 +0,26 +0,52
  //   control      -0,04 +0,00 -0,10 -0,04 -0,16 -0,13 -0,16 -0,18
  // El alineador se retrasa y recupera una y otra vez. Los 14 peores desvios
  // caen TODOS en los primeros 24 s, en el parrafo de apertura, y ahi el error
  // CRECE de +1,4 a +3,4 dentro del propio parrafo.
  //
  // Ese arranque esta contaminado y hay que descontarlo: el narrador SI lee el
  // titulo (comprobado transcribiendo los primeros 4 s: "La leyenda de la
  // llorona, en un pequeño pueblo de Antioquia"), pero el titulo NO esta en el
  // payload, que es solo el cuerpo. Y whisper, al transcribir el fichero
  // entero, SE COME el titulo y arranca su linea de tiempo en el: da "En" a los
  // 0,20 s, que es justo donde el narrador dice "La". Encima colapsa 8 palabras
  // seguidas en 5,00 s. O sea que en la apertura la regla no vale.
  //
  // Pero descontarla NO salva la historia. Midiendo desde el segundo 30
  // (_karaokeDesde.py) la-llorona pasa de 0,540 a 0,460 y el control se queda
  // clavado en 0,180: la apertura explica 0,08 del hueco, y en TODO el resto
  // sigue siendo 2,5 veces peor que su hermana del mismo libro. Por eso se
  // queda fuera.
  //
  // Causa: sin identificar. Lo que YA NO es (descartado con medicion, no con
  // razonamiento):
  //  - No es el titulo antepuesto. Se realinearon las tres CON y SIN titulo:
  //    el error se mueve 0,01 s. La prueba anterior parecia culparlo, pero se
  //    hizo sobre l-ultimo-respiro, que tiene OTRA averia (la de arriba).
  //  - No son las acotaciones que el narrador no lee ("(riendo suavemente)").
  //    Realineada la-llorona sin ellas: +0,681 -> +0,688. Confirmado ademas que
  //    NO se leen (el match sube de 0,967 a 0,991 al quitarlas), y aun asi da
  //    igual.
  //  - No son datos viejos: realinear hoy desde cero reproduce el error, asi
  //    que no es un residuo del correctAlignmentDrift retirado.
  //  - No es la cama de ambiente. Solo il-libro la tiene; la-llorona tiene 15
  //    pausas en sus primeros 40 s y el mismo suelo de ruido que el control.
  //  - No es que el audio haya cambiado despues de alinear. La duracion
  //    guardada y la del fichero de hoy coinciden dentro de 0,05 s en las
  //    cuatro comprobadas, asi que los timings se midieron sobre ESTE audio.
  //  - No es solo la apertura contaminada: ver el parrafo de la FORMA de
  //    arriba, descontarla deja 0,460 contra 0,180 del control.
  //  - NO es el texto. Comprobado el 2026-07-29 palabra por palabra contra el
  //    manuscrito del libro: identico salvo rayas de dialogo. Esto habia que
  //    mirarlo porque el ratio ~1,00 NO prueba que el texto sea el mismo, solo
  //    que tiene el mismo numero de palabras (il-custode-della-laguna tenia el
  //    nombre de la protagonista cambiado con ratio normal), pero aqui sale
  //    limpio.
  //  - No es el ritmo ni el silencio. 2,51 palabras/s y 25,9% del audio en
  //    silencio, en plena media de las 20 del libro; el-tesoro-escondido tiene
  //    MAS silencio (27,2%) y puntua 0,340.
  //
  // Unica pista viva, por si alguien la quiere seguir: desplazando los tiempos
  // UN token hacia atras el error baja de 0,540 a 0,415 (_karaokeDesplaz.py),
  // mientras que el control empeora con cualquier desplazamiento (0,180 en 0).
  // Puede ser un fallo de indice en el remapeo, o simplemente que un token dura
  // ~0,35 s y el desplazamiento cancela parte del retraso. No se ha distinguido.
  //  - No son las pausas largas (que aeneas podria estar rellenando de
  //    palabras). Correlacion entre segundos en pausas >=0,8 s y error mediano
  //    sobre las 20 del libro: r = 0,19, o sea nada. la-excursion tiene MAS
  //    pausas largas que la-llorona (9,8% del audio contra 7,9%) y puntua
  //    0,190 contra 0,540.
  // El mejor control disponible: las otras 19 historias del MISMO libro, mismo
  // narrador y mismo pipeline puntuan entre 0,160 y 0,340. Sea lo que sea, es
  // de la historia, no del libro ni del proceso.
  //
  // Ojo con la regla al reabrir esto, tiene DOS trampas ya pagadas:
  //  1. El medidor de ffmpeg (distancia de cada arranque de habla a la palabra
  //     mas cercana) NO puede ver un corrimiento, porque con palabras cada
  //     0,3 s siempre encuentra una vecina cerca; da 0,17 s donde whisper da
  //     0,68 s. Hay que emparejar por identidad de palabra.
  //  2. Los primeros segundos NO son medibles en ninguna historia cuyo
  //     narrador lea el titulo: el titulo se oye pero no esta en el payload, y
  //     whisper ademas se lo salta y corre su linea de tiempo. Medir desde el
  //     segundo 30 (_karaokeDesde.py) antes de sacar conclusiones del arranque.

  // Not user-facing today (deprecated / unpublished journeys), listed so they
  // cannot start showing a bad highlight if those journeys are ever opened.
  "una-pizca-de-canela", //        0.76 s, journey "Traveler — Legacy"
  "el-libro-en-voz-alta", //       0.58 s, marked [DEPRECATED]
  "trastevere-camera-quattro", //  0.51 s, journey "Traveler — Test"
]);

export type KaraokeGateResult = { usable: boolean; reason?: string };

/** First words of a text, normalised for comparison. */
function opening(text: string, n = 40): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, n);
}

/**
 * Do these timings actually belong to THIS story?
 *
 * `CatalogStoryAudioTimings` is keyed by slug alone, and slugs are not unique
 * across books: "el-vendedor-ambulante" exists twice, once in the Argentinian
 * book (Mariana, in Buenos Aires) and once in the Colombian one (Diego selling
 * arepas in Bogotá). Two perfectly good stories, one row to hold their timings,
 * so one of the two books would light up words from the other one's script.
 *
 * Comparing the payload's own copy of the text against the story being
 * rendered catches that, and any future collision, without a hardcoded list.
 */
function timingsBelongToStory(payloadText: string, storyPlainText: string): boolean {
  const a = opening(payloadText);
  const b = opening(storyPlainText);
  if (a.length < 8 || b.length < 8) return true; // too little to judge
  const shared = new Set(b);
  const hits = a.filter((w) => shared.has(w)).length;
  return hits / a.length >= 0.6;
}

export function checkKaraokeUsable(
  slug: string | null | undefined,
  payload: Pick<AudioWordTimingsPayload, "words" | "audioDurationSec" | "storyPlainText"> | null,
  storyPlainText?: string | null
): KaraokeGateResult {
  if (!payload) return { usable: false, reason: "no timings" };
  if (
    storyPlainText &&
    typeof payload.storyPlainText === "string" &&
    !timingsBelongToStory(payload.storyPlainText, storyPlainText)
  ) {
    return { usable: false, reason: "these timings belong to a different story with the same slug" };
  }
  if (slug && KARAOKE_BLOCKED_SLUGS.has(slug)) {
    // The specific cause (wrong audio / abridged text / weak alignment) is
    // documented next to each slug in the list above.
    return { usable: false, reason: "measured below the karaoke quality bar" };
  }
  const timed = payload.words.filter((w) => typeof w.startSec === "number").length;
  if (timed === 0) return { usable: false, reason: "no timed words" };

  const duration = payload.audioDurationSec;
  if (typeof duration === "number" && duration > 0) {
    const rate = timed / duration;
    if (rate < MIN_WORDS_PER_SEC) {
      return { usable: false, reason: `only ${rate.toFixed(2)} words/s: the audio says more than the text` };
    }
  }
  return { usable: true };
}
