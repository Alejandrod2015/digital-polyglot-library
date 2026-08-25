import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  InteractionManager,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  formatCefrLevel,
  formatLanguage,
  formatRegion,
  formatVariantLabel,
  formatLevel,
  formatTopic,
  getVocabTypeLabel,
  normalizeVocabType,
  type AudioWordTimingsPayload,
  type Book,
  type Story,
  type StoryWordToken,
  type VocabItem,
  type VocabTypeKey,
} from "@digital-polyglot/domain";
import * as Application from "expo-application";
import * as FileSystem from "expo-file-system/legacy";
import { NativeAudioPlayer } from "./NativeAudioPlayer";
import { RatingSentToast } from "./RatingSentToast";
import {
  hasCloseAskBeenUsed,
  loadRatedStoryVotes,
  markCloseAskUsed,
  markStoryRated,
} from "./storyRatingStorage";
import { DownloadProgressRing } from "./DownloadProgressRing";
import { ProgressiveImage } from "./ProgressiveImage";
import { useAndroidBottomInset } from "./useAndroidBottomInset";
import { getCoverUrl } from "./coverUrl";
import { apiFetch } from "../lib/api";
import { loadCompletedStories, markStoryCompleted } from "../lib/completedStories";
import { mobileConfig } from "../config";
import { extractStoryPlainText } from "../../../../src/lib/storyPlainText";
// MISMO codigo que el lector web, para que el karaoke se comporte igual en
// las dos plataformas: reparto de empates identico y permanencia minima en
// pantalla para las palabras cuya ventana es mas corta que el muestreo.
import {
  buildWordWindows,
  createHighlightStepper,
  findActiveWordIndex,
} from "../../../../src/lib/karaokeWordWindows";

// Piloto tap-any-word: cada palabra FUERA del vocab curado puede tener un
// "quick lookup" gloss ({ g: traducción EN, t?: tipo, r?: register }), servido
// por /api/mobile/tap-glosses por slug. `glossTokenFromText` normaliza el
// texto visible de un token a la key del bundle (minúsculas, sin puntuación),
// igual que `tokenFromText` en TapGlossLayer (web), para que matcheen.
type TapGloss = { g: string; t?: string; r?: string };
function glossTokenFromText(text: string): string {
  const m = text.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u);
  return m ? m[0] : "";
}

/**
 * Busca la glosa de un token, resolviendo las ELISIONES.
 *
 * `glossTokenFromText` corta en el apóstrofo, así que en italiano `l'acqua`
 * buscaba la clave `l` y devolvía "the": tocabas la palabra y te salía el
 * artículo, con `acqua` ("water") inalcanzable aunque esté en el bundle. Los
 * bundles guardan las dos mitades por separado y NINGUNA clave lleva apóstrofo
 * (comprobado: 0 de 1.100 en italiano), así que la elisión dependía entera de
 * la glosa de una letra suelta.
 *
 * Ahora gana la palabra de CONTENIDO, la de después del apóstrofo, y solo si
 * no tiene glosa se cae a la de antes. `l'acqua` da "water"; `un'idea`, "idea".
 */
function lookupGloss(
  glosses: Record<string, TapGloss>,
  text: string
): { token: string; gloss: TapGloss } | null {
  const raw = text.toLowerCase();
  const apostrophe = raw.search(/['’]/);
  if (apostrophe > -1) {
    const tail = glossTokenFromText(raw.slice(apostrophe + 1));
    if (tail && glosses[tail]) return { token: tail, gloss: glosses[tail] };
  }
  const head = glossTokenFromText(text);
  if (head && glosses[head]) return { token: head, gloss: glosses[head] };
  return null;
}

const TITLE_WORD_SPLIT = /(\p{L}+(?:-\p{L}+)*)/u;

// El título también entra en el diccionario. Se renderizaba como un nodo de
// texto suelto, así que ninguna de sus palabras era tapeable aunque su gloss
// existiera. Aquí se trocea y las que tienen gloss se vuelven <Text> con
// onPress, anidados dentro del <Text> del título para no tocar el layout (nada
// de <View> por palabra: eso rompería el centrado y el salto de línea).
// Sin marca de color, igual que en el cuerpo, donde el color queda reservado
// para el vocabulario curado.
function renderTappableTitle(
  title: string,
  glosses: Record<string, TapGloss>,
  onQuickLookup: (word: string, gloss: TapGloss, contextSentence?: string) => void
): React.ReactNode {
  const parts = title.split(TITLE_WORD_SPLIT);
  if (parts.length === 1) return title;
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const hit = lookupGloss(glosses, part);
      const token = hit?.token ?? "";
      const gloss = hit?.gloss;
      if (gloss) {
        return (
          <Text key={`t-${i}`} onPress={() => onQuickLookup(part, gloss, title)}>
            {part}
          </Text>
        );
      }
    }
    return part;
  });
}

type StoryBlock = {
  type: "paragraph" | "quote";
  text: string;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripInlineTags(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function shortenDefinition(input?: string, maxLength = 56): string | undefined {
  if (!input) return undefined;
  const clean = input.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

function shortenContext(input?: string, maxLength = 72): string | undefined {
  if (!input) return undefined;
  const clean = input.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

// Misma etiqueta de hablante que la web (`DIALOGUE_LABEL_REGEX` en
// src/components/StoryContent.tsx): "Nombre:" al principio de línea, con
// clases Unicode para que acepte acentos de cualquier idioma latino.
const SPEAKER_LABEL_RE =
  /^([\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3}):\s+(.*\S)\s*$/u;

/**
 * En una historia de diálogo, CADA turno es un párrafo, lo separe el autor con
 * un salto o con dos.
 *
 * La web ya lo hacía (`detectDialogueBlocks` parte por `\r?\n` a secas) y el
 * móvil no: partía solo por `\n{2,}`, así que un bloque con seis turnos
 * pegados con salto simple se renderizaba como un muro de texto. Ninguna
 * historia PUBLICADA lo sufre hoy (0 de 147: todas separan con doble salto),
 * pero las 21 del journey Hanseat sí, y cualquier historia futura que se
 * escriba con salto simple caería en lo mismo sin avisar.
 *
 * Mismo umbral que la web: si menos del 40% de las líneas parecen turnos, esto
 * es prosa corrida y no se toca, porque ahí el salto simple sí es un salto
 * dentro del mismo párrafo.
 */
function splitDialogueTurns(part: string): string[] {
  const lines = part.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [part];
  const labelled = lines.filter((l) => SPEAKER_LABEL_RE.test(l)).length;
  if (labelled / lines.length < 0.4) return [part];
  return lines;
}

/**
 * Botón "Save word" AISLADO, con su propio estado.
 *
 * Medido en el Pixel con `screenrecord` a 60 fps: del dedo abajo (frame 109) al
 * cambio de etiqueta (frame 136) pasaban **450 ms**, y en medio el botón se
 * quedaba clavado en su estado de pulsado. No era la red ni el disco: era que
 * la etiqueta vivía dentro de `ReaderScreen`, así que tocarla obligaba a
 * reconciliar el componente entero (17 párrafos llenos de píldoras) antes de
 * poder pintar dos palabras.
 *
 * Aislarlo en un `memo` con estado propio es lo único que corta esa cadena: al
 * pulsar solo se vuelve a renderizar este botón. Ni el estado optimista dentro
 * del padre ni `runAfterInteractions` servían, porque el trabajo caro seguía
 * ocurriendo en el mismo árbol.
 *
 * `externalSaved` sigue mandando cuando cambia de palabra o cuando el shell ya
 * reconcilió con el servidor; el estado interno solo cubre el hueco entre el
 * toque y esa reconciliación.
 */
const SaveWordButton = memo(function SaveWordButton({
  word,
  saved,
  onToggle,
}: {
  word: string;
  saved: boolean;
  onToggle: (desiredSaved: boolean) => void;
}) {
  /**
   * El botón responde con estado PROPIO y el guardado sale del frame del toque.
   *
   * Medido en el Pixel con screenrecord a 60 fps, y por eliminación:
   *   - botón de guardar HISTORIA ................  50 ms
   *   - este botón, tal cual estaba ..............  400 ms
   *   - con Animated.View fuera ..................  383 ms
   *   - reducido a la forma EXACTA del de historia  433 ms
   *   - con el guardado fuera del frame ..........   17 ms
   *
   * O sea: la forma del botón nunca tuvo nada que ver. Lo caro es lo que el
   * toggle DISPARA. Guardar una historia cambia un booleano que solo lee el
   * icono del top bar; guardar una palabra muta la lista de favoritos, y de
   * ella depende el resaltado de TODO el cuerpo, así que el lector entero se
   * reconstruye antes de poder repintar dos palabras.
   *
   * `setTimeout(..., 0)` basta: deja pintar el frame del toque y mete el
   * trabajo caro en el siguiente tick. `runAfterInteractions` NO servía porque
   * espera además a que terminen las animaciones en curso.
   *
   * Lo correcto de fondo es que la lista de favoritos no invalide el cuerpo,
   * pero eso es cirugía sobre el karaoke y el resaltado; esto quita los 400 ms
   * hoy sin tocar nada de eso.
   */
  const [local, setLocal] = useState<boolean | null>(null);
  useEffect(() => { setLocal(null); }, [word]);
  // El pop vuelve. Con `useNativeDriver` la animación vive en el hilo de UI, no
  // en el de JS, así que no compite con nada: medido, quitarla solo movía la
  // latencia de 400 a 383 ms, o sea nada. Lo que costaba era el toggle.
  const scale = useRef(new Animated.Value(1)).current;
  // A PROPOSITO idéntico en forma al botón de guardar historia del top bar,
  // que mide 50 ms: Pressable pelado, sin estado local, sin Animated, sin
  // InteractionManager, y el estado visual viene de una prop. El de palabra
  // medía 383 ms con todo eso encima. Experimento binario para saber si la
  // culpa está en el botón o en dónde vive.
  const shown = local ?? saved;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <Pressable
      onPress={() => {
        const next = !shown;
        setLocal(next);
        if (next) {
          Animated.sequence([
            Animated.spring(scale, { toValue: 1.12, friction: 4, tension: 180, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
          ]).start();
        }
        // Se manda el estado de DESTINO, no "invierte lo que haya". Dos toques
        // seguidos ya no pueden anadir dos veces ni dejar el boton diciendo una
        // cosa y la lista otra: el shell lleva la palabra a este estado y punto.
        setTimeout(() => onToggle(next), 0);
      }}
      accessibilityLabel={saved ? "Remove from saved words" : "Save word"}
      hitSlop={6}
      // Sin estilo de "pulsado": el usuario no quiere que el fondo cambie de
      // tono mientras el dedo esta encima (opacity 0.85). El feedback ya lo dan
      // el pop y el cambio de color guardado/no guardado, que es lo que pidio.
      style={[styles.vocabAction, shown ? styles.vocabActionActive : null]}
    >
      <MaterialCommunityIcons
        name={shown ? "heart" : "heart-plus-outline"}
        size={16}
        color={shown ? "#0e1727" : "#ffffff"}
      />
      <Text style={[styles.vocabActionText, shown ? styles.vocabActionTextActive : null]}>
        {shown ? "Saved" : "Save word"}
      </Text>
    </Pressable>
    </Animated.View>
  );
});

function toBlocks(text: string | null | undefined): StoryBlock[] {
  // Defensa: aunque el tipado dice `string`, en runtime puede llegar
  // undefined (selection construida desde una story sin `text`
  // populated). Antes esto crasheaba en el `text.replace` de abajo.
  if (typeof text !== "string" || text.length === 0) return [];
  const blocks: StoryBlock[] = [];
  const blockRegex = /<(p|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null = blockRegex.exec(text);

  while (match) {
    const type = match[1] === "blockquote" ? "quote" : "paragraph";
    const cleaned = stripInlineTags(match[2] ?? "");
    if (cleaned) {
      blocks.push({ type, text: cleaned });
    }
    match = blockRegex.exec(text);
  }

  if (blocks.length > 0) return blocks;

  return text
    .replace(/<[^>]+>/g, "\n")
    .split(/\n{2,}/)
    .flatMap((part) => splitDialogueTurns(part))
    .map((part) => stripInlineTags(part))
    .filter(Boolean)
    .map((part) => ({ type: "paragraph" as const, text: part }));
}

// MISMO tope que la web (src/components/StoryContent.tsx). Estaba en 30, el
// valor de la era journeys (~22 entradas por historia); con el catálogo a
// ~10 entradas por cada 100 palabras una historia llega a 82, así que el
// móvil se comía más de la mitad de las píldoras sin avisar. El límite que
// de verdad protege es MAX_REGEX_SOURCE_LENGTH; este es la red de seguridad.
const MAX_HIGHLIGHT_WORDS = 90;
const MAX_HIGHLIGHT_WORD_LENGTH = 48;
const MAX_HIGHLIGHT_WORD_TOKENS = 4;
const MAX_REGEX_SOURCE_LENGTH = 1400;
const MAX_TEXT_LENGTH_FOR_HIGHLIGHT = 25000;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeVocabForHighlight(vocab: VocabItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of vocab) {
    const raw =
      typeof item?.surface === "string" && item.surface.trim()
        ? item.surface.trim()
        : typeof item?.word === "string"
          ? item.word.trim()
          : "";

    if (!raw) continue;
    if (raw.length < 3 || raw.length > MAX_HIGHLIGHT_WORD_LENGTH) continue;
    if (/[<>[\]{}]/.test(raw)) continue;
    const tokenCount = raw.split(/\s+/).filter(Boolean).length;
    if (tokenCount > MAX_HIGHLIGHT_WORD_TOKENS) continue;

    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= MAX_HIGHLIGHT_WORDS) break;
  }

  return out;
}

function renderHighlightedParagraph(
  text: string,
  vocab: VocabItem[],
  paragraphKey: string,
  onWordPress: (word: VocabItem, contextSentence?: string) => void,
  variant: "paragraph" | "quote" = "paragraph",
  // Set compartido a nivel de historia: cada palabra del vocab se
  // resalta SOLO la primera vez que aparece en todo el texto. Si no
  // se pasa, hacemos fallback a un Set local (dedup por párrafo) para
  // no romper otros call sites que aún no se hayan migrado.
  alreadyHighlightedShared?: Set<string>
) {
  const baseTextStyle = variant === "quote" ? styles.quoteParagraph : styles.paragraph;

  if (!text || text.length > MAX_TEXT_LENGTH_FOR_HIGHLIGHT) {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  const cleanWords = normalizeVocabForHighlight(vocab);
  if (cleanWords.length === 0) {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  const uniqueWords = Array.from(new Set(cleanWords.map((word) => word.trim())));
  const canonicalByLower = new Map(uniqueWords.map((word) => [word.toLowerCase(), word] as const));
  const alternatives = [...uniqueWords].sort((a, b) => b.length - a.length).map(escapeRegex);
  if (alternatives.length === 0) {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  const regexSource = alternatives.join("|");
  if (regexSource.length > MAX_REGEX_SOURCE_LENGTH) {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  let regex: RegExp;
  try {
    regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${regexSource})(?=$|[^\\p{L}\\p{N}_])`, "giu");
  } catch {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  const alreadyHighlighted = alreadyHighlightedShared ?? new Set<string>();
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  let key = 0;

  while (match) {
    const leading = match[1] ?? "";
    const matchedText = match[2] ?? "";
    const start = match.index + leading.length;
    const end = start + matchedText.length;

    if (start > lastIndex) {
      const before = text.slice(lastIndex, start);
      if (before) {
        nodes.push(
          <Text key={`${paragraphKey}-txt-${key++}`} style={baseTextStyle}>
            {before}
          </Text>
        );
      }
    }

    const canonical = canonicalByLower.get(matchedText.toLowerCase()) ?? matchedText;
    const canonicalKey = canonical.toLowerCase();
    const vocabItem =
      vocab.find((item) => {
        const word = item.word?.trim().toLowerCase();
        const surface = item.surface?.trim().toLowerCase();
        return word === canonicalKey || surface === canonicalKey;
      }) ?? null;

    // Una palabra de vocab se muestra con pill de color SOLO la primera
    // vez que aparece en la historia; pero TODA aparición sigue siendo
    // tapeable (idéntico al motor karaoke). Antes la repetición perdía el
    // onPress y quedaba como texto muerto.
    const isFirstHighlight = !!vocabItem && !alreadyHighlighted.has(canonicalKey);
    if (vocabItem && !alreadyHighlighted.has(canonicalKey)) {
      alreadyHighlighted.add(canonicalKey);
    }

    if (isFirstHighlight) {
      // Primera aparición: wrapper two-layer y styles IDÉNTICOS al path
      // karaoke (`karaokeWordOuter` + `karaokeWordContainerVocab` +
      // `karaokeWordTextVocabWhite`). Así cuando wordTimings carga y el
      // render salta de legacy → karaoke, el pill no cambia ni posición ni
      // color de texto: la transición es 0-frames visible. El texto se
      // mantiene BLANCO sobre cyan (lo que karaoke ya hacía).
      nodes.push(
        <View
          key={`${paragraphKey}-voc-${key++}`}
          style={styles.karaokeWordOuter}
        >
          <View style={styles.karaokeWordContainerVocab}>
            <Text
              style={styles.karaokeWordTextVocabWhite}
              onPress={vocabItem ? () => onWordPress(vocabItem, text) : undefined}
            >
              {matchedText}
            </Text>
          </View>
        </View>
      );
    } else if (vocabItem) {
      // Repetición de una palabra de vocab: se ve como texto normal (el
      // pill de color se muestra solo la 1a vez) pero SIGUE siendo
      // tapeable. Un <Text> inline con onPress (sin el <View> wrapper) no
      // altera la métrica de línea del párrafo, así que no toca el layout
      // de los pills existentes.
      nodes.push(
        <Text
          key={`${paragraphKey}-voc-${key++}`}
          style={baseTextStyle}
          onPress={() => onWordPress(vocabItem, text)}
        >
          {matchedText}
        </Text>
      );
    } else {
      // Palabra fuera del vocab: texto plano, no tapeable.
      nodes.push(
        <Text
          key={`${paragraphKey}-voc-${key++}`}
          style={baseTextStyle}
        >
          {matchedText}
        </Text>
      );
    }

    lastIndex = end;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    if (tail) {
      nodes.push(
        <Text key={`${paragraphKey}-tail-${key++}`} style={baseTextStyle}>
          {tail}
        </Text>
      );
    }
  }

  return <Text style={baseTextStyle}>{nodes.length > 0 ? nodes : text}</Text>;
}

// === Karaoke (word-level audio highlight) helpers ====================
// Opt-in render path used only when a JourneyStory has audioWordTimings
// populated. The legacy renderHighlightedParagraph above is unchanged
// and still drives every other story.

type KaraokeParagraph = {
  text: string;
  charStart: number;
  charEnd: number;
};

/**
 * Tokeniza un texto plano en words sin tiempos. Usado como fallback
 * mientras el endpoint de wordTimings reales (con startSec/endSec)
 * carga del backend, o cuando la story no los tiene. Sin esto, el
 * reader caía a `renderHighlightedParagraph` (highlights vocab
 * simples sin la estructura de karaoke) durante el primer paint y
 * se notaba un flash de medio segundo cuando los tiempos llegaban
 * y el render saltaba al karaoke completo. Con este fallback el
 * render karaoke se ejecuta SIEMPRE desde el primer paint; la
 * única diferencia con los tiempos reales es que activeWordIndex
 * permanece null hasta que llegan, pero eso solo importa cuando
 * el audio empieza a reproducirse.
 */
function buildSyntheticWordTimings(plainText: string): AudioWordTimingsPayload {
  const words: StoryWordToken[] = [];
  const regex = /[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu;
  let match: RegExpExecArray | null = regex.exec(plainText);
  while (match) {
    const text = match[0];
    const charStart = match.index;
    const charEnd = charStart + text.length;
    words.push({ text, charStart, charEnd, startSec: null, endSec: null });
    match = regex.exec(plainText);
  }
  return {
    version: 1,
    audioDurationSec: null,
    storyPlainText: plainText,
    words,
  };
}

/**
 * Encuentra los rangos de caracteres que corresponden a etiquetas
 * "Speaker:" al inicio de línea en historias multi-voz (Café in
 * Kreuzberg, Carnitas en Coyoacán, etc.). El TTS no pronuncia esos
 * nombres (los strippea antes de sintetizar), pero aeneas los alinea
 * contra el texto plano y les asigna timestamps espurios. Usado para
 * filtrar tokens del karaoke y que "Anna", "Don Felipe", etc. nunca
 * se resalten durante la reproducción.
 *
 * Anclado a inicio de línea + colon + espacio para no confundir con
 * dos puntos en medio de la prosa ("Le dijo: ya vámonos").
 */
function findSpeakerLabelRanges(plainText: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const regex =
    /^([A-ZÄÖÜÁÉÍÓÚÑ][A-Za-zÄÖÜäöüßÁÉÍÓÚÑáéíóúñ.'-]*(?:\s+[A-ZÄÖÜÁÉÍÓÚÑ][A-Za-zÄÖÜäöüßÁÉÍÓÚÑáéíóúñ.'-]*){0,3})(?=:\s)/gmu;
  let match: RegExpExecArray | null = regex.exec(plainText);
  while (match) {
    const start = match.index;
    const end = match.index + match[1].length;
    ranges.push({ start, end });
    match = regex.exec(plainText);
  }
  return ranges;
}

/**
 * Devuelve un payload con los tokens de etiquetas de speaker
 * filtrados. Conservamos `storyPlainText` intacto para que el
 * renderer siga mostrando "Anna: " como gap-fill (texto inerte), pero
 * el array `words` ya no incluye esos tokens; y por tanto el
 * highlight nunca aterriza en ellos. Idempotente: si la historia no
 * es dialogue, retorna el payload original.
 */
function withoutSpeakerTokens(payload: AudioWordTimingsPayload): AudioWordTimingsPayload {
  const ranges = findSpeakerLabelRanges(payload.storyPlainText);
  if (ranges.length === 0) return payload;
  const filtered = payload.words.filter((w) => {
    for (const r of ranges) {
      if (w.charStart >= r.start && w.charEnd <= r.end) return false;
    }
    return true;
  });
  if (filtered.length === payload.words.length) return payload;
  return { ...payload, words: filtered };
}

function splitKaraokeParagraphs(plainText: string): KaraokeParagraph[] {
  const out: KaraokeParagraph[] = [];
  if (!plainText) return out;
  // The Studio's `extractStoryPlainText` collapses paragraph boundaries
  // to a single `\n`, so we split on any run of newlines (one or more)
  // to recover them. Without this, the entire story renders as one
  // visually flat block on the iPhone reader.
  const regex = /[^\n]+/g;
  let match: RegExpExecArray | null = regex.exec(plainText);
  while (match) {
    const raw = match[0];
    const charStart = match.index;
    const charEnd = charStart + raw.length;
    out.push({ text: raw, charStart, charEnd });
    match = regex.exec(plainText);
  }
  return out;
}

function stripDiacritics(value: string): string {
  // NFD decomposes accented characters into base + combining marks; we
  // then drop the combining marks (\p{M}) so "café" → "cafe", "über" →
  // "uber", "niño" → "nino". Lets the matcher accept either form when
  // the LLM-generated story and the vocab list happen to disagree on
  // accent placement (a real source of missed highlights).
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

// German nominal forms are usually registered as "der Hund" / "die
// Katze" / "das Auto" in the vocab list, but the story body uses the
// noun bare ("Hund", "Katze") and inflected ("Hunde", "Katzen"). We
// also strip plural / indefinite articles. Idempotent for non-DE
// vocab (no prefix to strip).
function stripGermanArticle(value: string): string {
  return value.replace(
    /^(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s+/i,
    ""
  );
}

function buildVocabLookup(vocab: VocabItem[]): Map<string, VocabItem> {
  const map = new Map<string, VocabItem>();
  const register = (key: string, item: VocabItem) => {
    const k = key.toLowerCase().trim();
    if (!k) return;
    // First registration wins: an earlier vocab entry's primary form
    // should not be hijacked by a later entry's variant key, otherwise
    // a noun in the text could end up displaying the definition of a
    // homograph from later in the list.
    if (!map.has(k)) map.set(k, item);
  };
  for (const item of vocab) {
    const surface = typeof item.surface === "string" ? item.surface.trim() : "";
    const word = typeof item.word === "string" ? item.word.trim() : "";
    for (const primary of [surface, word]) {
      if (!primary) continue;
      register(primary, item);
      const stripped = stripDiacritics(primary);
      if (stripped !== primary) register(stripped, item);
      const noArticle = stripGermanArticle(primary);
      if (noArticle !== primary) {
        register(noArticle, item);
        const noArticleStripped = stripDiacritics(noArticle);
        if (noArticleStripped !== noArticle) register(noArticleStripped, item);
      }
    }
  }
  return map;
}

/**
 * Token → VocabItem with light-weight variant matching beyond exact
 * lookup. Order: exact lowercase → accent-stripped → drop trailing
 * "-s" (regular ES/IT/PT/EN plural) → drop trailing "-es" (regular
 * Spanish plural, e.g. "papeles" → "papel"). Each fallback also tries
 * the accent-stripped form. Returns null when nothing matches so the
 * renderer falls through to the plain-text path.
 *
 * Conservative on purpose: no verb conjugation lemmatization, no
 * German umlaut + plural transforms. Those would need a real
 * morphological analyzer to avoid false positives, which is beyond
 * what we can do on-device.
 */
function lookupVocabToken(
  lookup: Map<string, VocabItem>,
  token: string
): VocabItem | null {
  if (!token) return null;
  const lower = token.toLowerCase();
  const exact = lookup.get(lower);
  if (exact) return exact;
  const stripped = stripDiacritics(lower);
  if (stripped !== lower) {
    const strippedHit = lookup.get(stripped);
    if (strippedHit) return strippedHit;
  }
  if (lower.length > 3 && lower.endsWith("s")) {
    const singular = lower.slice(0, -1);
    const singularHit = lookup.get(singular) ?? lookup.get(stripDiacritics(singular));
    if (singularHit) return singularHit;
    if (lower.length > 4 && lower.endsWith("es")) {
      const singularEs = lower.slice(0, -2);
      const singularEsHit =
        lookup.get(singularEs) ?? lookup.get(stripDiacritics(singularEs));
      if (singularEsHit) return singularEsHit;
    }
  }
  return null;
}

// Longest multi-word vocab surface starting at word index `start`. The
// per-token `lookupVocabToken` can never match a surface like "se sirven",
// "le encantó", "en voz baja" or "no paró de" because it only sees one
// token at a time; so those reflexive verbs and idiomatic expressions
// silently never render as pills. Here we join consecutive token texts
// with single spaces and probe the lookup (which already registers the
// full multi-word surface/word as a key in buildVocabLookup), greedy
// longest-first so "en voz baja" wins over any shorter prefix. Returns
// the matched item plus the exclusive end index of the span, or null.
function matchVocabPhrase(
  lookup: Map<string, VocabItem>,
  words: StoryWordToken[],
  start: number,
  endExclusive: number,
  maxTokens: number
): { item: VocabItem; spanEnd: number } | null {
  const cap = Math.min(endExclusive, start + maxTokens);
  for (let end = cap; end >= start + 2; end -= 1) {
    const joined = words
      .slice(start, end)
      .map((w) => w.text)
      .join(" ")
      .toLowerCase();
    const hit = lookup.get(joined) ?? lookup.get(stripDiacritics(joined));
    if (hit) return { item: hit, spanEnd: end };
  }
  return null;
}

// Largest token count across any multi-word key in the lookup, so the
// phrase matcher knows how far ahead to probe. Single-word lookups
// return 1 (phrase matching is then a no-op).
function maxPhraseTokenSpan(lookup: Map<string, VocabItem>): number {
  let max = 1;
  for (const key of lookup.keys()) {
    if (!key.includes(" ")) continue;
    const n = key.split(/\s+/).length;
    if (n > max) max = n;
  }
  return max;
}

// Vocab pill background per grammatical type. Each color is a saturated
// hue at moderate opacity so white bold text reads cleanly on top, and
// the hues are spread across the wheel so a paragraph with mixed parts
// of speech displays a clear visual key. Active highlight on a vocab
// word INTENTIONALLY does NOT override these; vocab keeps its type
// color throughout playback so the grammar signal stays stable.
const VOCAB_TYPE_BACKGROUNDS: Record<VocabTypeKey, string> = {
  verb: "rgba(248, 113, 113, 0.6)", // coral; action
  noun: "rgba(56, 189, 248, 0.65)", // sky; entity
  adjective: "rgba(52, 211, 153, 0.6)", // emerald; quality
  adverb: "rgba(167, 139, 250, 0.65)", // purple; modifier
  pronoun: "rgba(251, 191, 36, 0.6)", // amber; reference
  preposition: "rgba(45, 212, 191, 0.6)", // teal; relation
  conjunction: "rgba(129, 140, 248, 0.6)", // indigo; connector
  article: "rgba(100, 116, 139, 0.6)", // steel; determiner
  number: "rgba(190, 220, 80, 0.55)", // lime; quantity
  expression: "rgba(244, 114, 182, 0.6)", // pink; idiomatic
  other: "rgba(148, 163, 184, 0.55)", // slate; neutral fallback
};

function vocabBackgroundForItem(item: VocabItem | null | undefined): string {
  if (!item) return VOCAB_TYPE_BACKGROUNDS.other;
  const key = normalizeVocabType(item.type, {
    word: item.word,
    definition: item.definition,
  });
  return VOCAB_TYPE_BACKGROUNDS[key ?? "other"];
}

function renderKaraokeParagraph(args: {
  paragraph: KaraokeParagraph;
  payloadText: string;
  words: StoryWordToken[];
  activeWordIndex: number | null;
  vocabLookup: Map<string, VocabItem>;
  paragraphKey: string;
  onWordPress: (item: VocabItem, contextSentence?: string) => void;
  variant: "paragraph" | "quote";
  // Shared across all paragraphs of the story: a vocab word only renders
  // as a pill the first time it shows up. Mirrors the legacy reader's
  // dedup logic so karaoke stories don't look denser than non-karaoke
  // ones for the same vocab list.
  alreadyHighlighted: Set<string>;
  // Piloto tap-any-word: glosses "quick lookup" por palabra (fuera del vocab
  // curado). Cualquier palabra NO-vocab cuyo token esté en `glosses` se
  // vuelve tapeable y dispara `onQuickLookup` con su traducción.
  glosses: Record<string, TapGloss>;
  onQuickLookup: (word: string, gloss: TapGloss, contextSentence?: string) => void;
}) {
  const {
    paragraph,
    payloadText,
    words,
    activeWordIndex,
    vocabLookup,
    paragraphKey,
    onWordPress,
    variant,
    alreadyHighlighted,
    glosses,
    onQuickLookup,
  } = args;
  const baseTextStyle = variant === "quote" ? styles.quoteParagraph : styles.paragraph;

  // Find the slice of words[] that lives inside this paragraph's char range.
  // words are ordered by charStart so we can scan linearly.
  let firstWordIdx = -1;
  let lastWordIdx = -1;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w.charStart >= paragraph.charStart && w.charEnd <= paragraph.charEnd) {
      if (firstWordIdx === -1) firstWordIdx = i;
      lastWordIdx = i;
    } else if (w.charStart >= paragraph.charEnd) {
      break;
    }
  }

  if (firstWordIdx === -1) {
    return <Text style={baseTextStyle}>{paragraph.text}</Text>;
  }

  // Android takes a separate render path from the iOS one below. The iOS path
  // wraps every word in a <View> nested inside the paragraph <Text> (an
  // NSTextAttachment technique) which Android can't lay out (many inline <View>s
  // collapse) and can't round (an inline <Text> background has no borderRadius).
  // So Android renders the paragraph as a flex-wrap row of per-word chips; see
  // the block for details.
  if (Platform.OS === "android") {
    // Android can't round an inline <Text> background (iOS/web can), so pills
    // rendered as 90-degree rectangles. Render the paragraph as a flex-wrap row
    // of per-word "chips": each word is its own <View>, so a vocab/active pill
    // carries a real borderRadius like iOS. The inter-word space becomes
    // marginRight; trailing punctuation attaches to its word so a comma/period
    // never orphans to a new line.
    const SPACE = 7;
    const LINE_GAP = 6;
    const plainStyle = { fontSize: 20, lineHeight: 26, color: "#eef4ff" } as const;
    const chips: React.ReactNode[] = [];
    let keyA = 0;

    const pushPlainRun = (text: string) => {
      for (const part of text.split(/\s+/)) {
        if (!part) continue;
        chips.push(
          <View
            key={`${paragraphKey}-cg-${keyA++}`}
            style={{ marginRight: SPACE, marginBottom: LINE_GAP }}
          >
            <Text style={plainStyle}>{part}</Text>
          </View>
        );
      }
    };

    // Leading gap before the first spoken word (e.g. a "Nadia:" speaker label,
    // whose token is filtered out of words[]). Rendered as inert plain chips.
    const leadGap = payloadText
      .slice(paragraph.charStart, words[firstWordIdx].charStart)
      .replace(/\n/g, " ");
    // El hueco inicial (una comilla de apertura, un `¿`) se pega a la primera
    // palabra en vez de ir en su propio chip: como chip suelto arrastraba el
    // marginRight y en pantalla salía `" Hola,` con un espacio dentro.
    let pendingPrefix = "";
    const leadTrim = leadGap.trim();
    if (leadTrim) {
      if (/^[\p{L}\p{N}]/u.test(leadTrim)) pushPlainRun(leadTrim);
      else pendingPrefix = leadTrim;
    }

    const maxPhraseA = maxPhraseTokenSpan(vocabLookup);
    let iA = firstWordIdx;
    while (iA <= lastWordIdx) {
      const w = words[iA];

      const prefijo = pendingPrefix;
      pendingPrefix = "";
      let surface = w.text;
      let unitEnd = iA + 1;
      let lastCharEnd = w.charEnd;
      // Every word is the SAME <View><Text> structure; only these vary. Plain
      // and active share padding 0 and identical text metrics, so the karaoke
      // highlight toggling on/off a word NEVER changes its footprint (no line
      // reflow while reading). Only the permanent vocab pill is padded.
      let bg = "transparent";
      let padH = 0;
      let padV = 0;
      let textColor = "#eef4ff";
      let bold = false;
      let onPress: (() => void) | undefined;

      const phrase =
        maxPhraseA > 1
          ? matchVocabPhrase(vocabLookup, words, iA, lastWordIdx + 1, maxPhraseA)
          : null;
      if (phrase) {
        const canon = (phrase.item.word ?? "").toLowerCase();
        const lastTok = words[phrase.spanEnd - 1];
        surface = payloadText.slice(w.charStart, lastTok.charEnd).replace(/\n/g, " ");
        unitEnd = phrase.spanEnd;
        lastCharEnd = lastTok.charEnd;
        const firstHit = !!canon && !alreadyHighlighted.has(canon);
        if (firstHit) {
          alreadyHighlighted.add(canon);
          bg = vocabBackgroundForItem(phrase.item);
          padH = 5;
          padV = 1;
          textColor = "#ffffff";
          bold = true;
        }
        onPress = () => onWordPress(phrase.item, paragraph.text);
      } else {
        const isActive = activeWordIndex === iA;
        const vocabItem = lookupVocabToken(vocabLookup, w.text);
        const vocabKey = vocabItem ? (vocabItem.word ?? w.text).toLowerCase() : null;
        const firstVocab = vocabKey !== null && !alreadyHighlighted.has(vocabKey);
        if (firstVocab && vocabKey !== null) alreadyHighlighted.add(vocabKey);
        if (firstVocab && vocabItem) {
          // Vocab pill: type color + white bold, padded (permanent, like iOS).
          bg = vocabBackgroundForItem(vocabItem);
          padH = 5;
          padV = 1;
          textColor = "#ffffff";
          bold = true;
        } else if (isActive) {
          // Active karaoke word: amber + dark navy, but TIGHT (padding 0) so
          // toggling the highlight never resizes the word or shifts the line.
          bg = "#f8c15c";
          textColor = "#0e1727";
        }
        if (vocabItem) onPress = () => onWordPress(vocabItem, paragraph.text);
        else {
          const hit = lookupGloss(glosses, w.text);
          const glossToken = hit?.token ?? "";
          const gloss = hit?.gloss;
          if (gloss) onPress = () => onQuickLookup(w.text, gloss, paragraph.text);
        }
      }

      // Trailing gap: attach leading punctuation ("," ".") to this word and
      // turn a trailing space into the chip's right margin.
      //
      // El hueco puede llevar puntuación a AMBOS lados del espacio:
      // `Irene. "Buenas"` deja `. "` entre las dos palabras. Quedarse solo con
      // el primer bloque (`.`) tiraba lo de después, así que en el Pixel se
      // perdía la comilla de apertura del segundo entrecomillado y el `¿` de
      // las preguntas (`escalón. "¿Tú` -> `escalón. Tú`). Lo que va tras el
      // espacio se guarda y se pega DELANTE de la siguiente palabra.
      const nextStart = unitEnd <= lastWordIdx ? words[unitEnd].charStart : paragraph.charEnd;
      const trailGap = payloadText.slice(lastCharEnd, nextStart).replace(/\n/g, " ");
      // La puntuación de cierre (, . ; : ! ? » ") LIGA A LA IZQUIERDA y va con
      // esta palabra aunque el hueco empiece por espacio; si no, salía
      // `copal ,y`. La de apertura (¿ ¡ « " ( ) liga a la derecha y se guarda
      // para la palabra siguiente.
      // La comilla recta es ambigua: abre y cierra igual. Lo que la desambigua
      // es el ESPACIO. `Irene. "Buenas"` deja el hueco `. "`: el punto va
      // pegado a la palabra y cierra; la comilla viene tras un espacio y abre,
      // así que va con la siguiente. Sin esto salía `Irene." Buenas"`.
      const SOLO_CIERRE = /^[,.;:!?]+$/;   // nunca comillas ni paréntesis
      const trozos = trailGap.split(/\s+/).filter(Boolean);
      const pegadoALaPalabra = trozos.length > 0 && !/^\s/.test(trailGap);
      let punct = "";
      let prefijoSiguiente = "";
      trozos.forEach((t, idx) => {
        const cierraSeguro = idx === 0 && pegadoALaPalabra;
        if ((cierraSeguro || SOLO_CIERRE.test(t)) && !prefijoSiguiente) punct += t;
        else prefijoSiguiente += t;
      });
      const hasSpace = /\s/.test(trailGap) || prefijoSiguiente === "";
      pendingPrefix = prefijoSiguiente;

      // Uniform structure for every word: <View><Text>. Only bg/padding/color
      // vary. Plain and active are identical in size (padding 0, lineHeight 26),
      // so the karaoke highlight is a pure background swap with no reflow.
      const wordNode = (
        <View
          style={{
            borderRadius: 6,
            paddingHorizontal: padH,
            paddingVertical: padV,
            backgroundColor: bg,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              lineHeight: 26,
              color: textColor,
              fontWeight: bold ? ("700" as const) : ("400" as const),
            }}
          >
            {prefijo}{surface}
          </Text>
        </View>
      );

      const rowStyle = {
        flexDirection: "row" as const,
        alignItems: "baseline" as const,
        marginRight: hasSpace ? SPACE : 0,
        marginBottom: LINE_GAP,
      };
      const body = (
        <>
          {wordNode}
          {punct ? <Text style={plainStyle}>{punct}</Text> : null}
        </>
      );
      chips.push(
        onPress ? (
          <Pressable
            key={`${paragraphKey}-cw-${iA}`}
            onPress={onPress}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            style={rowStyle}
          >
            {body}
          </Pressable>
        ) : (
          <View key={`${paragraphKey}-cw-${iA}`} style={rowStyle}>
            {body}
          </View>
        )
      );

      iA = unitEnd;
    }

    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" }}>
        {chips}
      </View>
    );
  }

  const nodes: React.ReactNode[] = [];
  // Prepend a zero-width Text node so the line's first inline element
  // is always plain text. Without this, when the active/vocab pill
  // <View> ends up first on a line, iOS computes the line height from
  // the View's inner lineHeight (20) instead of the paragraph's (40),
  // and the whole paragraph visibly collapses. The ZWSP carries the
  // baseTextStyle line metrics so the line is anchored at 40px before
  // any pill enters.
  nodes.push(
    <Text key={`${paragraphKey}-anchor`} style={baseTextStyle}>
      {"​"}
    </Text>
  );
  let cursor = paragraph.charStart;
  let key = 0;
  const maxPhrase = maxPhraseTokenSpan(vocabLookup);

  let i = firstWordIdx;
  while (i <= lastWordIdx) {
    const w = words[i];
    if (w.charStart > cursor) {
      const gap = payloadText.slice(cursor, w.charStart).replace(/\n/g, " ");
      if (gap) {
        // La puntuación (comas/puntos) vive en estos "gaps" entre palabras.
        // Si el gap se renderiza como <Text> suelto, en Android se sienta en
        // la baseline mientras las palabras (envueltas en <View> inline)
        // cuelgan por su borde inferior: la puntuación queda visiblemente más
        // abajo que el texto. Fix: separamos los espacios (siguen como <Text>
        // para que el salto de línea ocurra en ellos) de los tramos de
        // puntuación, y a estos los envolvemos en la MISMA estructura de
        // <View> que las palabras, para que cuelguen idéntico y queden
        // alineados con el texto.
        const gapParts = gap.match(/\s+|\S+/g) ?? [gap];
        for (const part of gapParts) {
          if (/^\s+$/.test(part)) {
            nodes.push(
              <Text key={`${paragraphKey}-gap-${key++}`} style={baseTextStyle}>
                {part}
              </Text>
            );
          } else {
            nodes.push(
              <View
                key={`${paragraphKey}-gap-${key++}`}
                style={styles.karaokeWordOuter}
              >
                <View style={styles.karaokeWordContainerPlain}>
                  <Text style={styles.karaokeWordText}>{part}</Text>
                </View>
              </View>
            );
          }
        }
      }
    }

    // Multi-word vocab span first (reflexive verbs, idiomatic expressions
    // like "se sirven", "le encantó", "en voz baja", "no paró de"). The
    // per-token lookup below can never match these, so without this probe
    // they silently never render as pills. Greedy longest-first; renders
    // the whole surface as one pill so the expression reads as a unit.
    if (maxPhrase > 1) {
      const phrase = matchVocabPhrase(vocabLookup, words, i, lastWordIdx + 1, maxPhrase);
      if (phrase) {
        const canon = (phrase.item.word ?? "").toLowerCase();
        const firstTok = words[i];
        const lastTok = words[phrase.spanEnd - 1];
        const spanText = payloadText
          .slice(firstTok.charStart, lastTok.charEnd)
          .replace(/\n/g, " ");
        // Pill de color solo la 1a vez; la repetición se ve plana pero
        // sigue siendo tapeable (antes hacía fall-through a tokens sueltos
        // que, al no estar en el vocab individualmente, quedaban muertos).
        const isFirstPhraseHit = !!canon && !alreadyHighlighted.has(canon);
        if (isFirstPhraseHit) alreadyHighlighted.add(canon);
        nodes.push(
          <Pressable
            key={`${paragraphKey}-ph-${i}`}
            style={styles.karaokeWordOuter}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            onPress={() => onWordPress(phrase.item, paragraph.text)}
          >
            <View
              style={
                isFirstPhraseHit
                  ? [
                      styles.karaokeWordContainerVocab,
                      { backgroundColor: vocabBackgroundForItem(phrase.item) },
                    ]
                  : styles.karaokeWordContainerPlain
              }
            >
              <Text
                style={
                  isFirstPhraseHit
                    ? styles.karaokeWordTextVocabWhite
                    : styles.karaokeWordText
                }
              >
                {spanText}
              </Text>
            </View>
          </Pressable>
        );
        cursor = lastTok.charEnd;
        i = phrase.spanEnd;
        continue;
      }
    }

    const isActive = activeWordIndex === i;
    const vocabItem = lookupVocabToken(vocabLookup, w.text);
    const vocabKey = vocabItem ? (vocabItem.word ?? w.text).toLowerCase() : null;
    const isFirstVocabHit = vocabKey !== null && !alreadyHighlighted.has(vocabKey);
    if (isFirstVocabHit && vocabKey !== null) alreadyHighlighted.add(vocabKey);

    // EVERY karaoke word is wrapped in the same inline <View> structure
    // from the first render. Only the View's backgroundColor varies as
    // the active highlight moves through. Because the View tree never
    // changes shape, iOS NSTextAttachment kerning is baked into the
    // layout once and the surrounding text never shifts when the
    // highlight enters or leaves a word; the only path on iOS that
    // gives short + rounded + zero-shift simultaneously.
    //
    // Vocab words and non-vocab words use different inner pill styles:
    // vocab pills are padded + bold (matching the legacy reader's
    // highlightedPill so the initial render-then-karaoke transition is
    // visually invisible). Non-vocab pills are tight + regular weight.
    // Because each word's container/text structure is fixed for the
    // life of the render, a vocab word toggling vocab→active changes
    // only the background color and not the layout.
    let containerStyle: any = styles.karaokeWordContainerPlain;
    let wordTextStyle: any = styles.karaokeWordText;
    if (isFirstVocabHit) {
      // Vocab pills keep their type color through the entire playback.
      // The audio cursor moving over a vocab word does NOT swap the pill
      // to the active amber; the type signal stays stable so the user
      // can still tell at a glance whether it was a noun / verb / etc.
      containerStyle = [
        styles.karaokeWordContainerVocab,
        { backgroundColor: vocabBackgroundForItem(vocabItem) },
      ];
      wordTextStyle = styles.karaokeWordTextVocabWhite;
    } else if (isActive) {
      containerStyle = styles.karaokeWordContainerActive;
      wordTextStyle = styles.karaokeWordTextDark;
    }

    // Two-layer structure: the outer <View> takes the paragraph's full
    // line height so its inline baseline matches the surrounding text's
    // baseline (otherwise iOS aligns adjacent gap text to the View's
    // own shorter baseline, which makes periods and commas float above
    // the line). The inner <View> is the visible short rounded pill.
    //
    // Vocab words wrap the outer in a <Pressable> with a generous
    // hitSlop so the tap target extends past the visible pill; small
    // pills like "de", "la", "in" used to require a near-pixel-perfect
    // tap, especially in mid-scroll. Pressable handles touches at the
    // gesture-responder level so it never conflicts with the parent
    // <Pressable> wrapper (paragraph blank-space close-on-tap).
    if (vocabItem) {
      nodes.push(
        <Pressable
          key={`${paragraphKey}-w-${i}`}
          style={styles.karaokeWordOuter}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          onPress={() => onWordPress(vocabItem, paragraph.text)}
        >
          <View style={containerStyle}>
            <Text style={wordTextStyle}>{w.text}</Text>
          </View>
        </Pressable>
      );
    } else {
      // Piloto tap-any-word: palabra FUERA del vocab curado. Si su token
      // tiene un gloss "quick lookup", la hacemos tapeable (misma estructura
      // de <View> que el resto para no alterar la línea) sin pill de color:
      // el color se reserva para el story-vocab. Sin gloss, queda como texto
      // no interactivo, igual que antes.
      const hit = lookupGloss(glosses, w.text);
      const glossToken = hit?.token ?? "";
      const gloss = hit?.gloss;
      if (gloss) {
        nodes.push(
          <Pressable
            key={`${paragraphKey}-w-${i}`}
            style={styles.karaokeWordOuter}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            onPress={() => onQuickLookup(w.text, gloss, paragraph.text)}
          >
            <View style={containerStyle}>
              <Text style={wordTextStyle}>{w.text}</Text>
            </View>
          </Pressable>
        );
      } else {
        nodes.push(
          <View key={`${paragraphKey}-w-${i}`} style={styles.karaokeWordOuter}>
            <View style={containerStyle}>
              <Text style={wordTextStyle}>{w.text}</Text>
            </View>
          </View>
        );
      }
    }

    cursor = w.charEnd;
    i += 1;
  }

  if (cursor < paragraph.charEnd) {
    const tail = payloadText.slice(cursor, paragraph.charEnd).replace(/\n/g, " ");
    if (tail) {
      nodes.push(
        <Text key={`${paragraphKey}-tail`} style={baseTextStyle}>
          {tail}
        </Text>
      );
    }
  }

  return <Text style={baseTextStyle}>{nodes}</Text>;
}

// El lookup propio de la app (`findActiveKaraokeWordIndex`, con reparto de
// cluster en partes iguales) se reemplazo por `buildWordWindows` +
// `findActiveWordIndex` de src/lib/karaokeWordWindows, que es el mismo que
// usa la web. Antes cada plataforma repartia los empates a su manera.

export function ReaderScreen(args: {
  book: Book;
  story: Story;
  resolvedAudioUrl?: string | null;
  // Local (file://) cover URI from a prior offline download. Tried first;
  // if the image fails to load we fall back to story.cover / story.coverUrl
  // (remote) automatically so a missing / corrupt local file still renders.
  resolvedCoverUrl?: string | null;
  // JSON-encoded AudioWordTimingsPayload persisted in the offline snapshot
  // alongside the story body. When present we skip the network fetch to
  // `/api/mobile/audio-word-timings` so karaoke keeps working offline.
  cachedWordTimingsRaw?: string | null;
  sessionToken?: string | null;
  /** Solo para separar por cuenta el registro de historias terminadas. */
  sessionUserId?: string | null;
  onBack: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPreviousStory?: () => void;
  onNextStory?: () => void;
  isSaved: boolean;
  isSaving: boolean;
  onToggleSaved: () => void;
  /** Resaltado palabra a palabra durante el audio (ajustes). Con `false` el
   *  texto se pinta igual pero sin palabra activa, y el autoscroll vuelve al
   *  lineal por progreso de audio. Ausente = activado. */
  karaokeEnabled?: boolean;
  initialProgress?: {
    progressRatio?: number;
    currentBlockIndex?: number;
    totalBlocks?: number;
  } | null;
  onTrackProgress: (details?: {
    progressRatio?: number;
    currentBlockIndex?: number;
    totalBlocks?: number;
  }) => void;
  isAvailableOffline: boolean;
  isDownloadingOffline: boolean;
  offlineDownloadProgress?: number;
  onDownloadOffline: () => void;
  onRemoveOffline: () => void;
  onOpenPractice?: () => void;
  /**
   * Abre el panel de feedback beta. Se ofrece al pie de una historia YA
   * terminada: es el otro momento (además del final de una práctica) en el
   * que la persona acaba de vivir algo y todavía lo tiene fresco. Ausente
   * para quien no puede enviar (sin sesión o sin API).
   */
  onOpenFeedback?: () => void;
  isFavoriteWord: (word: string) => boolean;
  onToggleFavoriteWord: (item: VocabItem, contextSentence?: string, desiredSaved?: boolean) => void;
  onTrackReaderEvent?: (
    eventType:
      | "story_opened"
      | "vocab_clicked"
      | "word_dwell"
      | "audio_segment_replay"
      | "story_abandoned"
      | "vocab_marked_known"
      | "vocab_marked_unknown"
      | "rating_prompt_shown"
      | "audio_complete",
    payload: { storySlug: string; bookSlug?: string; value?: number; metadata?: Record<string, unknown> }
  ) => void;
  /** One-time coachmark pointing at the player, shown when the user lands
   *  here straight from onboarding so they know to press play. */
  showOnboardingPlayHint?: boolean;
  onDismissOnboardingPlayHint?: () => void;
}) {
  const {
    book,
    story,
    resolvedAudioUrl,
    resolvedCoverUrl,
    cachedWordTimingsRaw,
    sessionToken,
    sessionUserId,
    onBack,
    canGoPrevious = false,
    canGoNext = false,
    onPreviousStory,
    onNextStory,
    isSaved,
    isSaving,
    onToggleSaved,
    karaokeEnabled = true,
    initialProgress,
    onTrackProgress,
    isAvailableOffline,
    isDownloadingOffline,
    offlineDownloadProgress = 0,
    onDownloadOffline,
    onRemoveOffline,
    onOpenPractice,
    onOpenFeedback,
    isFavoriteWord,
    onToggleFavoriteWord,
    onTrackReaderEvent,
    showOnboardingPlayHint = false,
    onDismissOnboardingPlayHint,
  } = args;
  const blocks = useMemo(() => toBlocks(story.text), [story.text]);
  const vocab = story.vocab ?? [];
  // If a `file://` audio URL was provided but it fails to play (e.g. the
  // downloaded file was truncated), this state lets us fall back to the
  // remote story.audio on a retry pass. Reset whenever the story changes.
  const [offlineAudioFailed, setOfflineAudioFailed] = useState(false);
  useEffect(() => {
    setOfflineAudioFailed(false);
  }, [story.id]);

  // Word-level audio highlight (karaoke). Opt-in: only stories that have
  // been aligned via /api/studio/audio/word-timings populate the column.
  // Every other story keeps the existing renderHighlightedParagraph path.
  const [wordTimings, setWordTimings] = useState<AudioWordTimingsPayload | null>(null);
  // Hasta ahora `wordTimings` hacía de interruptor de facto del karaoke: había
  // alineación, había resaltado. Con el ajuste de por medio, la condición pasa
  // a ser "hay alineación Y el usuario lo quiere". El RENDER no mira esto: el
  // pintador del karaoke es también el pintador del texto plano, así que con
  // `activeWordIndex` en null dibuja texto normal y pills de vocab, sin cambio
  // de layout. Lo que sí mira esto es el cursor, los dos autoscrolls y el
  // muestreo de posición.
  const karaokeActive = karaokeEnabled && Boolean(wordTimings);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  // Piloto tap-any-word: glosses "quick lookup" de esta historia, fetch por
  // slug desde /api/mobile/tap-glosses. Vacío mientras carga o si el journey
  // aún no tiene bundle (el reader degrada a solo story-vocab).
  const [tapGlosses, setTapGlosses] = useState<Record<string, TapGloss>>({});
  // Snapshot of the last NativeAudioPlayer tick (it fires every 500ms).
  // We interpolate between ticks so words shorter than the player update
  // interval (e.g. German "in" at ~160ms) still get highlighted.
  const lastPlaybackRef = useRef<{
    positionMillis: number;
    durationMillis: number;
    wallClockMs: number;
    isPlaying: boolean;
    rate: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setActiveWordIndex(null);

    // Hidrate desde el snapshot offline si la story se descargó con
    // sus word timings. Esto deja el karaoke funcional sin red. Si
    // no hay cache, hacemos el fetch como antes.
    let cached: AudioWordTimingsPayload | null = null;
    if (cachedWordTimingsRaw) {
      try {
        const parsed = JSON.parse(cachedWordTimingsRaw) as AudioWordTimingsPayload;
        if (parsed && Array.isArray(parsed.words) && parsed.words.length > 0) {
          cached = parsed;
        }
      } catch {
        // ignore; corrupto, fetch fresco
      }
    }
    setWordTimings(cached);

    (async () => {
      try {
        const data = await apiFetch<{ timings?: AudioWordTimingsPayload | null }>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: `/api/mobile/audio-word-timings?slug=${encodeURIComponent(story.slug)}&bookSlug=${encodeURIComponent(book.slug)}`,
          method: "GET",
          token: sessionToken,
          timeoutMs: 8000,
        });
        if (cancelled) return;
        const timings = data?.timings ?? null;
        if (timings && Array.isArray(timings.words) && timings.words.length > 0) {
          setWordTimings(timings);
        }
      } catch {
        // Silent fallback al cached (si había) o al render sintético.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [story.slug, book.slug, sessionToken, cachedWordTimingsRaw]);

  // Piloto tap-any-word: trae los glosses "quick lookup" de esta historia.
  // Fetch best-effort; si falla o el journey no tiene bundle, `tapGlosses`
  // queda {} y el reader muestra solo el vocab curado (degradación limpia).
  useEffect(() => {
    let cancelled = false;
    setTapGlosses({});
    (async () => {
      try {
        const data = await apiFetch<{ glosses?: Record<string, TapGloss> }>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: `/api/mobile/tap-glosses?slug=${encodeURIComponent(story.slug)}`,
          method: "GET",
          token: sessionToken,
          timeoutMs: 8000,
        });
        if (!cancelled && data?.glosses) setTapGlosses(data.glosses);
      } catch {
        // silent: degrade to story-vocab only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [story.slug, sessionToken]);

  // `onTrackReaderEvent` es una función suelta del shell, así que cambia de
  // identidad en CADA render del padre. Guardarla en un ref permite que los
  // handlers memoizados de abajo llamen siempre a la última versión sin tener
  // que declararla como dependencia, que es lo que arruinaría la memoización.
  const trackReaderEventRef = useRef(onTrackReaderEvent);
  trackReaderEventRef.current = onTrackReaderEvent;

  // Abre el popup de quick lookup. Extraído de los args de
  // renderKaraokeParagraph porque ahora lo comparten el cuerpo y el TÍTULO.
  const handleQuickLookup = useCallback(
    (word: string, gloss: TapGloss, contextSentence?: string) => {
      // Reusa el mismo popup del vocab curado, marcado como quickLookup para
      // mostrar el chip "Quick lookup" y NO el de tipo curado. La traducción
      // vive en gloss.g.
      setSelectedVocab({
        word,
        definition: gloss.g,
        type: gloss.t,
        register: gloss.r,
        note: contextSentence,
        quickLookup: true,
      });
      trackReaderEventRef.current?.("vocab_clicked", {
        storySlug: story.slug ?? story.id,
        bookSlug: book.slug,
        metadata: {
          word,
          wordType: gloss.t ?? null,
          language: book.language ?? null,
          variant: book.variant ?? null,
          source: "quick_lookup",
        },
      });
    },
    [book.language, book.slug, book.variant, story.id, story.slug]
  );

  // wordTimings reales del backend cuando estén disponibles; sino,
  // un payload sintético tokenizado del texto local. Garantiza que
  // el karaoke render se use SIEMPRE (incluso antes del fetch),
  // eliminando el flash legacy del primer paint. Después del payload
  // base aplicamos `withoutSpeakerTokens` para que las etiquetas
  // "Speaker:" de historias multi-voz (Café in Kreuzberg, Carnitas en
  // Coyoacán, …) no se resalten; el TTS no las pronuncia, pero
  // aeneas les asigna timestamps espurios.
  const effectiveWordTimings = useMemo<AudioWordTimingsPayload>(() => {
    const base = (() => {
      if (wordTimings) return wordTimings;
      // Las historias del catálogo guardan su body como HTML (envuelto en
      // <p>, <blockquote>, <span class="vocab-word">). El render karaoke
      // asume que `storyPlainText` ya viene como texto plano (igual que
      // el payload aeneas del backend para journeys), así que tenemos
      // que strippear las tags antes de tokenizar. Sin esto el lector
      // muestra el HTML crudo como si fuera el cuerpo del cuento.
      const fromText = typeof story.text === "string" ? extractStoryPlainText(story.text) : "";
      const fromBlocks = blocks.length > 0 ? blocks.map((b) => b.text).join("\n") : "";
      return buildSyntheticWordTimings(fromText || fromBlocks);
    })();
    return withoutSpeakerTokens(base);
  }, [wordTimings, story.text, blocks]);
  const karaokeBlocks = useMemo(
    () => splitKaraokeParagraphs(effectiveWordTimings.storyPlainText),
    [effectiveWordTimings]
  );
  const karaokeVocabLookup = useMemo(() => buildVocabLookup(vocab), [vocab]);

  // Span total de los timings (segundo del último token). Los timings de
  // aeneas (sobre todo ES/DE) se corren TARDE de forma acumulada: el último
  // endSec cae hasta ~0.7-0.8 s DESPUES del final real del audio (la
  // corrección de drift ancla al final del silencio). Efecto: el resaltado
  // empieza sincronizado y se va quedando atrás hacia el final. La webapp ya
  // compensa esto (HighlightedStoryReader) escalando el tiempo de consulta;
  // acá lo replicamos para que el karaoke iOS no se atrase. Resolvemos contra
  // `effectiveWordTimings.words` (mismo array que el resolver) para no incluir
  // los timestamps espurios de las etiquetas de speaker filtradas.
  const timingsSpanSec = useMemo(() => {
    let span = 0;
    for (const w of effectiveWordTimings.words) {
      const end = typeof w.endSec === "number" ? w.endSec : w.startSec;
      if (typeof end === "number" && end > span) span = end;
    }
    return span;
  }, [effectiveWordTimings]);

  // 25 ms tick that interpolates the audio position between the
  // 500 ms callbacks from NativeAudioPlayer. Short connector words
  // ("y", "a", "la", "que") can last 60-100 ms in fluent speech, so a
  // coarser sampler (50 ms) sometimes "jumped over" them; the cursor
  // would go from word i to i+2 without ever landing on i+1. At 25 ms
  // we get ~40 Hz, enough to catch words down to ~50 ms reliably; the
  // setState is a no-op when the value didn't change, so the doubled
  // tick rate has no real React work attached.
  //
  // Index-level monotonic smoothing prevents the back-and-forth jitter
  // caused by my wall-clock extrapolation over-shooting the player's
  // actual reported position: small backward steps (1-2 words) are
  // ignored as jitter; bigger jumps are honored as real seeks/rewinds.
  const lastResolvedIndexRef = useRef<number | null>(null);
  // Última posición REAL reportada por el player (positionMillis del tick de
  // 500ms). Sirve para distinguir un tick fresco (posición nueva) de la
  // extrapolación de 25ms entre ticks: al tick fresco le creemos siempre
  // (incluso si corrige hacia atrás), y el anti-jitter solo se aplica mientras
  // extrapolamos sobre el mismo snapshot. Sin esto, el guard descartaba la
  // corrección del tick real y las palabras sobre las que la extrapolación se
  // había adelantado quedaban saltadas para siempre.
  const lastSnapPositionRef = useRef<number | null>(null);
  useEffect(() => {
    lastResolvedIndexRef.current = null;
    lastSnapPositionRef.current = null;
  }, [story.id]);
  // Ventanas de resaltado, en el MISMO index space que usa el renderer
  // (`effectiveWordTimings.words`, ya sin etiquetas de speaker).
  const karaokeWindows = useMemo(
    () =>
      effectiveWordTimings
        ? buildWordWindows(
            effectiveWordTimings.words,
            effectiveWordTimings.audioDurationSec,
          )
        : [],
    [effectiveWordTimings],
  );

  useEffect(() => {
    // El cursor solo avanza cuando hay wordTimings reales del backend.
    // Para journeys vienen de `JourneyStory.audioWordTimings` (aeneas).
    // Para historias del catálogo vienen de `CatalogStoryAudioTimings`,
    // populado por `scripts/generateCatalogAudioTimings.ts`. Si una
    // historia aún no fue alineada, el cursor queda en null (texto sin
    // resaltado pero con vocab pills); ya no hay heurística lineal que
    // produzca desfase o jitter.
    if (!karaokeActive) {
      setActiveWordIndex(null);
      lastResolvedIndexRef.current = null;
      return;
    }
    const step = createHighlightStepper();
    const interval = setInterval(() => {
      const snap = lastPlaybackRef.current;
      if (!snap) return;
      const elapsedMs = snap.isPlaying ? Math.min(Date.now() - snap.wallClockMs, 700) : 0;
      const estimatedSec = (snap.positionMillis + elapsedMs * snap.rate) / 1000;

      // Compensa el atraso acumulado de aeneas escalando el tiempo de consulta
      // hacia adelante cuando los timings se pasan del final real del audio.
      // Cap al 6% para no sobrecorregir si algún dato viniera raro; factor = 1
      // (no-op) cuando los timings ya encajan (span <= duración). Mismo criterio
      // que la webapp. Sin esto el resaltado se va quedando atrás hacia el final.
      const durationSec = snap.durationMillis / 1000;
      const queryTime =
        durationSec > 0 && timingsSpanSec > durationSec
          ? estimatedSec * Math.min(timingsSpanSec / durationSec, 1.06)
          : estimatedSec;

      // El index space tiene que ser EL MISMO que usa el renderer.
      // `effectiveWordTimings.words` filtra etiquetas de speaker; si
      // resolviéramos contra `wordTimings.words` sin filtrar, el
      // activeWordIndex apuntaría a un slot que el renderer ya no
      // tiene y el highlight saltaría a la palabra equivocada.
      const rawIdx = findActiveWordIndex(karaokeWindows, queryTime);
      const lastIdx = lastResolvedIndexRef.current;
      // ¿Este cómputo se apoya en un tick REAL nuevo, o es pura extrapolación
      // sobre el snapshot anterior? Al tick real le creemos siempre; el
      // anti-jitter solo aplica entre ticks.
      const isFreshTick = snap.positionMillis !== lastSnapPositionRef.current;
      lastSnapPositionRef.current = snap.positionMillis;

      let resolved = rawIdx;
      if (rawIdx === null && lastIdx !== null && snap.isPlaying) {
        // Mid-playback `null` from extrapolation overshoot: keep the
        // last index instead of clearing the highlight.
        resolved = lastIdx;
      } else if (rawIdx !== null && lastIdx !== null && rawIdx < lastIdx) {
        // El anti-jitter (retroceso de 1-2 palabras) SOLO aplica entre ticks:
        // suprime el vaivén de la extrapolación de 25 ms sobre el mismo
        // snapshot. Un tick REAL nuevo que corrige hacia atrás SIEMPRE se
        // respeta; sin esto, una palabra que la extrapolación se saltó quedaba
        // sin resaltar para siempre (el tick real la reclamaba y el guard lo
        // descartaba).
        const suppress = !isFreshTick && lastIdx - rawIdx < 3;
        if (suppress) resolved = lastIdx;
      }
      lastResolvedIndexRef.current = resolved;
      // Permanencia minima: sin esto, una palabra cuya ventana dura menos que
      // el intervalo de 25 ms se salta aunque el lookup si la devuelva.
      const shown = step(resolved, Date.now(), queryTime);
      setActiveWordIndex((prev) => (prev === shown ? prev : shown));
    }, 25);
    return () => clearInterval(interval);
  }, [karaokeActive, wordTimings, effectiveWordTimings, karaokeWindows, timingsSpanSec, story.id]);

  // Smart autoscroll para historias con karaoke (wordTimings).
  //
  // Tres fases:
  //   1. INTRO: la palabra activa va apareciendo arriba (Y < 40 % del
  //      viewport). El scroll se queda en 0; el usuario lee desde el
  //      principio del texto sin que la pantalla se mueva.
  //   2. STEADY: cuando la palabra activa cruza el 40 % vertical, el
  //      scroll empieza a moverse para dejarla anclada en ese 40 %
  //      mientras el resto del texto rueda por debajo.
  //   3. OUTRO: cuando el scroll alcanza el límite máximo (último
  //      contenido tocando el bottom de la pantalla), se queda allí.
  //      La palabra activa sigue avanzando dentro del viewport hacia
  //      el bottom hasta el final, sin que aparezcan espacios vacíos.
  //
  // El callback de `onProgressChange` arriba ya NO scrollea cuando hay
  // wordTimings; este efecto es la única fuente de scroll para
  // karaoke.
  const lastSmartScrollYRef = useRef(0);
  // Offset Y del bloque de texto (`textCard`) dentro del ScrollView.
  // Capturado en su onLayout. blockOffsetsRef sólo guarda offsets
  // relativos al textCard, así que para obtener la Y absoluta de una
  // palabra dentro del documento sumamos este offset (cubre el cover
  // image, top bar y todo lo que está antes del texto).
  const textCardOffsetRef = useRef(0);
  // Altura medida del playerDock sticky en el bottom (vocab overlay
  // y smart autoscroll necesitan saber cuánto del viewport está
  // tapado). Antes era un padding hardcodeado (118) que se quedó
  // corto cuando el sticky player creció a ~132 px.
  // Barra inferior de Android (edge-to-edge por defecto en SDK 54): el player
  // dock está anclado a bottom:0, así que sin este inset los controles quedan
  // por debajo de la barra de gestos/navegación y se solapan. En iOS devuelve
  // 0 (el SafeAreaView del core ya aplica el inset).
  const androidBottomInset = useAndroidBottomInset();
  const [playerDockHeight, setPlayerDockHeight] = useState(132);
  useEffect(() => {
    if (activeWordIndex === null) return;
    if (!karaokeActive) return;
    if (!scrollViewRef.current) return;
    // Misma grace window que el scroll lineal: si el usuario está
    // tocando vocab pills, no movemos el ScrollView durante 1.8 s para
    // que el target del tap no se desplace bajo el dedo.
    if (Date.now() - lastUserTouchAtRef.current < 1800) return;

    const word = effectiveWordTimings.words[activeWordIndex];
    if (!word) return;

    // Encontrar el párrafo que contiene esta palabra.
    const paragraphIndex = karaokeBlocks.findIndex(
      (p) => word.charStart >= p.charStart && word.charStart < p.charEnd
    );
    if (paragraphIndex < 0) return;

    const paragraph = karaokeBlocks[paragraphIndex];
    const blockY = blockOffsetsRef.current[paragraphIndex];
    if (typeof blockY !== "number") return;

    // Altura del párrafo: diferencia con el siguiente, o hasta el
    // final del contenido si es el último.
    const nextBlockY = blockOffsetsRef.current[paragraphIndex + 1];
    const blockHeight =
      typeof nextBlockY === "number"
        ? nextBlockY - blockY
        : Math.max(40, contentHeightRef.current - blockY);

    // Posición Y aproximada de la palabra dentro del documento. Usamos
    // la fracción de caracteres (charStart de la palabra dentro del
    // rango del párrafo) asumiendo distribución uniforme. No es
    // pixel-perfect (las palabras con vocab pill ocupan más, los
    // saltos de línea no son uniformes) pero sí lo bastante cercana
    // para que el efecto se sienta natural a 40 % de anchor.
    const charFraction =
      (word.charStart - paragraph.charStart) /
      Math.max(1, paragraph.charEnd - paragraph.charStart);
    // Y absoluta dentro del ScrollView = offset del textCard +
    // offset del párrafo dentro del textCard + fracción dentro del
    // párrafo. Sin sumar `textCardOffsetRef` el cálculo ignora todo
    // lo que está arriba del texto (cover, hero) y wordY queda muy
    // bajo, haciendo que el scroll no arranque hasta que la palabra
    // está cerca del fondo de la pantalla.
    const wordY = textCardOffsetRef.current + blockY + charFraction * blockHeight;

    const viewportHeight = viewportHeightRef.current;
    const contentHeight = contentHeightRef.current;
    const scrollableHeight = Math.max(contentHeight - viewportHeight, 0);
    if (scrollableHeight <= 0 || viewportHeight <= 0) return;

    // El player dock es un overlay sticky en el bottom (~130-150 px)
    // que tapa la parte inferior del ScrollView. El "viewport visible"
    // de lectura no es la altura total, sino lo que queda arriba del
    // player. Sin descontarlo, el anchor al 40 % cae demasiado abajo
    // (sobre el área tapada) y la palabra activa visualmente queda
    // cerca del player antes de que arranque el scroll.
    const visibleHeight = Math.max(viewportHeight - playerDockHeight, viewportHeight * 0.5);
    const targetAnchor = visibleHeight * 0.4;
    // Clamp a [0, scrollableHeight]: las fases INTRO y OUTRO emergen
    // automáticamente del clamp.
    const targetScroll = Math.max(0, Math.min(scrollableHeight, wordY - targetAnchor));

    // Throttle por delta para evitar pisar animaciones consecutivas
    // (cada `scrollTo({ animated: true })` dura ~250 ms en iOS). 4 px
    // es el umbral mínimo donde el ojo nota un movimiento.
    if (Math.abs(targetScroll - lastSmartScrollYRef.current) < 4) return;
    lastSmartScrollYRef.current = targetScroll;

    scrollViewRef.current.scrollTo({ y: targetScroll, animated: true });
  }, [activeWordIndex, karaokeActive, wordTimings, effectiveWordTimings, karaokeBlocks, playerDockHeight]);

  const preferredAudioUrl =
    typeof resolvedAudioUrl === "string" && resolvedAudioUrl.trim() ? resolvedAudioUrl : story.audio;
  const audioUrl =
    offlineAudioFailed &&
    typeof preferredAudioUrl === "string" &&
    preferredAudioUrl.startsWith("file://") &&
    typeof story.audio === "string" &&
    /^https?:\/\//.test(story.audio)
      ? story.audio
      : preferredAudioUrl;
  // El popup se reusa para dos fuentes: el vocab curado (definición completa)
  // y el "quick lookup" del piloto tap-any-word (gloss). `quickLookup` marca
  // la segunda para mostrar el chip correcto en la burbuja.
  const [selectedVocab, setSelectedVocab] = useState<
    (VocabItem & { quickLookup?: boolean }) | null
  >(null);

  const [endOfStoryPromptVisible, setEndOfStoryPromptVisible] = useState(false);
  /**
   * Qué cara enseña el diálogo del final. Es el mismo diálogo, no un modal
   * encima de otro: apilar dos capas oscuras sobre el lector para preguntar
   * una tontería es exactamente lo que hace que la gente cierre sin mirar.
   *
   *   practice → la tarjeta de práctica de siempre, con la fila de pulgares
   *              debajo de "Maybe later".
   *   vote     → a lo que lleva "Maybe later" mientras no haya voto: quien no
   *              va a practicar es justo el que hay que alcanzar.
   *   comment  → tras votar. El voto YA está enviado cuando esta cara aparece.
   */
  const [endOfStoryFace, setEndOfStoryFace] = useState<"practice" | "vote" | "comment">(
    "practice"
  );
  /** La pregunta al cerrar el panel ya se gastó en esta cuenta. */
  const [closeAskUsed, setCloseAskUsed] = useState(true);
  const [storyRatingLiked, setStoryRatingLiked] = useState<boolean | null>(null);
  /** Desde dónde se votó. Quien votó desde la tarjeta de práctica vuelve a
   *  ella al terminar: su "Start practice" seguía siendo el plan, y cerrarle
   *  el diálogo por haber opinado sería cobrarle la opinión. Quien votó desde
   *  "Maybe later" ya había dicho que se iba. */
  const [storyRatingOrigin, setStoryRatingOrigin] = useState<"practice" | "later">("practice");
  const [storyRatingComment, setStoryRatingComment] = useState("");
  /** Acuse temporal tras enviar un comentario. Sin esto el texto desaparece y
   *  no queda ni una señal de que salió: lo único que el usuario no puede ver
   *  por sí mismo es justo eso. */
  const [storyRatingJustSent, setStoryRatingJustSent] = useState(false);
  /** Ya valorada en otra sesión (disco) o hace un momento. No se repregunta. */
  const [storyAlreadyRated, setStoryAlreadyRated] = useState(false);
  /** Alto del teclado. El diálogo va centrado en un overlay absoluto, así que
   *  sin esto la caja de texto se queda debajo del teclado en cuanto enfocas. */
  const [ratingKeyboardHeight, setRatingKeyboardHeight] = useState(0);
  /**
   * ¿Ya terminó el usuario esta historia? Es lo que abre la puerta a la
   * práctica, y va SEPARADO del popup a propósito:
   *
   *   popup   → del momento. Se dispara una vez al acabar el audio y se cierra.
   *   tarjeta → permanente. Una vez desbloqueada, se queda.
   *
   * Practicar antes de terminar la historia no tiene sentido: serían palabras
   * que el usuario todavía no ha encontrado. Pero condicionarlo al popup era
   * el fallo original, porque cerrarlo dejaba la práctica sin puerta.
   *
   * NO se siembra desde `initialProgress`. Lo intenté y estaba mal:
   * `trackReadingPosition` se llama desde el scroll del usuario Y desde el
   * avance del audio, y ambos escriben el mismo `progressRatio`. Deslizar
   * hasta el final sin reproducir nada deja el progreso en ~1.0, así que
   * sembrar de ahí desbloqueaba la práctica sin haber escuchado: el mismo
   * fallo que esta condición viene a evitar, por la puerta de atrás.
   *
   * La señal canónica de "terminó" es `audio_complete` (así lo documenta el
   * shell), y llega aquí como el `didJustFinish` del reproductor.
   *
   * RESUELTO 2026-08-06 (era el PENDIENTE de este comentario): ese
   * `didJustFinish` ahora se PERSISTE en disco (`completedStories`) y se
   * siembra al abrir la historia. Antes vivía solo en este `useState`, así que
   * salir de la historia lo borraba y una escuchada AYER no ofrecía práctica
   * hasta reescucharla entera. Comprobado en el Pixel: "Duzen auf eigene
   * Gefahr", marcada como completada, llegaba al final del scroll SIN tarjeta.
   * Se sigue persistiendo SOLO el fin de audio, nunca `progressRatio`, por el
   * motivo de arriba.
   */
  const [storyCompleted, setStoryCompleted] = useState(false);
  // Animated values for the end-of-story prompt. Entrance is a spring-in
  // (backdrop fades, card slides up with a small overshoot and scales to 1)
  // matching the rest of the app's micro-animations (celebration toast,
  // journey milestone). Exit on "Start practice" is a compress+fade that
  // visually pushes the card into the practice screen instead of popping
  // it away.
  const endOfStoryBackdropOpacity = useRef(new Animated.Value(0)).current;
  const endOfStoryCardOpacity = useRef(new Animated.Value(0)).current;
  const endOfStoryCardTranslate = useRef(new Animated.Value(40)).current;
  const endOfStoryCardScale = useRef(new Animated.Value(0.92)).current;
  // Pulsing halo behind the "Start practice" CTA to draw the eye; same
  // feel as NextActionGlow on the journey map.
  const endOfStoryCtaPulse = useRef(new Animated.Value(0.3)).current;
  // The sticky audio player is rendered after the prompt in the tree, so it
  // paints ON TOP of the dimmed backdrop and keeps competing for attention
  // while the practice card is up. Fade it out with the backdrop (and back in
  // when the card is dismissed) so the prompt is the only thing on screen.
  const playerDockOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!endOfStoryPromptVisible) {
      endOfStoryBackdropOpacity.setValue(0);
      endOfStoryCardOpacity.setValue(0);
      endOfStoryCardTranslate.setValue(40);
      endOfStoryCardScale.setValue(0.92);
      Animated.timing(playerDockOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.parallel([
      Animated.timing(playerDockOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(endOfStoryBackdropOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(endOfStoryCardOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(endOfStoryCardTranslate, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(endOfStoryCardScale, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start();
    // Looping CTA halo.
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(endOfStoryCtaPulse, {
          toValue: 0.7,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(endOfStoryCtaPulse, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [
    endOfStoryPromptVisible,
    endOfStoryBackdropOpacity,
    endOfStoryCardOpacity,
    endOfStoryCardTranslate,
    endOfStoryCardScale,
    endOfStoryCtaPulse,
    playerDockOpacity,
  ]);

  function runEndOfStoryExitAnimation(onDone: () => void) {
    // Card compresses + sinks + fades, backdrop fades. The slight downward
    // movement plus scale-down feels like the card is being "pushed into"
    // the practice screen that's about to appear.
    Animated.parallel([
      Animated.timing(endOfStoryCardScale, {
        toValue: 0.96,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(endOfStoryCardTranslate, {
        toValue: 20,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(endOfStoryCardOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(endOfStoryBackdropOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }
  // Only auto-open the practice prompt once per story view so dismissing it
  // doesn't cause it to re-pop every time the user scrolls near the bottom.
  const promptShownForStoryRef = useRef<string | null>(null);
  /** Si ya se contó que la fila de pulgares se pintó para esta historia. */
  const ratingShownForStoryRef = useRef<string | null>(null);
  // Tracks whether we've already emitted `audio_complete` for the active
  // story. The expo-av status update keeps firing after `didJustFinish`
  // (looping isPlaying=false ticks), so without this guard we'd flood the
  // metrics endpoint with duplicate completion events.
  const audioCompleteFiredForStoryRef = useRef<string | null>(null);
  useEffect(() => {
    setEndOfStoryPromptVisible(false);
    setStoryCompleted(false);
    promptShownForStoryRef.current = null;
    ratingShownForStoryRef.current = null;
    audioCompleteFiredForStoryRef.current = null;
    // A cero: si la tarjeta no se renderiza (historia sin terminar), nadie
    // vuelve a llamar a su onLayout y una altura vieja desajustaría el mapeo
    // del progreso de esta historia.
    afterTextHeightRef.current = 0;

    // Siembra desde disco: si esta historia ya se terminó alguna vez, la
    // tarjeta aparece sin reescuchar. El popup NO se dispara, porque solo lo
    // llama `maybeFireEndOfStoryPrompt` al terminar el audio de verdad.
    let cancelled = false;
    void (async () => {
      const done = await loadCompletedStories(sessionUserId);
      if (cancelled) return;
      if (done.has(story.id)) setStoryCompleted(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id, sessionUserId]);

  // Estado de la valoración, por historia. Se reinicia al cambiar de historia
  // y se siembra desde disco: quien ya puntuó esta no vuelve a ver la fila.
  useEffect(() => {
    setEndOfStoryFace("practice");
    setStoryRatingLiked(null);
    setStoryRatingOrigin("practice");
    setStoryRatingComment("");
    setStoryAlreadyRated(false);
    let cancelled = false;
    void (async () => {
      const [votes, closeUsed] = await Promise.all([
        loadRatedStoryVotes(sessionUserId ?? null),
        hasCloseAskBeenUsed(sessionUserId ?? null),
      ]);
      if (cancelled) return;
      const previousVote = votes[story.slug];
      if (typeof previousVote === "boolean") {
        setStoryAlreadyRated(true);
        // El pulgar de la última vez, para pintarlo marcado al entrar.
        setStoryRatingLiked(previousVote);
      }
      setCloseAskUsed(closeUsed);
    })();
    return () => {
      cancelled = true;
    };
  }, [story.slug, sessionUserId]);

  // El teclado solo importa mientras la caja de texto existe.
  useEffect(() => {
    if (endOfStoryFace !== "comment") {
      setRatingKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setRatingKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setRatingKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [endOfStoryFace]);

  /**
   * Los pulgares salen en TODA historia sin valorar. Muestrear una de cada
   * cinco no reparte el feedback al azar: reparte por posición, así que las
   * historias 1, 5, 10, 15 y 20 acumularían todas las opiniones y el resto no
   * tendría ninguna. Un toque cuesta lo mismo en todas.
   */
  const canRateStory = Boolean(sessionToken) && !storyAlreadyRated;
  /** La fila de pulgares se pinta siempre que haya sesión, votada o no: es la
   *  única puerta que le queda a alguien para cambiar de opinión o añadir un
   *  comentario después. Antes desaparecía tras votar y dejaba un "Thanks,
   *  noted" que no llevaba a ningún sitio. */
  const showRatingRow = Boolean(sessionToken);

  /**
   * La impresion, no el toque. El 2026-08-24 nueve testers pasaron 53 veces por
   * un final de historia o de practica sin que llegara un solo pulgar, y no
   * habia forma de saber si la fila se les habia pintado siquiera: el
   * denominador se estaba infiriendo de `audio_complete`, que no es lo mismo.
   * Una fila enseñada y no tocada es un dato; una fila que nunca se pinto es
   * otro problema completamente distinto.
   *
   * Una vez por historia y por montaje, igual que el propio panel.
   */
  useEffect(() => {
    if (!endOfStoryPromptVisible || endOfStoryFace !== "practice") return;
    if (!showRatingRow || !onOpenPractice || !story.slug) return;
    if (ratingShownForStoryRef.current === story.id) return;
    ratingShownForStoryRef.current = story.id;
    trackReaderEventRef.current?.("rating_prompt_shown", {
      storySlug: story.slug,
      bookSlug: book.slug,
      metadata: { surface: "story", alreadyRated: storyAlreadyRated },
    });
  }, [
    endOfStoryPromptVisible,
    endOfStoryFace,
    showRatingRow,
    onOpenPractice,
    story.id,
    story.slug,
    book.slug,
    storyAlreadyRated,
  ]);

  async function postStoryRating(liked: boolean, comment?: string) {
    if (!sessionToken) return;
    try {
      await apiFetch<{ ok: boolean }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/mobile/story-rating",
        token: sessionToken,
        method: "POST",
        timeoutMs: 15000,
        body: {
          storyId: story.id,
          storySlug: story.slug,
          bookSlug: book.slug,
          liked,
          surface: "story",
          ...(comment ? { comment } : {}),
          platform: Platform.OS,
          appVersion: Application.nativeApplicationVersion ?? undefined,
          buildNumber: Application.nativeBuildVersion ?? undefined,
        },
      });
    } catch {
      // Un fallo de red no puede convertirse en un error en pantalla justo
      // cuando la persona está saliendo de la historia.
    }
  }

  function closeEndOfStoryPrompt() {
    Keyboard.dismiss();
    setEndOfStoryPromptVisible(false);
    setEndOfStoryFace("practice");
    setStoryRatingComment("");
    // Al cerrar, el lector baja hasta la tarjeta de practica.
    //
    // La puerta permanente ya existia, pero vive DEBAJO del ultimo parrafo y el
    // popup la tapa mientras esta arriba, asi que quien lo cierra vuelve al
    // texto sin haberla visto nunca. Ty, que se estudio la app entera, escribio
    // "there needs to be an intuitive way to trigger the exercises" y conto que
    // para recuperarla ponia el audio a 1.5x hasta el final para volver a
    // disparar el popup. Reconstruyendo a mano el evento, que es exactamente lo
    // que la tarjeta venia a evitar.
    //
    // Cerrar el popup deja la tarjeta a la vista. Nada que buscar y nada que
    // aprenderse: el sitio al que vuelves ES la puerta.
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  }

  /**
   * Lo que ocurre al intentar cerrar el panel (la X, "Maybe later" o tocar
   * fuera). La primera vez en la vida de la cuenta, en lugar de cerrarse,
   * pregunta; a partir de ahí cierra sin más. Una sola vez porque el que cierra
   * ya dijo que se iba: insistir en cada historia convierte la salida en un
   * peaje y enseña a la gente a buscar la X sin leer.
   */
  function requestCloseEndOfStoryPrompt() {
    // Cerrar la caja de comentario vuelve al panel de practica, no al lector.
    // El voto ya esta guardado, asi que esto no es abandonar nada: es deshacer
    // un paso. Sacar a alguien de la historia entera por cerrar una caja
    // opcional le cobra la opinion que acaba de dar.
    if (endOfStoryFace === "comment") {
      // El borrador NO se borra: si vuelve a abrir la caja, lo que escribió a
      // medias sigue ahí.
      Keyboard.dismiss();
      setEndOfStoryFace("practice");
      return;
    }
    if (!closeAskUsed && canRateStory && endOfStoryFace === "practice") {
      setCloseAskUsed(true);
      void markCloseAskUsed(sessionUserId ?? null);
      setEndOfStoryFace("vote");
      return;
    }
    closeEndOfStoryPrompt();
  }

  // El toque del pulgar ES el envío. Lo que viene después (la caja de texto)
  // ya no decide nada: por eso cerrarla, escribir o no escribir da igual.
  function handleStoryVote(liked: boolean, origin: "practice" | "later") {
    setStoryRatingOrigin(origin);
    setEndOfStoryFace("comment");
    // Tocar el pulgar que YA estaba marcado no es un voto nuevo: es la puerta
    // a la caja de comentario. Reenviarlo solo ensuciaría las métricas con un
    // voto repetido que no cambia nada.
    if (storyRatingLiked === liked) return;
    setStoryRatingLiked(liked);
    setStoryAlreadyRated(true);
    void postStoryRating(liked);
    void markStoryRated(sessionUserId ?? null, story.slug, liked);
  }

  function handleStoryRatingSend() {
    const trimmed = storyRatingComment.trim();
    const sentComment = Boolean(trimmed) && storyRatingLiked !== null;
    if (sentComment) {
      void postStoryRating(storyRatingLiked as boolean, trimmed);
    }
    setStoryRatingComment("");
    Keyboard.dismiss();
    // Con comentario enviado SIEMPRE se vuelve al panel, venga de donde venga:
    // el acuse vive ahí y cerrar de golpe se lo comería.
    if (sentComment) {
      setStoryRatingJustSent(true);
      setEndOfStoryFace("practice");
      return;
    }
    if (storyRatingOrigin === "practice") {
      setEndOfStoryFace("practice");
      return;
    }
    closeEndOfStoryPrompt();
  }


  function maybeFireEndOfStoryPrompt() {
    if (!onOpenPractice) return;
    if (vocab.length === 0) return;
    // La tarjeta se DESBLOQUEA aquí y ya no se vuelve a esconder, aunque el
    // popup se cierre. Separar las dos cosas es el punto: el popup es del
    // momento, la tarjeta es la puerta permanente.
    setStoryCompleted(true);
    // Y se deja escrito, para que la puerta siga abierta mañana.
    void markStoryCompleted(sessionUserId, story.id);
    if (promptShownForStoryRef.current === story.id) return;
    promptShownForStoryRef.current = story.id;
    setEndOfStoryPromptVisible(true);
  }
  const lastTrackedStoryId = useRef<string | null>(null);
  // Funnel-distinct "opened a story" signal, fired once per story on mount so
  // "Abrió" no longer depends on a progressSec=0 continue-listening row.
  const storyOpenedFiredForStoryRef = useRef<string | null>(null);
  useEffect(() => {
    if (storyOpenedFiredForStoryRef.current === story.id) return;
    if (!onTrackReaderEvent || !story.slug) return;
    storyOpenedFiredForStoryRef.current = story.id;
    onTrackReaderEvent("story_opened", {
      storySlug: story.slug,
      bookSlug: book.slug,
      metadata: { progressKey: `standalone:${story.slug}`, source: "mobile_reader" },
    });
  }, [story.id, story.slug, book.slug, onTrackReaderEvent]);
  const lastPersistedProgressSecRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef<number>(0);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const lastAutoScrollRatioRef = useRef(0);
  const lastScrollRatioRef = useRef(0);
  // Timestamp of the user's most recent touch on the ScrollView. While
  // the autoscroll's animated `scrollTo` is in flight (~300 ms per
  // tick), the inline vocab pills are visually moving under the
  // user's finger and iOS hit-tests against the destination frame, so
  // taps land on the wrong word or miss entirely. We suspend the
  // autoscroll for a short grace window after each touch so the user
  // has a stable target.
  const lastUserTouchAtRef = useRef(0);
  // Live scroll Y, updated on every onScroll. Used to cancel any
  // animated `scrollTo` that is still in flight when the user touches
  // the screen: doing an instant scrollTo to the current Y stops the
  // animation mid-frame so the pills underneath the finger stop
  // moving. Without this, taps land on the destination frame instead
  // of where the user sees the pill, which is what "tap during scroll
  // sometimes fails" feels like.
  const currentScrollYRef = useRef(0);
  const blockOffsetsRef = useRef<number[]>([]);
  const hasRestoredPositionRef = useRef(false);
  /**
   * Altura de todo lo que se renderiza DEBAJO del último párrafo (hoy: la
   * tarjeta de práctica).
   *
   * La regla que esto hace explícita, y que antes vivía implícita en que no
   * había nada ahí abajo: el progreso y el autoscroll mapean contra la altura
   * del TEXTO, no contra la altura de lo que hay en el ScrollView. Sin
   * descontarlo, el narrador iría por el último párrafo mientras la pantalla
   * ya enseña la tarjeta, y llegar al final del texto no marcaría el 100%.
   */
  const afterTextHeightRef = useRef(0);
  const lastTrackedReadingRatioRef = useRef<number | null>(null);
  const lastTrackedBlockIndexRef = useRef<number | null>(null);
  const remoteCoverUrl = story.cover || story.coverUrl || book.cover;
  // Prefer the local (file://) copy when we have one; it's instant and
  // works offline. If it errors (file missing / truncated), ProgressiveImage
  // calls onError and we swap to the remote URL for a graceful recovery.
  const [localCoverFailed, setLocalCoverFailed] = useState(false);
  useEffect(() => {
    setLocalCoverFailed(false);
  }, [story.id]);

  // Animación de "descarga completada": cuando `isAvailableOffline`
  // pasa de false a true, lanzamos un pulse + scale en el botón
  // (icon de check verde) para que el usuario sienta que algo bueno
  // pasó, además del icon estático. Un bounce de 0.92 → 1.25 → 1
  // con un halo verde que se expande y desvanece.
  const downloadCompleteScale = useRef(new Animated.Value(1)).current;
  const downloadCompleteHaloOpacity = useRef(new Animated.Value(0)).current;
  const downloadCompleteHaloScale = useRef(new Animated.Value(0.6)).current;
  // Spin loop para el icon "loader" mientras la descarga corre. Sin
  // esto el icon era estático y parecía un asset, no un indicador
  // de progreso. 900 ms por vuelta es estándar (similar a iOS UIKit).
  const downloadLoadingRotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isDownloadingOffline) {
      downloadLoadingRotate.setValue(0);
      return;
    }
    downloadLoadingRotate.setValue(0);
    const loop = Animated.loop(
      Animated.timing(downloadLoadingRotate, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isDownloadingOffline, downloadLoadingRotate]);
  const wasAvailableOfflineRef = useRef(isAvailableOffline);
  useEffect(() => {
    const wasAvailable = wasAvailableOfflineRef.current;
    wasAvailableOfflineRef.current = isAvailableOffline;
    if (wasAvailable || !isAvailableOffline) return;
    // Reset y dispara la animación de "completado".
    downloadCompleteScale.setValue(0.9);
    downloadCompleteHaloOpacity.setValue(0.7);
    downloadCompleteHaloScale.setValue(0.6);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(downloadCompleteScale, {
          toValue: 1.25,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.spring(downloadCompleteScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(downloadCompleteHaloScale, {
        toValue: 2.2,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(downloadCompleteHaloOpacity, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    isAvailableOffline,
    downloadCompleteScale,
    downloadCompleteHaloOpacity,
    downloadCompleteHaloScale,
  ]);
  const preferLocalCover =
    typeof resolvedCoverUrl === "string" &&
    resolvedCoverUrl.startsWith("file://") &&
    !localCoverFailed;
  const desiredCoverUrl = preferLocalCover ? resolvedCoverUrl : remoteCoverUrl;
  // Bloquear el swap http→file que ocurre cuando el usuario descarga
  // la story DENTRO del reader: ese swap dispara un re-load del Image
  // que parpadea ~150 ms con la portada vacía. Cualquier OTRO cambio
  // (file→http del fallback al fallar el local, primer load, refresh
  // de URL remota) se aplica normalmente.
  const [initialCoverUrl, setInitialCoverUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setInitialCoverUrl(undefined);
  }, [story.id]);
  useEffect(() => {
    setInitialCoverUrl((current) => (current === undefined ? desiredCoverUrl : current));
  }, [desiredCoverUrl]);
  const initialIsHttp =
    typeof initialCoverUrl === "string" && /^https?:\/\//.test(initialCoverUrl);
  const desiredIsFile =
    typeof desiredCoverUrl === "string" && desiredCoverUrl.startsWith("file://");
  const coverUrl = initialIsHttp && desiredIsFile ? initialCoverUrl : desiredCoverUrl;
  // The reader does not render anything based on the active block index
  // (it's only used to persist progress on scroll). Keeping it in state
  // would trigger a full re-render of the reader on every block boundary
  // crossed during scroll; catastrophic for scroll performance. A ref
  // avoids the re-renders entirely.
  const activeBlockIndexRef = useRef(
    Math.min(Math.max(initialProgress?.currentBlockIndex ?? 0, 0), Math.max(blocks.length - 1, 0))
  );
  // Show the full definition; the bubble grows vertically and defs from the
  // generator now target 17-25 words (~100-150 chars), so the old 56-char
  // shortener was truncating almost everything.
  const compactDefinition = useMemo(
    () => selectedVocab?.definition?.replace(/\s+/g, " ").trim() || undefined,
    [selectedVocab?.definition]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        setSelectedVocab(null);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (lastTrackedStoryId.current === story.id) {
      return;
    }

    lastTrackedStoryId.current = story.id;
    lastAutoScrollRatioRef.current = 0;
    lastSmartScrollYRef.current = 0;
    lastScrollRatioRef.current = initialProgress?.progressRatio ?? 0;
    blockOffsetsRef.current = [];
    hasRestoredPositionRef.current = false;
    lastTrackedReadingRatioRef.current = null;
    lastTrackedBlockIndexRef.current = null;
    const nextBlockIndex = Math.min(
      Math.max(initialProgress?.currentBlockIndex ?? 0, 0),
      Math.max(blocks.length - 1, 0)
    );
    activeBlockIndexRef.current = nextBlockIndex;
    onTrackProgress({
      progressRatio: initialProgress?.progressRatio ?? 0,
      currentBlockIndex: nextBlockIndex,
      totalBlocks: blocks.length,
    });
  }, [story.id, initialProgress?.currentBlockIndex, initialProgress?.progressRatio, blocks.length]);

  useEffect(() => {
    lastPersistedProgressSecRef.current = null;
    lastPersistedAtRef.current = 0;
  }, [story.id]);

  function trackReadingPosition(progressRatio: number, nextBlockIndex: number) {
    const clampedRatio = Math.min(1, Math.max(0, progressRatio));
    if (
      lastTrackedReadingRatioRef.current !== null &&
      Math.abs(clampedRatio - lastTrackedReadingRatioRef.current) < 0.03 &&
      lastTrackedBlockIndexRef.current === nextBlockIndex
    ) {
      return;
    }

    lastTrackedReadingRatioRef.current = clampedRatio;
    lastTrackedBlockIndexRef.current = nextBlockIndex;
    onTrackProgress({
      progressRatio: clampedRatio,
      currentBlockIndex: nextBlockIndex,
      totalBlocks: blocks.length,
    });
  }

  function restoreReadingPosition() {
    // Stories always open scrolled to the very top now; regardless of
    // any persisted progress. The audio playhead still resumes via the
    // <NativeAudioPlayer/> initial position; only the visual scroll is
    // pinned to 0 so the user sees the cover + first line right away.
    if (hasRestoredPositionRef.current) return;
    hasRestoredPositionRef.current = true;
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  }

  // Cuerpo de la historia, memoizado.
  //
  // Antes se construía inline en el JSX, así que CUALQUIER render del shell lo
  // rehacía entero. Marcar una palabra como favorita cambia estado en el shell
  // (19k líneas) y, en cascada, aquí se reconstruían todos los párrafos: en iOS
  // eso es un <View> por palabra y en Android un chip por palabra, del orden de
  // 1.200 elementos para una historia de 600 palabras, todo en el hilo JS antes
  // de que el pill pudiera repintarse. Ese era el "save word tarda en
  // reaccionar": no era la red (la web ya responde al instante y el POST son
  // decenas de ms), era el render.
  //
  // Las dependencias son SOLO los datos que el cuerpo dibuja. Ni
  // `isFavoriteWord` ni `onToggleFavoriteWord` entran: los párrafos no los
  // consumen. `restoreReadingPosition` y los refs tampoco, porque solo tocan
  // refs y una copia vieja se comporta igual.
  const karaokeParagraphNodes = useMemo(() => {
    // Render unificado: siempre karaoke. Cuando los wordTimings reales no
    // llegaron todavía, `effectiveWordTimings` cae al payload sintético.
    // Eliminado el path legacy `renderHighlightedParagraph` que causaba el
    // flash de medio segundo durante el primer paint.
    const karaokeAlreadyHighlighted = new Set<string>();
    return karaokeBlocks.map((paragraph, index) => (
      <Pressable
        key={`${story.id}-k-${index}`}
        // Forma funcional a propósito: leer `selectedVocab` obligaría a
        // declararlo dependencia y el cuerpo se rehacría al abrir y cerrar
        // cada popup, que es justo lo que este memo viene a evitar.
        onPress={() => setSelectedVocab((prev) => (prev ? null : prev))}
        style={styles.paragraphBlock}
        onLayout={(event) => {
          blockOffsetsRef.current[index] = event.nativeEvent.layout.y;
          restoreReadingPosition();
        }}
      >
        {renderKaraokeParagraph({
          paragraph,
          payloadText: effectiveWordTimings.storyPlainText,
          words: effectiveWordTimings.words,
          activeWordIndex,
          vocabLookup: karaokeVocabLookup,
          paragraphKey: `${story.id}-k-${index}`,
          onWordPress: (item, contextSentence) => {
            setSelectedVocab(contextSentence ? { ...item, note: contextSentence } : item);
            trackReaderEventRef.current?.("vocab_clicked", {
              storySlug: story.slug ?? story.id,
              bookSlug: book.slug,
              metadata: {
                word: item.word,
                wordType: item.type,
                language: book.language ?? null,
                variant: book.variant ?? null,
                source: "karaoke",
              },
            });
          },
          variant: "paragraph",
          alreadyHighlighted: karaokeAlreadyHighlighted,
          glosses: tapGlosses,
          onQuickLookup: handleQuickLookup,
        })}
      </Pressable>
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    karaokeBlocks,
    effectiveWordTimings,
    activeWordIndex,
    karaokeVocabLookup,
    tapGlosses,
    handleQuickLookup,
    story.id,
    story.slug,
    book.slug,
    book.language,
    book.variant,
  ]);

  async function persistContinueListening(progressSec: number, durationSec: number) {
    if (!sessionToken || !book.slug || !story.slug) return;

    const roundedProgress = Math.max(0, Math.round(progressSec));
    const roundedDuration = Math.max(0, Math.round(durationSec));
    const now = Date.now();

    if (
      lastPersistedProgressSecRef.current !== null &&
      Math.abs(roundedProgress - lastPersistedProgressSecRef.current) < 15 &&
      now - lastPersistedAtRef.current < 45_000
    ) {
      return;
    }

    lastPersistedProgressSecRef.current = roundedProgress;
    lastPersistedAtRef.current = now;

    try {
      await apiFetch<{ success: boolean }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/continue-listening",
        token: sessionToken,
        method: "POST",
        timeoutMs: 15000,
        body: {
          bookSlug: book.slug,
          storySlug: story.slug,
          progressSec: roundedProgress,
          audioDurationSec: roundedDuration,
        },
      });
    } catch {
      // Keep listening experience resilient even if sync fails.
    }
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    contentHeightRef.current = contentSize.height;
    viewportHeightRef.current = layoutMeasurement.height;
    currentScrollYRef.current = contentOffset.y;
    // Descontando lo que hay DEBAJO del texto (ver textScrollableHeight): sin
    // esto, llegar al final de la historia ya no daría el 100% de progreso.
    const scrollableHeight = Math.max(
      contentSize.height - layoutMeasurement.height - afterTextHeightRef.current,
      1
    );
    const ratio = Math.min(1, Math.max(0, contentOffset.y / scrollableHeight));
    lastScrollRatioRef.current = ratio;
    const anchorY = contentOffset.y + Math.max(80, layoutMeasurement.height * 0.22);
    let nextBlockIndex = 0;
    for (let index = 0; index < blockOffsetsRef.current.length; index += 1) {
      if ((blockOffsetsRef.current[index] ?? 0) <= anchorY) {
        nextBlockIndex = index;
      } else {
        break;
      }
    }
    if (nextBlockIndex !== activeBlockIndexRef.current) {
      activeBlockIndexRef.current = nextBlockIndex;
    }
    trackReadingPosition(ratio, nextBlockIndex);

    // "Lock it in" prompt is now audio-only (fires on expo-av
    // didJustFinish). The scroll-to-end trigger was removed per request -
    // reaching the bottom of the text is not the same thing as finishing
    // the story, especially if the listener is using audio.
  }

  return (
    <View style={styles.screen} accessibilityLabel="qa-reader-screen" testID="qa-reader-screen">
      {/* Floating back button; always reachable regardless of scroll
          position, so the user doesn't have to scroll back to the top of a
          long story to tap "back to journey". */}
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="qa-reader-back-floating"
        testID="qa-reader-back-floating"
        style={styles.floatingBackButton}
        hitSlop={10}
      >
        <Feather name="arrow-left" size={20} color="#f5f7fb" />
      </Pressable>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        // El paddingBottom debe reservar el alto REAL del player sticky (que se
        // mide en playerDockHeight) + un espacio de lectura, para que la última
        // línea de la historia nunca quede tapada por el player. Antes era un
        // 172 fijo que se quedaba corto cuando el player crece (waveform +
        // controles + fila de velocidad).
        contentContainerStyle={[
          styles.container,
          styles.containerGrow,
          { paddingBottom: playerDockHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        onTouchStart={() => {
          lastUserTouchAtRef.current = Date.now();
          // Cancel any animated scrollTo still in flight by snapping
          // to the current Y instantly. The visible pills under the
          // finger stop moving immediately, so iOS hit-tests against
          // the actual rendered frame instead of the animation's
          // destination. Without this, taps during the 250 ms window
          // after an autoscroll tick frequently miss because the
          // pill has already drifted by the time the tap registers.
          scrollViewRef.current?.scrollTo({
            y: currentScrollYRef.current,
            animated: false,
          });
        }}
        onTouchEnd={() => {
          lastUserTouchAtRef.current = Date.now();
        }}
        onScroll={handleScroll}
        // 32 ms ≈ 30 Hz is plenty for progress tracking; cuts the JS-side
        // scroll handler cost in half vs 60 Hz (16 ms) without any
        // visible scroll smoothness difference.
        scrollEventThrottle={32}
        onContentSizeChange={(_width, height) => {
          contentHeightRef.current = height;
          restoreReadingPosition();
        }}
        onLayout={(event) => {
          viewportHeightRef.current = event.nativeEvent.layout.height;
          restoreReadingPosition();
        }}
      >
        <View style={styles.topBar}>
          {/* Back lives in the floating button (rendered outside this
              ScrollView) so it's always reachable without scrolling. The
              right side keeps save + download. */}
          <View />
          <View style={styles.topActions}>
            <Pressable
              onPress={onToggleSaved}
              accessibilityLabel={isSaved ? "Remove from saved" : "Save story"}
              style={({ pressed }) => [
                styles.iconButton,
                isSaved ? styles.iconButtonActiveSaved : null,
                pressed ? styles.iconButtonPressed : null,
              ]}
            >
              {/* Filled vs outline bookmark; the shape change (not just
                  the colour) makes the toggle readable at a glance. */}
              {isSaved ? (
                <MaterialCommunityIcons name="bookmark" size={19} color="#f8c15c" />
              ) : (
                <MaterialCommunityIcons name="bookmark-outline" size={19} color="#dbe9ff" />
              )}
            </Pressable>
            <Pressable
              onPress={isAvailableOffline ? onRemoveOffline : onDownloadOffline}
              disabled={isDownloadingOffline}
              accessibilityLabel={
                isDownloadingOffline
                  ? "Downloading"
                  : isAvailableOffline
                    ? "Remove offline copy"
                    : "Download for offline"
              }
              style={({ pressed }) => [
                styles.iconButton,
                isAvailableOffline ? styles.iconButtonActiveDownloaded : null,
                pressed ? styles.iconButtonPressed : null,
              ]}
            >
              {/* Halo verde que se expande y desvanece al completar la
                  descarga. pointerEvents="none" para no bloquear el
                  Pressable. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.iconButtonDownloadHalo,
                  {
                    opacity: downloadCompleteHaloOpacity,
                    transform: [{ scale: downloadCompleteHaloScale }],
                  },
                ]}
              />
              <Animated.View
                style={{ transform: [{ scale: downloadCompleteScale }] }}
              >
                {isDownloadingOffline ? (
                  // Anillo que se LLENA con el progreso real (bytes del audio),
                  // en vez de la rueda indeterminada.
                  <DownloadProgressRing progress={offlineDownloadProgress} size={20} />
                ) : (
                  <Feather
                    name={isAvailableOffline ? "check-circle" : "download-cloud"}
                    size={18}
                    color={isAvailableOffline ? "#8ef0c6" : "#dbe9ff"}
                  />
                )}
              </Animated.View>
            </Pressable>
          </View>
        </View>

        <View style={styles.headerBlock}>
          <Text style={styles.storyTitle}>
            {renderTappableTitle(story.title, tapGlosses, handleQuickLookup)}
          </Text>
        </View>

        {coverUrl ? (
          // w=640 is plenty for the 196pt-tall hero at @3x and is usually
          // already in the Next.js image cache because smaller cards share
          // the same bucket; keeps first render fast.
          <ProgressiveImage
            uri={getCoverUrl(coverUrl, 640)}
            style={styles.readerCover}
            resizeMode="cover"
            onError={() => {
              // Swap to the remote URL if the local file failed to load.
              if (preferLocalCover) setLocalCoverFailed(true);
            }}
          />
        ) : null}

        <View style={styles.textWrap}>
          <View
            style={styles.textCard}
            onLayout={(event) => {
              // Mide la Y del textCard relativa al ScrollView.
              // `blockOffsetsRef` solo guarda offsets relativos a este
              // textCard (cada Pressable de párrafo da su layout.y respecto
              // al padre directo). Para que el smart autoscroll calcule
              // bien la Y absoluta de una palabra dentro del documento,
              // hay que sumar este offset (cover image, top bar, hero,
              // espacios, todo lo que está arriba del bloque de texto).
              // Lo capturamos cada vez que el textCard se relayoutea,
              // así sigue siendo correcto si una imagen se carga tarde y
              // empuja todo hacia abajo.
              const target = event.currentTarget as unknown as {
                measureLayout?: (
                  relativeTo: unknown,
                  onSuccess: (x: number, y: number) => void,
                  onFail?: () => void
                ) => void;
              };
              const scrollNode = scrollViewRef.current as unknown as
                | { getScrollableNode?: () => unknown }
                | null;
              if (target.measureLayout && scrollNode?.getScrollableNode) {
                target.measureLayout(
                  scrollNode.getScrollableNode(),
                  (_x, y) => {
                    textCardOffsetRef.current = y;
                  },
                  () => undefined
                );
              }
            }}
          >
            {karaokeParagraphNodes}
          </View>

          {/* Puerta permanente a la práctica.
              Aparece cuando la historia YA está terminada, nunca antes:
              practicar palabras que aún no has encontrado no enseña nada. Pero
              a diferencia del popup, que se dispara una vez y al cerrarlo
              desaparecía, esta se queda. Ese era el fallo: la única forma de
              recuperar la práctica era arrastrar el audio hasta el final para
              re-disparar el modal.
              Su altura se mide para descontarla del mapeo de progreso. */}
          {onOpenPractice && vocab.length > 0 && storyCompleted ? (
            <View
              style={styles.readerPracticeCard}
              onLayout={(event) => {
                afterTextHeightRef.current = event.nativeEvent.layout.height;
              }}
            >
              <Text style={styles.readerPracticeCardTitle}>Practice this story</Text>
              <Text style={styles.readerPracticeCardBody}>
                {vocab.length} words from this story, ready when you are.
              </Text>
              <Pressable
                onPress={onOpenPractice}
                style={styles.readerPracticeCardButton}
                accessibilityLabel="qa-reader-practice-card"
                testID="qa-reader-practice-card"
              >
                <Feather name="zap" size={16} color="#0c1626" />
                <Text style={styles.readerPracticeCardButtonText}>Start practice</Text>
              </Pressable>
            </View>
          ) : null}

          {/* El otro momento en que preguntar sale barato: acaba de terminar
              una historia. Va atado a `storyCompleted`, no al scroll, para no
              preguntarle nada a quien solo hojeó hasta el final.
              Deliberadamente NO depende de la tarjeta de práctica: quien lee y
              no practica es justo el que hoy no tenía dónde opinar salvo
              Ajustes, que es el camino que casi nadie recorre. Discreto y
              debajo, para no disputarle el sitio a "Start practice". */}
          {onOpenFeedback && storyCompleted ? (
            <Pressable
              onPress={onOpenFeedback}
              style={styles.readerFeedbackLink}
              accessibilityRole="button"
              accessibilityLabel="qa-reader-feedback"
              testID="qa-reader-feedback"
            >
              <Feather name="message-square" size={13} color="#8aa0bd" />
              <Text style={styles.readerFeedbackLinkText}>
                How was this story? Tell me in one line
              </Text>
            </Pressable>
          ) : null}

        </View>
      </ScrollView>

      {endOfStoryPromptVisible && onOpenPractice ? (
        <View
          style={[
            styles.endOfStoryBackdrop,
            ratingKeyboardHeight > 0 ? { paddingBottom: ratingKeyboardHeight } : null,
          ]}
          accessibilityLabel="qa-reader-practice-prompt"
          testID="qa-reader-practice-prompt"
          pointerEvents="box-none"
        >
          <Animated.View
            pointerEvents="auto"
            style={[styles.endOfStoryBackdropFill, { opacity: endOfStoryBackdropOpacity }]}
          >
            <Pressable
              style={StyleSheet.absoluteFillObject}
              accessibilityLabel="qa-reader-practice-prompt-dismiss"
              onPress={requestCloseEndOfStoryPrompt}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.endOfStoryDialog,
              {
                opacity: endOfStoryCardOpacity,
                transform: [
                  { translateY: endOfStoryCardTranslate },
                  { scale: endOfStoryCardScale },
                ],
              },
            ]}
          >
            <Pressable
              onPress={requestCloseEndOfStoryPrompt}
              style={styles.endOfStoryDialogClose}
              hitSlop={12}
              accessibilityLabel="qa-reader-practice-prompt-close"
            >
              <Feather name="x" size={18} color="#aebcd3" />
            </Pressable>
            {endOfStoryFace === "comment" ? (
              <>
                <View
                  style={[
                    styles.storyRatingFaceRing,
                    storyRatingLiked
                      ? styles.storyRatingFaceRingUp
                      : styles.storyRatingFaceRingDown,
                  ]}
                >
                  <Feather
                    name={storyRatingLiked ? "thumbs-up" : "thumbs-down"}
                    size={24}
                    color={storyRatingLiked ? "#9ce5c1" : "#aebcd3"}
                  />
                </View>
                <Text style={styles.endOfStoryTitle}>
                  {storyRatingLiked ? "Glad you liked it" : "Noted"}
                </Text>
                <Text style={styles.endOfStoryBody}>
                  {storyRatingLiked ? "What worked for you?" : "What put you off?"}
                  <Text style={styles.storyRatingOptional}> (optional)</Text>
                </Text>
                <TextInput
                  value={storyRatingComment}
                  onChangeText={setStoryRatingComment}
                  placeholder={
                    storyRatingLiked
                      ? "The market scene stuck with me."
                      : "Too many new words at once."
                  }
                  placeholderTextColor="#7f93ad"
                  multiline
                  maxLength={2000}
                  style={styles.storyRatingInput}
                  accessibilityLabel="qa-reader-rating-comment"
                  testID="qa-reader-rating-comment"
                />
                <Pressable
                  onPress={handleStoryRatingSend}
                  accessibilityRole="button"
                  accessibilityLabel="qa-reader-rating-send"
                  testID="qa-reader-rating-send"
                  style={styles.endOfStoryButton}
                >
                  <Feather name="send" size={15} color="#0e1727" />
                  <Text style={styles.endOfStoryButtonText}>Send</Text>
                </Pressable>
              </>
            ) : endOfStoryFace === "vote" ? (
              <>
                <View style={[styles.storyRatingFaceRing, styles.storyRatingFaceRingAsk]}>
                  <Feather name="message-circle" size={24} color="#f8c15c" />
                </View>
                <Text style={styles.endOfStoryTitle}>Before you go</Text>
                <Text style={styles.endOfStoryBody} numberOfLines={2}>
                  How was &quot;{story.title}&quot;?
                </Text>
                {/* "Didn't like it" a la izquierda y "Liked it" a la derecha: la
                    mayoría es diestra y el pulgar llega antes al lado derecho,
                    que es además donde esta app pone siempre la acción que
                    quiere que se toque. */}
                <View style={styles.storyRatingRow}>
                  <Pressable
                    onPress={() => handleStoryVote(false, "later")}
                    accessibilityRole="button"
                    accessibilityLabel="qa-reader-rating-down"
                    testID="qa-reader-rating-down"
                    style={styles.storyRatingButton}
                  >
                    <Feather name="thumbs-down" size={16} color="#dbe9ff" />
                    <Text style={styles.storyRatingButtonText}>Didn&apos;t like it</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleStoryVote(true, "later")}
                    accessibilityRole="button"
                    accessibilityLabel="qa-reader-rating-up"
                    testID="qa-reader-rating-up"
                    style={styles.storyRatingButton}
                  >
                    <Feather name="thumbs-up" size={16} color="#dbe9ff" />
                    <Text style={styles.storyRatingButtonText}>Liked it</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={closeEndOfStoryPrompt}
                  accessibilityRole="button"
                  style={styles.endOfStoryDialogSecondary}
                >
                  <Text style={styles.endOfStoryDialogSecondaryText}>Not now</Text>
                </Pressable>
              </>
            ) : (
              <>
            <View style={styles.endOfStoryTrophyRing}>
              <View style={styles.endOfStoryTrophy}>
                <Feather name="zap" size={28} color="#0e1727" />
              </View>
            </View>
            <Text style={styles.endOfStoryEyebrow}>Lock it in</Text>
            <Text style={styles.endOfStoryTitle}>
              Practice {vocab.length > 0 ? `${vocab.length} word${vocab.length === 1 ? "" : "s"}` : "what you just learned"}
            </Text>
            <Text style={styles.endOfStoryBody}>
              You remember 2× more when you practice right after the story.
            </Text>
            {vocab.length > 0 ? (
              <View style={styles.endOfStoryStatsRow}>
                <View style={styles.endOfStoryStatChip}>
                  <Feather name="book-open" size={13} color="#f8c15c" />
                  <Text style={styles.endOfStoryStatText}>{vocab.length} new words</Text>
                </View>
                <View style={styles.endOfStoryStatChip}>
                  <Feather name="clock" size={13} color="#9ce5c1" />
                  <Text style={styles.endOfStoryStatText}>~1 min</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.endOfStoryCtaWrap}>
              <Animated.View
                pointerEvents="none"
                style={[styles.endOfStoryCtaHalo, { opacity: endOfStoryCtaPulse }]}
              />
              <Pressable
                onPress={() => {
                  // Run the exit animation first, then fire the navigation
                  // so the card visually "pushes" into the practice screen.
                  runEndOfStoryExitAnimation(() => {
                    setEndOfStoryPromptVisible(false);
                    onOpenPractice();
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel="qa-reader-practice-story"
                testID="qa-reader-practice-story"
                style={styles.endOfStoryButton}
              >
                <Feather name="zap" size={16} color="#0e1727" />
                <Text style={styles.endOfStoryButtonText}>Start practice</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={requestCloseEndOfStoryPrompt}
              accessibilityRole="button"
              style={styles.endOfStoryDialogSecondary}
            >
              <Text style={styles.endOfStoryDialogSecondaryText}>Maybe later</Text>
            </Pressable>
            {showRatingRow && storyRatingJustSent ? (
              <View style={styles.storyRatingBlock}>
                <RatingSentToast onDone={() => setStoryRatingJustSent(false)} />
              </View>
            ) : showRatingRow ? (
              <View style={styles.storyRatingBlock}>
                <Text style={styles.storyRatingPrompt}>How was this story?</Text>
                <View style={styles.storyRatingRow}>
                  <Pressable
                    onPress={() => handleStoryVote(false, "practice")}
                    accessibilityRole="button"
                    accessibilityLabel="qa-reader-rating-down-inline"
                    testID="qa-reader-rating-down-inline"
                    style={[
                      styles.storyRatingButton,
                      storyRatingLiked === false ? styles.storyRatingButtonDown : null,
                    ]}
                  >
                    <Feather
                      name="thumbs-down"
                      size={16}
                      color={storyRatingLiked === false ? "#fb7185" : "#dbe9ff"}
                    />
                    <Text
                      style={[
                        styles.storyRatingButtonText,
                        storyRatingLiked === false ? styles.storyRatingButtonTextDown : null,
                      ]}
                    >
                      Didn&apos;t like it
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleStoryVote(true, "practice")}
                    accessibilityRole="button"
                    accessibilityLabel="qa-reader-rating-up-inline"
                    testID="qa-reader-rating-up-inline"
                    style={[
                      styles.storyRatingButton,
                      storyRatingLiked === true ? styles.storyRatingButtonUp : null,
                    ]}
                  >
                    <Feather
                      name="thumbs-up"
                      size={16}
                      color={storyRatingLiked === true ? "#9ce5c1" : "#dbe9ff"}
                    />
                    <Text
                      style={[
                        styles.storyRatingButtonText,
                        storyRatingLiked === true ? styles.storyRatingButtonTextUp : null,
                      ]}
                    >
                      Liked it
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
              </>
            )}
          </Animated.View>
        </View>
      ) : null}

      {selectedVocab ? (
        // Use pointerEvents="box-none" so taps on words in the ScrollView
        // below pass through; tapping a different highlighted word simply
        // switches the popup to that word instead of needing a separate
        // tap-to-close first. Tapping blank paragraph space closes the popup
        // via the Pressable wrapper around each block.
        <View
          style={[styles.vocabOverlay, { paddingBottom: playerDockHeight + 12 }]}
          pointerEvents="box-none"
          accessibilityLabel="qa-reader-vocab-overlay"
          testID="qa-reader-vocab-overlay"
        >
          <Pressable style={styles.vocabBubbleWrap} onPress={() => undefined}>
            <View style={styles.vocabBubble} accessibilityLabel="qa-reader-vocab-bubble" testID="qa-reader-vocab-bubble">
              <View style={styles.vocabBubbleHeader}>
                <View style={styles.vocabBubbleTitleStack}>
                  <Text style={styles.vocabBubbleWord}>{selectedVocab.word}</Text>
                  {selectedVocab.quickLookup ? (
                    <View style={styles.vocabBubbleQuickLookupBadge}>
                      <Feather name="search" size={10} color="#cbd5e1" />
                      <Text style={styles.vocabBubbleQuickLookupText}>Quick lookup</Text>
                    </View>
                  ) : null}
                  {(() => {
                    // Small type badge under the word (Verb / Noun / etc.)
                    // Tinted with the same hue family as the inline pill so
                    // the visual association is reinforced from the popup.
                    const normalizedType = normalizeVocabType(selectedVocab.type, {
                      word: selectedVocab.word,
                      definition: selectedVocab.definition,
                    });
                    if (!normalizedType || normalizedType === "other") return null;
                    return (
                      <View
                        style={[
                          styles.vocabBubbleTypeBadge,
                          { backgroundColor: VOCAB_TYPE_BACKGROUNDS[normalizedType] },
                        ]}
                      >
                        <Text style={styles.vocabBubbleTypeBadgeText}>
                          {getVocabTypeLabel(normalizedType)}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <Pressable onPress={() => setSelectedVocab(null)} style={styles.vocabClose}>
                  <Text style={styles.vocabCloseText}>×</Text>
                </Pressable>
              </View>
              {compactDefinition ? (
                <Text style={styles.vocabBubbleDefinition}>{compactDefinition}</Text>
              ) : null}
              <View style={styles.vocabActionRow}>
                <SaveWordButton
                  word={selectedVocab.word}
                  saved={isFavoriteWord(selectedVocab.word)}
                  onToggle={(desiredSaved) =>
                    onToggleFavoriteWord(selectedVocab, selectedVocab.note, desiredSaved)
                  }
                />
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}

      {showOnboardingPlayHint ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: playerDockHeight + 10,
            alignItems: "center",
            paddingHorizontal: 16,
            zIndex: 50,
          }}
        >
          <Pressable
            onPress={onDismissOnboardingPlayHint}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tip"
            style={{
              maxWidth: 340,
              backgroundColor: "#2563eb",
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
              This is your free story this week.
            </Text>
            <Text style={{ color: "#fff", fontSize: 13, marginTop: 2, opacity: 0.95 }}>
              Press play below to start listening; tap to dismiss.
            </Text>
            <View
              style={{
                position: "absolute",
                bottom: -6,
                left: "50%",
                marginLeft: -6,
                width: 12,
                height: 12,
                backgroundColor: "#2563eb",
                transform: [{ rotate: "45deg" }],
              }}
            />
          </Pressable>
        </View>
      ) : null}

      <Animated.View
        // Hidden (and inert) while the end-of-story practice card is up, so the
        // player doesn't sit lit on top of the dimmed backdrop.
        pointerEvents={endOfStoryPromptVisible ? "none" : "auto"}
        style={[
          styles.playerDock,
          { paddingBottom: 4 + androidBottomInset, opacity: playerDockOpacity },
        ]}
        onLayout={(e) => {
          const next = e.nativeEvent.layout.height;
          if (next > 0 && Math.abs(next - playerDockHeight) > 1) {
            setPlayerDockHeight(next);
          }
        }}
      >
        <NativeAudioPlayer
          src={audioUrl}
          variant="sticky"
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onPrevious={onPreviousStory}
          onNext={onNextStory}
          onLoadError={(details) => {
            // If the local offline copy fails (truncated/corrupt download),
            // flip to the remote URL. `audioUrl` recomputes based on
            // `offlineAudioFailed` so NativeAudioPlayer will re-mount with
            // the fresh http(s) URL and attempt playback again.
            if (details.src.startsWith("file://") && !offlineAudioFailed) {
              setOfflineAudioFailed(true);
              // Self-heal: nuke the corrupt file so the next hydrate pass
              // downloads a fresh copy instead of reusing the broken one.
              // Best-effort, ignore delete errors; the resumable downloader
              // will validate Content-Length on the re-download anyway.
              void FileSystem.deleteAsync(details.src, { idempotent: true }).catch(() => undefined);
            }
          }}
          onProgressChange={(playback) => {
            // Karaoke seam: store a snapshot of the player's position so
            // the 50 ms interpolation interval can extrapolate between
            // these 500 ms ticks. The player's own update cadence is too
            // coarse for word-level highlighting on its own.
            if (karaokeActive && playback.isLoaded) {
              lastPlaybackRef.current = {
                positionMillis: playback.positionMillis,
                durationMillis: playback.durationMillis,
                wallClockMs: Date.now(),
                isPlaying: playback.isPlaying,
                rate: playback.rate || 1,
              };
            }
            if (playback.isLoaded && playback.durationMillis > 0) {
              const progressSec = playback.positionMillis / 1000;
              const durationSec = playback.durationMillis / 1000;
              const ratio = durationSec > 0 ? progressSec / durationSec : 0;
              const shouldPersist =
                playback.isPlaying
                  ? progressSec >= 15 && Math.abs(progressSec - (lastPersistedProgressSecRef.current ?? 0)) >= 20
                  : ratio >= 0.95 || progressSec >= 15;
              if (shouldPersist) {
                void persistContinueListening(progressSec, durationSec);
              }
              // Audio-path trigger: fire ONLY when the narration actually
              // finishes (expo-av's didJustFinish). Per-request the
              // scroll-to-end trigger was removed, so audio completion is
              // now the single source of truth for the end-of-story prompt.
              if (playback.didJustFinish) {
                maybeFireEndOfStoryPrompt();
                // Tell the server the story audio is done so the journey
                // pill flips to "audioFinished" (border = topic color,
                // check badge bottom-right). Guarded against duplicates
                // because didJustFinish can re-fire when the player
                // re-emits ticks at position=duration.
                if (
                  audioCompleteFiredForStoryRef.current !== story.id &&
                  onTrackReaderEvent &&
                  story.slug
                ) {
                  audioCompleteFiredForStoryRef.current = story.id;
                  // El journey siempre usa `standalone:<slug>` como
                  // progressKey para sus stories (ver
                  // src/app/journey/journeyData.ts:561), aunque la
                  // story venga de un libro del catálogo. Si
                  // mandáramos `<bookSlug>:<slug>` el set lookup en
                  // `getCompletedJourneyStoryKeys` no haría match y el
                  // pill del journey nunca se repintaría.
                  const progressKey = `standalone:${story.slug}`;
                  onTrackReaderEvent("audio_complete", {
                    storySlug: story.slug,
                    bookSlug: book.slug,
                    value: Math.round((playback.durationMillis ?? 0) / 1000),
                    metadata: {
                      progressKey,
                      progressSec: Math.round((playback.positionMillis ?? 0) / 1000),
                      audioDurationSec: Math.round((playback.durationMillis ?? 0) / 1000),
                      source: "mobile_reader",
                    },
                  });
                }
              }
            }

            if (!playback.isLoaded || !playback.isPlaying || playback.durationMillis <= 0) {
              return;
            }

            const nextRatio = Math.min(1, Math.max(0, playback.positionMillis / playback.durationMillis));
            if (Math.abs(nextRatio - lastAutoScrollRatioRef.current) < 0.01) {
              return;
            }

            // Honor the user's touch grace window: do not animate the
            // ScrollView while the user is tapping vocab pills, otherwise
            // the inline targets move under their finger.
            if (Date.now() - lastUserTouchAtRef.current < 1800) {
              return;
            }

            const scrollableHeight = Math.max(
              contentHeightRef.current - viewportHeightRef.current - afterTextHeightRef.current,
              0
            );
            if (scrollableHeight <= 0 || !scrollViewRef.current) {
              return;
            }

            lastAutoScrollRatioRef.current = nextRatio;
            const estimatedBlockIndex = Math.min(
              blocks.length - 1,
              Math.max(0, Math.round(nextRatio * Math.max(blocks.length - 1, 0)))
            );
            activeBlockIndexRef.current = estimatedBlockIndex;
            trackReadingPosition(nextRatio, estimatedBlockIndex);
            // Scroll lineal sólo cuando NO hay karaoke activo. Con karaoke un
            // useEffect aparte conduce un scroll inteligente que ancla la
            // palabra activa al 40% vertical de la pantalla; leer "del medio"
            // mientras el texto rueda por debajo. Sin karaoke no tenemos
            // posición de palabra, así que caemos al mapeo lineal ratio→Y que
            // ya funcionaba. Ojo: la condición es `karaokeActive`, no
            // `wordTimings`. Si mirara los timings, apagar el karaoke desde
            // ajustes dejaría el lector SIN ningún autoscroll (el inteligente
            // apagado y el lineal inhibido), que se siente roto, no opcional.
            if (karaokeActive) {
              return;
            }
            scrollViewRef.current.scrollTo({
              y: nextRatio * scrollableHeight,
              animated: true,
            });
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 172,
  },
  containerGrow: {
    flexGrow: 1,
  },
  floatingBackButton: {
    position: "absolute",
    top: 18,
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(4, 9, 17, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    borderRadius: 999,
    backgroundColor: "#132238",
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "#2d4562",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActiveSaved: {
    // Soft amber tint for the "saved" state so the whole button reads as
    // active, not just the icon colour.
    backgroundColor: "rgba(248, 193, 92, 0.14)",
    borderColor: "rgba(248, 193, 92, 0.38)",
  },
  iconButtonDownloadHalo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: "#8ef0c6",
  },
  iconButtonActiveDownloaded: {
    // Soft green tint for the "downloaded and ready offline" state.
    backgroundColor: "rgba(142, 240, 198, 0.12)",
    borderColor: "rgba(142, 240, 198, 0.38)",
  },
  iconButtonPressed: {
    // Subtle press feedback (scale down + slight opacity) so every tap
    // has a tactile confirmation without being flashy.
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  iconButtonText: {
    color: "#cfe3ff",
    fontWeight: "700",
    fontSize: 13,
  },
  headerBlock: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 4,
  },
  storyTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  metaPills: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3d5470",
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "rgba(21, 37, 58, 0.55)",
  },
  activePill: {
    borderColor: "#9f7f35",
    backgroundColor: "rgba(157, 124, 44, 0.22)",
  },
  pillText: {
    color: "#d7e2f1",
    fontSize: 11,
    fontWeight: "700",
  },
  activePillText: {
    color: "#f4d58e",
  },
  readerCover: {
    width: "100%",
    height: 196,
    borderRadius: 16,
    backgroundColor: "#132237",
    borderWidth: 1,
    borderColor: "#28415f",
  },
  textWrap: {
    gap: 8,
  },
  practiceStoryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#f8c15c",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  practiceStoryButtonText: {
    color: "#0e1727",
    fontSize: 13,
    fontWeight: "800",
  },
  endOfStoryBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  endOfStoryBackdropPress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 9, 17, 0.78)",
  },
  endOfStoryBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 9, 17, 0.78)",
  },
  endOfStoryCtaWrap: {
    alignSelf: "stretch",
    position: "relative",
    marginTop: 2,
  },
  endOfStoryCtaHalo: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 999,
    backgroundColor: "rgba(248, 193, 92, 0.35)",
  },
  endOfStoryDialog: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 26,
    backgroundColor: "#152844",
    borderWidth: 1,
    borderColor: "#2d476b",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: "center",
    gap: 8,
  },
  storyRatingBlock: {
    alignSelf: "stretch",
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.09)",
  },
  storyRatingButtonUp: {
    borderColor: "#9ce5c1",
    backgroundColor: "rgba(156, 229, 193, 0.14)",
  },
  storyRatingButtonDown: {
    borderColor: "#fb7185",
    backgroundColor: "rgba(251, 113, 133, 0.14)",
  },
  storyRatingButtonTextUp: {
    color: "#9ce5c1",
  },
  storyRatingButtonTextDown: {
    color: "#fb7185",
  },
  storyRatingOptional: {
    color: "#8aa0bd",
    fontSize: 13,
  },
  storyRatingThanksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  storyRatingThanksText: {
    color: "#9ce5c1",
    fontSize: 13,
    fontWeight: "700",
  },
  storyRatingPrompt: {
    color: "#8aa0bd",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  storyRatingRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 8,
  },
  storyRatingButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2d476b",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  storyRatingButtonText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  storyRatingFaceRing: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },
  storyRatingFaceRingUp: {
    backgroundColor: "rgba(156, 229, 193, 0.14)",
    borderColor: "rgba(156, 229, 193, 0.3)",
  },
  storyRatingFaceRingDown: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "#2d476b",
  },
  storyRatingFaceRingAsk: {
    backgroundColor: "rgba(248, 193, 92, 0.14)",
    borderColor: "rgba(248, 193, 92, 0.28)",
  },
  storyRatingInput: {
    alignSelf: "stretch",
    minHeight: 76,
    maxHeight: 140,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "#2d476b",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#eaf2ff",
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
    marginTop: 2,
    marginBottom: 4,
  },
  endOfStoryDialogClose: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 6,
    zIndex: 2,
  },
  endOfStoryTrophyRing: {
    width: 86,
    height: 86,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248, 193, 92, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(248, 193, 92, 0.28)",
    marginBottom: 4,
  },
  endOfStoryTrophy: {
    width: 62,
    height: 62,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8c15c",
  },
  endOfStoryEyebrow: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  endOfStoryTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
    textAlign: "center",
  },
  endOfStoryBody: {
    color: "#cfdbec",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 4,
  },
  endOfStoryStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    marginBottom: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  endOfStoryStatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  endOfStoryStatText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
  },
  endOfStoryButton: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#f8c15c",
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 2,
  },
  endOfStoryButtonText: {
    color: "#0e1727",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  endOfStoryDialogSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  endOfStoryDialogSecondaryText: {
    color: "#9cb0c9",
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#243953",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f8c15c",
  },
  textCard: {
    gap: 20,
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  paragraphBlock: {
    gap: 0,
  },
  readerPracticeCard: {
    marginTop: 28,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "rgba(82,160,214,0.10)",
    borderWidth: 1,
    borderColor: "rgba(82,160,214,0.28)",
    gap: 6,
  },
  readerPracticeCardTitle: {
    color: "#eef4ff",
    fontSize: 18,
    fontWeight: "800",
  },
  readerPracticeCardBody: {
    color: "#9cb0c9",
    fontSize: 14,
    lineHeight: 19,
  },
  readerPracticeCardButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#f8c15c",
  },
  readerPracticeCardButtonText: {
    color: "#0c1626",
    fontSize: 15,
    fontWeight: "800",
  },
  readerFeedbackLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
  },
  readerFeedbackLinkText: {
    color: "#8aa0bd",
    fontSize: 12.5,
    fontWeight: "600",
  },
  quoteBlock: {
    gap: 4,
    paddingLeft: 0,
  },
  paragraph: {
    color: "#eef4ff",
    fontSize: 20,
    // Wider paragraph line-height so highlighted background boxes can never
    // touch the adjacent line's box. 40 (paragraph) - 24 (highlight) = 16 px
    // of guaranteed vertical separation.
    lineHeight: 40,
    // Android adds asymmetric font padding to <Text> by default, which
    // pushed the gap text (commas/periods between the inline <View> word
    // pills) off the shared baseline: punctuation visibly floated above or
    // below the line. Turning it off makes gap text and word text share the
    // same metric so punctuation sits on the line. No-op on iOS.
    includeFontPadding: false,
  },
  quoteParagraph: {
    color: "#e5eefb",
    fontSize: 20,
    lineHeight: 40,
    includeFontPadding: false,
  },
  // Kept for the (rare) case where the renderer falls back to a plain
  // <Text> instead of the <View> pill (e.g. already-highlighted duplicates
  // in the same paragraph).
  highlightedWord: {
    color: "#1a1205",
    fontSize: 20,
    lineHeight: 24,
    backgroundColor: "#f8c15c",
    fontWeight: "700",
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  highlightedPill: {
    // Inline <View> embedded via NSTextAttachment. iOS places the View so
    // its TOP aligns with the surrounding line's top (ascender), which puts
    // the visible block too low relative to the text baseline. A small
    // negative translateY shifts the pill up so it visually centers on the
    // text's cap-height band.
    //
    // Vocab pills are now sky-blue: warm amber is reserved for the
    // karaoke active highlight, so vocab gets a cool hue to read as a
    // distinct kind of mark.
    backgroundColor: "rgba(125, 211, 252, 0.55)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    transform: [{ translateY: -4 }],
  },
  highlightedPillText: {
    // Dark navy text reads cleanly on top of the sky-blue vocab pill.
    color: "#0e1727",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 20,
  },
  // Karaoke (word-level audio highlight) styles. iOS NSTextAttachment
  // does not consistently honor negative `margin` on inline <View>
  // wrappers, so we keep the active pill's bounding box at exactly the
  // text's natural width; zero horizontal padding, just a tight
  // rounded background; to avoid the surrounding line being pushed
  // sideways every time the highlight advances.
  // Estilos legacy `karaokeActivePill`, `karaokeActivePillText` e
  // `karaokeActiveInlineText` (con `#fcd34d`, amarillo vivo) eliminados.
  // El active highlight actual vive en `karaokeWordContainerActive` /
  // `karaokeWordContainerActiveVocab` con el `#f8c15c` unificado de
  // todos los popups y badges de la app. Tener dos amarillos
  // distintos provocaba un flash cuando el motor de styles aplicaba
  // primero los legacy y después los nuevos.
  // === Per-word inline <View> wrappers (every karaoke word) ===
  // Two-layer structure to give the inline attachment the same baseline
  // as the surrounding paragraph text. The outer wrapper occupies the
  // full 40 px line height (via vertical padding) so iOS computes the
  // line's baseline from a 40 px element instead of the 24 px inner
  // pill; periods and commas in the gap text then sit on the correct
  // line baseline. The inner wrapper carries the visible rounded
  // background and is naturally sized by its 24 px inner Text.
  karaokeWordOuter: {
    // Empirical sweep: (8,8) sat slightly low, (12,4) sat slightly high.
    // (10,6) is the middle of those two and should land at the visual
    // baseline of the surrounding text.
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 0,
  },
  karaokeWordContainerPlain: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 6,
  },
  // Vocab pill: same padding + bold + size as the legacy highlightedPill
  // so the transition from the first paint to the karaoke render is
  // visually invisible. Sky-blue background marks "this word has a
  // definition" without competing with the warm amber active highlight.
  karaokeWordContainerVocab: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: "rgba(125, 211, 252, 0.55)",
  },
  // Active highlight ON a vocab word: same padding/weight footprint as
  // the resting vocab pill, so toggling only swaps the background from
  // the cool sky-blue to the warm amber.
  karaokeWordContainerActiveVocab: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: "#f8c15c",
  },
  // Active highlight on a non-vocab word: tight pill, no padding so
  // toggling onto/off a plain word does not shift surrounding text.
  karaokeWordContainerActive: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 6,
    backgroundColor: "#f8c15c",
  },
  karaokeWordText: {
    color: "#eef4ff",
    fontSize: 20,
    lineHeight: 24,
    includeFontPadding: false,
  },
  karaokeWordTextDark: {
    // Dark navy text on warm amber active background.
    color: "#0e1727",
    fontSize: 20,
    lineHeight: 24,
    includeFontPadding: false,
  },
  karaokeWordTextVocabBold: {
    // Dark navy text on sky-blue vocab background; same dark hue as
    // the legacy reader's vocab pill so the pre-fetch / post-fetch
    // transition is invisible.
    color: "#0e1727",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
    includeFontPadding: false,
  },
  karaokeWordTextVocabWhite: {
    // White text variant for the vocab palette sandbox. Pairs with the
    // saturated colored pills so each highlighted word stays readable.
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
    includeFontPadding: false,
  },
  vocabOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 118,
    backgroundColor: "rgba(6, 14, 25, 0.16)",
  },
  vocabBubbleWrap: {
    width: "100%",
  },
  vocabBubble: {
    backgroundColor: "#0f2138",
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#28415f",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  vocabBubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  vocabBubbleTitleStack: {
    flex: 1,
    gap: 2,
  },
  vocabBubbleWord: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  vocabBubbleTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 4,
  },
  vocabBubbleTypeBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  // Chip "Quick lookup" (piloto tap-any-word): gris neutro para distinguir
  // una palabra glosada on-the-fly del vocab curado (que lleva su color de
  // tipo). Mismo lenguaje visual que el chip Quick lookup del reader web.
  vocabBubbleQuickLookupBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 4,
    backgroundColor: "rgba(148, 163, 184, 0.28)",
  },
  vocabBubbleQuickLookupText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  vocabClose: {
    borderRadius: 999,
    backgroundColor: "#213754",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  vocabCloseText: {
    color: "#dbe9ff",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18,
  },
  vocabBubbleDefinition: {
    color: "#eef4ff",
    fontSize: 15,
    lineHeight: 22,
  },
  vocabAction: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1e3a5f",
    borderWidth: 1,
    // Cool cyan hint on the resting state so the chip reads as
    // "tap me to keep this word" rather than as flat metadata. The
    // glow matches the sky-blue family used by vocab pills, so the
    // user feels like they are saving the same hue they just tapped.
    borderColor: "rgba(125, 211, 252, 0.5)",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  vocabActionActive: {
    // Gold matches the bookmark icon in the top bar and the karaoke
    // active highlight; both signals already mean "this is yours
    // now". Reusing the hue ties the save action into the same
    // visual language instead of inventing a third color.
    backgroundColor: "#f8c15c",
    borderColor: "rgba(248, 193, 92, 0.95)",
    shadowColor: "#f8c15c",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  vocabActionRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  vocabActionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  vocabActionTextActive: {
    color: "#0e1727",
    fontWeight: "800",
  },
  playerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },
});
