import { getPresignedGetUrl, isSignedAudioEnabled } from "@/lib/objectStorage";

/**
 * Firmador de URLs de audio. Vive SOLO en el servidor: firmar necesita el
 * secreto de R2, asi que ningun componente cliente puede construir una URL
 * de audio por su cuenta; le tiene que llegar ya firmada por props o por la
 * respuesta de la API.
 *
 * Contrato:
 * - La base de datos NO se migra. La URL publica de siempre sigue siendo el
 *   identificador canonico; de su path sacamos la key y emitimos un presigned
 *   GET del bucket privado en el momento de entregar.
 * - Con MEDIA_SIGNED_AUDIO apagado todo es passthrough: mismo comportamiento
 *   que hoy, byte a byte.
 * - Lo que no reconocemos (Sanity, Modal, un mp3 de terceros, una ruta local
 *   de /public) pasa tal cual. Firmar de menos deja una URL publica; firmar
 *   de mas rompe la reproduccion.
 */

/**
 * Prefijos de key que pasan al bucket privado. Salen de barrer las URLs de
 * audio que hay HOY en la base, no del molde que uno se imagina: ademas de
 * generated y catalog estan las practicas, las subidas del Studio, la cache
 * de segmentos multivoz, y las historias de CreateStory y standalone, que
 * guardan el mp3 dentro de una carpeta por slug.
 *
 * Los scripts de copia y de purga filtran con `isSignableAudioKey`, la misma
 * funcion que usa el firmador. Un prefijo firmado pero sin copiar es un audio
 * roto; uno copiado pero sin firmar es un audio que sigue publico.
 */
export const SIGNED_AUDIO_PREFIXES = [
  "media/generated/audio/",
  "media/catalog/audio/",
  "media/practice/",
  "media/practice-clips/",
  "media/uploads/audio/",
  "media/multivoice-segments/",
  "media/multivoice-align-temp/",
  "media/polyglot/",
  "media/standalone/",
] as const;

/**
 * Las carpetas por slug (`media/polyglot/<slug>/`, `media/standalone/<slug>/`)
 * guardan la PORTADA junto al mp3, y las portadas siguen publicas a proposito:
 * las piden los correos y las paginas sin sesion. Por eso el prefijo no basta
 * y se mira tambien la extension.
 */
const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".opus", ".aac", ".flac"];

export function isSignableAudioKey(key: string): boolean {
  if (!SIGNED_AUDIO_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  const lower = key.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Vida de una URL firmada: 24 h (decision de la tanda, no se reabre). */
export const SIGNED_AUDIO_TTL_SECONDS = 86400;

export function isSignedAudioFlagOn(): boolean {
  return isSignedAudioEnabled();
}

/**
 * Saca la key de almacenamiento de una URL guardada. Acepta las dos formas en
 * que el audio vive en la base: URL absoluta del host publico de R2, y ruta
 * relativa que empieza por /media/. Devuelve null si no es audio nuestro.
 */
export function extractAudioKey(stored: string | null | undefined): string | null {
  const value = typeof stored === "string" ? stored.trim() : "";
  if (!value) return null;

  let path: string;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      path = new URL(value).pathname;
    } catch {
      return null;
    }
  } else if (value.startsWith("/")) {
    path = value;
  } else {
    return null;
  }

  // Una URL ya firmada trae query; el pathname ya la deja fuera.
  let key: string;
  try {
    key = decodeURIComponent(path.replace(/^\/+/, ""));
  } catch {
    key = path.replace(/^\/+/, "");
  }

  if (!key) return null;
  if (!isSignableAudioKey(key)) return null;
  return key;
}

/**
 * Firma una URL de audio guardada. Passthrough si el flag esta apagado, si la
 * URL no es audio nuestro, o si el almacenamiento no esta configurado.
 */
export function signAudioUrl(stored: string | null | undefined): string | null {
  const value = typeof stored === "string" ? stored.trim() : "";
  if (!value) return null;
  if (!isSignedAudioEnabled()) return value;

  const key = extractAudioKey(value);
  if (!key) return value;

  const signed = getPresignedGetUrl({ key, expiresInSeconds: SIGNED_AUDIO_TTL_SECONDS });
  return signed ?? value;
}

/**
 * Variante para el catalogo de libros, cuyo `story.audio` puede ser solo el
 * nombre del archivo (el volcado estatico de src/data/books guarda
 * "mi-historia.mp3", no una URL). Normaliza a la key de catalogo y firma.
 * Fuera del servidor esto no existe: resolveCatalogAudioUrl, que hace lo
 * mismo en el cliente, no puede firmar.
 */
export function signCatalogAudioUrl(stored: string | null | undefined): string | null {
  const value = typeof stored === "string" ? stored.trim() : "";
  if (!value) return null;
  if (!isSignedAudioEnabled()) return value;

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return signAudioUrl(value);
  }

  const filename = value.replace(/^\/+/, "");
  const withExtension = filename.endsWith(".mp3") ? filename : `${filename}.mp3`;
  const signed = getPresignedGetUrl({
    key: `media/catalog/audio/${withExtension}`,
    expiresInSeconds: SIGNED_AUDIO_TTL_SECONDS,
  });
  return signed ?? value;
}

type UnknownRecord = Record<string, unknown>;

/**
 * Mapea `url` y `prevUrl` dentro de JourneyStory.audioFragments (las tomas por
 * seccion). El JSON se devuelve con la MISMA forma: esta funcion no valida ni
 * normaliza nada, solo firma las dos claves que llevan URL. Si el valor no es
 * un array, vuelve intacto.
 */
export function signAudioFragments<T>(fragments: T): T {
  if (!isSignedAudioEnabled()) return fragments;
  if (!Array.isArray(fragments)) return fragments;

  const signed = fragments.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const record = entry as UnknownRecord;
    const next: UnknownRecord = { ...record };
    if (typeof record.url === "string") next.url = signAudioUrl(record.url);
    if (typeof record.prevUrl === "string") next.prevUrl = signAudioUrl(record.prevUrl);
    return next;
  });

  return signed as unknown as T;
}

/**
 * Firma las URLs de audio de un payload de ejercicio de practica
 * (`audioClip.clipUrl`, `audioClip.cachedUrl`, `wordClipUrl`), respetando el
 * resto del JSON. Los ejercicios guardan el payload entero y cada tipo pone
 * las URLs en un sitio distinto, asi que recorremos en profundidad y firmamos
 * por nombre de clave.
 */
const PRACTICE_URL_KEYS = new Set([
  "clipUrl",
  "cachedUrl",
  "wordClipUrl",
  "audioUrl",
  "url",
  "sectionUrl",
  "prevSectionUrl",
  "prevUrl",
  "titleSectionUrl",
  "titlePrevSectionUrl",
  "audioUrlPreview",
]);

export function signAudioUrlsDeep<T>(payload: T): T {
  if (!isSignedAudioEnabled()) return payload;
  return walkAndSign(payload, 0) as T;
}

function walkAndSign(value: unknown, depth: number): unknown {
  // Tope de profundidad: los payloads de practica son planos y un JSON
  // arbitrario de la base no deberia poder hacernos recorrer sin fondo.
  if (depth > 8) return value;
  if (Array.isArray(value)) return value.map((entry) => walkAndSign(entry, depth + 1));
  if (!value || typeof value !== "object") return value;

  const record = value as UnknownRecord;
  const next: UnknownRecord = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string" && PRACTICE_URL_KEYS.has(key)) {
      next[key] = signAudioUrl(entry);
      continue;
    }
    next[key] = walkAndSign(entry, depth + 1);
  }
  return next;
}
