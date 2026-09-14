/**
 * Detecta pares de cuentas de Clerk que probablemente son la misma persona
 * con dos logins (ej. Apple con email relay + Google/email real), para el
 * panel manual de "Posibles duplicados" en /studio/beta. No fusiona nada:
 * solo puntúa y explica. La fusión la dispara un humano desde el panel,
 * fila por fila (ver `src/lib/mergeMetricsUserId.ts`).
 *
 * Señales, de más a menos fuerte (ver [[project_metrics_userid_merge_system]]):
 *   - mismo dispositivo/IP en las sesiones de Clerk        → 60
 *   - alta con menos de 48h de diferencia entre las dos     → 20
 *   - mismo apellido y nombre igual o apodo (Ben/Benji)     → 15
 *   - metadata de onboarding idéntica (región/nivel/fuente) → 5
 *
 * El puntaje es una suma de señales confirmadas, tope 100. No es una
 * probabilidad calibrada: es una heurística para ordenar qué mirar primero.
 */
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

const SIGNUP_WINDOW_MS = 48 * 60 * 60 * 1000;
const USER_SCAN_LIMIT = 500;
const MIN_SCORE_TO_SHOW = 25;

const WEIGHT_DEVICE = 60;
const WEIGHT_TIMING = 20;
const WEIGHT_NAME = 15;
const WEIGHT_METADATA = 5;

export type CandidateUser = {
  userId: string;
  name: string | null;
  email: string | null;
  provider: string | null;
  createdAt: string;
};

export type DuplicateCandidate = {
  userA: CandidateUser;
  userB: CandidateUser;
  score: number;
  reasons: string[];
};

function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function namesLikelyMatch(aFirst: string | null, aLast: string | null, bFirst: string | null, bLast: string | null): boolean {
  const al = normalize(aLast);
  const bl = normalize(bLast);
  if (!al || al !== bl) return false;
  const af = normalize(aFirst);
  const bf = normalize(bFirst);
  if (!af || !bf) return false;
  if (af === bf) return true;
  return af.startsWith(bf) || bf.startsWith(af);
}

function primaryProvider(user: { externalAccounts: Array<{ provider: string }>; passwordEnabled: boolean }): string | null {
  return user.externalAccounts[0]?.provider ?? (user.passwordEnabled ? "password" : null);
}

/** IPs vistas en las sesiones de un usuario. Solo se pide para pares que ya calificaron por tiempo, para no golpear la API de Clerk por cada usuario de la base. */
async function sessionIps(userId: string): Promise<Set<string>> {
  try {
    const { data } = await clerkClient.sessions.getSessionList({ userId });
    const ips = new Set<string>();
    for (const s of data) {
      const ip = (s.latestActivity as { ipAddress?: string } | null)?.ipAddress;
      if (ip) ips.add(ip);
    }
    return ips;
  } catch {
    return new Set();
  }
}

export async function findDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  const { data: users } = await clerkClient.users.getUserList({
    limit: USER_SCAN_LIMIT,
    orderBy: "-created_at",
  });

  const sorted = [...users].sort((a, b) => a.createdAt - b.createdAt);

  // Ventana deslizante: solo se comparan usuarios cuya alta cae dentro de
  // SIGNUP_WINDOW_MS del otro. Sobre esa preselección (normalmente pequeña)
  // se pide el detalle de sesiones a Clerk, nunca sobre la base entera.
  const timingPairs: Array<[(typeof sorted)[number], (typeof sorted)[number]]> = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].createdAt - sorted[i].createdAt > SIGNUP_WINDOW_MS) break;
      timingPairs.push([sorted[i], sorted[j]]);
    }
  }

  const ipCache = new Map<string, Set<string>>();
  async function ipsFor(userId: string): Promise<Set<string>> {
    let cached = ipCache.get(userId);
    if (!cached) {
      cached = await sessionIps(userId);
      ipCache.set(userId, cached);
    }
    return cached;
  }

  const candidates: DuplicateCandidate[] = [];

  for (const [a, b] of timingPairs) {
    let score = 0;
    const reasons: string[] = [];

    const [ipsA, ipsB] = await Promise.all([ipsFor(a.id), ipsFor(b.id)]);
    const sharedIp = [...ipsA].find((ip) => ipsB.has(ip));
    if (sharedIp) {
      score += WEIGHT_DEVICE;
      reasons.push(`mismo dispositivo/IP (${sharedIp})`);
    }

    score += WEIGHT_TIMING;
    const hours = Math.round((b.createdAt - a.createdAt) / (60 * 60 * 1000));
    reasons.push(hours === 0 ? "alta el mismo día" : `alta con ${hours}h de diferencia`);

    if (namesLikelyMatch(a.firstName, a.lastName, b.firstName, b.lastName)) {
      score += WEIGHT_NAME;
      reasons.push("nombre igual o variante del mismo apellido");
    }

    const metaA = a.publicMetadata as Record<string, unknown>;
    const metaB = b.publicMetadata as Record<string, unknown>;
    const metaKeys = ["preferredRegion", "preferredLevel", "signupSource"] as const;
    const metaMatches = metaKeys.filter((k) => metaA[k] && metaA[k] === metaB[k]);
    if (metaMatches.length >= 2) {
      score += WEIGHT_METADATA;
      reasons.push("misma región/nivel/fuente de alta");
    }

    if (score < MIN_SCORE_TO_SHOW) continue;

    const toCandidateUser = (u: (typeof sorted)[number]): CandidateUser => ({
      userId: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
      email: u.emailAddresses[0]?.emailAddress ?? null,
      provider: primaryProvider(u),
      createdAt: new Date(u.createdAt).toISOString(),
    });

    candidates.push({
      userA: toCandidateUser(a),
      userB: toCandidateUser(b),
      score: Math.min(score, 100),
      reasons,
    });
  }

  candidates.sort((x, y) => y.score - x.score);
  return candidates;
}
