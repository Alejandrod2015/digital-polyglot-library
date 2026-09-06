import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY_LEGACY = "digital-polyglot/mobile-preview-state";

// FileSystem persiste entre reinstalls vía xcodebuild a diferencia de
// SecureStore con dev certs. Reading progress + saved books/stories
// son demasiado importantes para perderlos en cada build.
const PREVIEW_ROOT = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;

/**
 * Un archivo POR CUENTA, igual que las colecciones y los favoritos.
 *
 * Hasta el 2026-09-06 habia uno solo para todo el telefono, sin el id de nadie,
 * asi que las historias guardadas y el progreso de lectura eran del APARATO y
 * no de quien iniciaba sesion: al entrar con otra cuenta se pintaba lo de la
 * anterior. Solo desaparecia de la vista porque la estanteria unicamente
 * muestra lo guardado del idioma que esa cuenta acaba de cargar; el apunte
 * seguia ahi, y con el el "seguir leyendo" y el contador semanal.
 */
function getPreviewPath(userId?: string | null): string {
  return `${PREVIEW_ROOT}/preview-state-${userId ?? "guest"}.json`;
}

/** El archivo unico de antes. Se adopta una vez y se retira. */
const PREVIEW_PATH_SHARED = `${PREVIEW_ROOT}/preview-state.json`;

async function ensurePreviewRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PREVIEW_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PREVIEW_ROOT, { intermediates: true });
  }
}

export type ReadingProgress = {
  bookId: string;
  storyId: string;
  title: string;
  updatedAt: string;
  progressRatio?: number;
  currentBlockIndex?: number;
  totalBlocks?: number;
};

export type MobilePreviewState = {
  savedBookIds: string[];
  savedStoryIds: string[];
  readingProgress: ReadingProgress[];
  /** Cuándo se guardó cada historia (ISO), por id. `savedStoryIds` es un array
   *  al que se añade al final, así que su orden es el de guardado MÁS ANTIGUO
   *  primero, justo al revés de lo que la estantería quiere enseñar. Lo que
   *  llega de la cuenta trae su propia fecha del servidor; esto cubre lo que se
   *  guarda en el teléfono. Sin entrada = desconocido, va al final. */
  savedStoryAt: Record<string, string>;
};

function sanitizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && entry) out[key] = entry;
  }
  return out;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function sanitizeReadingProgress(value: unknown): ReadingProgress[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ReadingProgress => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof item.bookId === "string" &&
        typeof item.storyId === "string" &&
        typeof item.title === "string" &&
        typeof item.updatedAt === "string"
      );
    })
    .map((item) => ({
      ...item,
      progressRatio:
        typeof item.progressRatio === "number" && Number.isFinite(item.progressRatio)
          ? Math.min(1, Math.max(0, item.progressRatio))
          : undefined,
      currentBlockIndex:
        typeof item.currentBlockIndex === "number" && Number.isFinite(item.currentBlockIndex)
          ? Math.max(0, Math.floor(item.currentBlockIndex))
          : undefined,
      totalBlocks:
        typeof item.totalBlocks === "number" && Number.isFinite(item.totalBlocks)
          ? Math.max(0, Math.floor(item.totalBlocks))
          : undefined,
    }))
    .slice(0, 8);
}

function parseState(raw: string, fallback: MobilePreviewState): MobilePreviewState {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      savedBookIds: sanitizeStringArray(parsed.savedBookIds),
      savedStoryIds: sanitizeStringArray(parsed.savedStoryIds),
      readingProgress: sanitizeReadingProgress(parsed.readingProgress),
      savedStoryAt: sanitizeStringMap(parsed.savedStoryAt),
    };
  } catch {
    return fallback;
  }
}

export async function loadMobilePreviewState(
  fallback: MobilePreviewState,
  userId?: string | null,
): Promise<MobilePreviewState> {
  await ensurePreviewRoot();
  const path = getPreviewPath(userId);

  // Path 1: el archivo de esta cuenta.
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(path);
      return parseState(raw, fallback);
    }
  } catch {
    // ignore, fall through
  }

  // Path 2: el archivo compartido de las versiones anteriores. Lo hereda la
  // PRIMERA cuenta que abra la app despues de actualizar, y acto seguido se
  // borra: si se dejara, cada cuenta nueva volveria a heredarlo y estariamos
  // en el mismo sitio.
  try {
    const info = await FileSystem.getInfoAsync(PREVIEW_PATH_SHARED);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(PREVIEW_PATH_SHARED);
      const adopted = parseState(raw, fallback);
      await FileSystem.writeAsStringAsync(path, JSON.stringify(adopted));
      await FileSystem.deleteAsync(PREVIEW_PATH_SHARED, { idempotent: true });
      return adopted;
    }
  } catch {
    // ignore, fall through to legacy
  }

  // Path 3: migracion desde el SecureStore viejo, que tampoco distinguia
  // cuentas. Misma regla: la adopta uno y se borra la entrada.
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY_LEGACY);
    if (raw) {
      const migrated = parseState(raw, fallback);
      await FileSystem.writeAsStringAsync(path, JSON.stringify(migrated));
      await SecureStore.deleteItemAsync(STORAGE_KEY_LEGACY);
      return migrated;
    }
  } catch {
    // ignore
  }

  return fallback;
}

export async function saveMobilePreviewState(
  state: MobilePreviewState,
  userId?: string | null,
): Promise<void> {
  try {
    await ensurePreviewRoot();
    await FileSystem.writeAsStringAsync(getPreviewPath(userId), JSON.stringify(state));
  } catch {
    // Preview-mode persistence should fail quietly instead of breaking the app shell.
  }
}
