import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";

const MOBILE_SESSION_KEY = "digital-polyglot/mobile-session-token";
// Backup del token en filesystem plano. Sí, es menos seguro que
// Keychain, pero SecureStore puede retornar null en cold-start
// offline (antes de que el dispositivo desbloquee el keychain) y eso
// dejaba al usuario en AuthScreen sin manera de recuperarse. El token
// es un JWT con expiración corta; la pérdida de seguridad por
// guardarlo en plain es menor que la pérdida de usabilidad por dejar
// la app inutilizable offline.
const TOKEN_BACKUP_PATH = `${FileSystem.documentDirectory ?? ""}digital-polyglot/mobile-session-token.txt`;

export type MobileSessionPayload = {
  aud: "digital-polyglot-mobile";
  sub: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  targetLanguages: string[];
  booksCount: number;
  storiesCount: number;
  iat: number;
  exp: number;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return globalThis.atob(padded);
}

export function decodeMobileSessionToken(token: string): MobileSessionPayload | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as Partial<MobileSessionPayload>;
    if (
      parsed.aud !== "digital-polyglot-mobile" ||
      typeof parsed.sub !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    return {
      aud: "digital-polyglot-mobile",
      sub: parsed.sub,
      email: typeof parsed.email === "string" ? parsed.email : null,
      name: typeof parsed.name === "string" ? parsed.name : null,
      plan: typeof parsed.plan === "string" ? parsed.plan : null,
      targetLanguages: Array.isArray(parsed.targetLanguages)
        ? parsed.targetLanguages.filter((item): item is string => typeof item === "string")
        : [],
      booksCount: typeof parsed.booksCount === "number" ? parsed.booksCount : 0,
      storiesCount: typeof parsed.storiesCount === "number" ? parsed.storiesCount : 0,
      iat: parsed.iat,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

async function ensureTokenBackupDir(): Promise<void> {
  const parent = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;
  try {
    const info = await FileSystem.getInfoAsync(parent);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
    }
  } catch {
    // ignore
  }
}

async function loadTokenBackup(): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(TOKEN_BACKUP_PATH);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(TOKEN_BACKUP_PATH);
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

async function saveTokenBackup(token: string): Promise<void> {
  try {
    await ensureTokenBackupDir();
    await FileSystem.writeAsStringAsync(TOKEN_BACKUP_PATH, token);
  } catch {
    // ignore
  }
}

async function clearTokenBackup(): Promise<void> {
  try {
    await FileSystem.deleteAsync(TOKEN_BACKUP_PATH, { idempotent: true });
  } catch {
    // ignore
  }
}

export async function loadMobileSessionToken(): Promise<string | null> {
  // Read both in parallel; SecureStore is preferred but the filesystem
  // backup catches the case where SecureStore returns null on a cold
  // offline start (Keychain not yet unlocked, intermittent Keychain
  // failures, etc.).
  const [secure, backup] = await Promise.all([
    SecureStore.getItemAsync(MOBILE_SESSION_KEY).catch(() => null),
    loadTokenBackup(),
  ]);
  return secure ?? backup ?? null;
}

export async function saveMobileSessionToken(token: string): Promise<void> {
  // Write to both locations. SecureStore for security; filesystem so
  // that an offline cold-start (where SecureStore can return null
  // before Keychain unlocks) still has a recoverable token.
  await Promise.all([
    SecureStore.setItemAsync(MOBILE_SESSION_KEY, token).catch(() => undefined),
    saveTokenBackup(token),
  ]);
}

export async function clearMobileSessionToken(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(MOBILE_SESSION_KEY).catch(() => undefined),
    clearTokenBackup(),
  ]);
}
