// Minimal App Store Connect API client, scoped to TestFlight tester
// management. This is what removes you from the loop: an accepted applicant
// is added to a beta group here, and Apple sends the TestFlight invite email
// on its own.
//
// Zero external deps: an ES256 JWT signed with node:crypto, same shape as the
// provider token in src/lib/apnsPush.ts. Note the key is NOT the same one:
// APNs auth keys and App Store Connect API keys are different key types issued
// from different screens. This needs a key from Users and Access >
// Integrations > App Store Connect API, with a role that can manage TestFlight
// (App Manager works; Developer does not).
//
// Required env (all must be set; otherwise isAscConfigured() is false and
// callers surface "not configured" rather than silently doing nothing):
//   ASC_KEY_ID      ; the 10-char Key ID of the .p8 App Store Connect key
//   ASC_ISSUER_ID   ; the UUID issuer id shown above the key list
//   ASC_PRIVATE_KEY ; contents of the .p8 file (PEM). Literal "\n" allowed.
//   ASC_PRIVATE_KEY_PATH ; alternative to the above: a path to the .p8 file.
//                          Use this locally so the PEM stays in .secrets/ and
//                          never gets pasted into a dotenv file; on Vercel
//                          there is no such file, so set ASC_PRIVATE_KEY.
//   ASC_APP_ID      ; the numeric app id (6760942737 for Digital Polyglot)
//   ASC_BETA_GROUP_ID ; optional; resolved from ASC_BETA_GROUP_NAME if absent
//   ASC_BETA_GROUP_NAME ; optional; defaults to "Beta Testers"

import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { readFileSync } from "node:fs";

const API_BASE = "https://api.appstoreconnect.apple.com";

export type AscConfig = {
  keyId: string;
  issuerId: string;
  privateKey: string;
  appId: string;
  betaGroupId: string | null;
  betaGroupName: string;
};

// Reading the .p8 off disk costs a syscall we do not want on every request,
// and the file never changes while the process lives.
let cachedFileKey: { path: string; pem: string } | null = null;

function readPrivateKeyFromPath(path: string): string | null {
  if (cachedFileKey?.path === path) return cachedFileKey.pem;
  try {
    const pem = readFileSync(path, "utf8");
    cachedFileKey = { path, pem };
    return pem;
  } catch (err) {
    // Deliberately loud: a misconfigured path fails every invite, and a silent
    // null here would surface much later as "App Store Connect not configured".
    console.error(`❌ Could not read ASC_PRIVATE_KEY_PATH (${path}):`, err);
    return null;
  }
}

export function getAscConfig(): AscConfig | null {
  const keyId = process.env.ASC_KEY_ID?.trim();
  const issuerId = process.env.ASC_ISSUER_ID?.trim();
  const appId = process.env.ASC_APP_ID?.trim();
  const keyPath = process.env.ASC_PRIVATE_KEY_PATH?.trim();
  // The inline value wins: on Vercel there is no file to read, and a stale
  // path left over from local development must not shadow it.
  const rawKey = process.env.ASC_PRIVATE_KEY || (keyPath ? readPrivateKeyFromPath(keyPath) : null);
  if (!keyId || !issuerId || !rawKey || !appId) return null;
  // Allow the PEM to be stored with escaped newlines (common in env UIs).
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  return {
    keyId,
    issuerId,
    privateKey,
    appId,
    betaGroupId: process.env.ASC_BETA_GROUP_ID?.trim() || null,
    betaGroupName: process.env.ASC_BETA_GROUP_NAME?.trim() || "Beta Testers",
  };
}

export function isAscConfigured(): boolean {
  return getAscConfig() !== null;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Apple rejects App Store Connect tokens with a lifetime over 20 minutes.
// Mint for 15 and reuse for 10, which keeps signing off the hot path without
// ever handing Apple a token that is about to expire mid-request.
let cachedJwt: { token: string; createdAtMs: number; keyId: string } | null = null;

function buildAscJwt(config: AscConfig, nowMs: number): string {
  if (
    cachedJwt &&
    cachedJwt.keyId === config.keyId &&
    nowMs - cachedJwt.createdAtMs < 10 * 60 * 1000
  ) {
    return cachedJwt.token;
  }
  const nowSec = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.issuerId,
      iat: nowSec,
      exp: nowSec + 15 * 60,
      aud: "appstoreconnect-v1",
    }),
  );
  const signingInput = `${header}.${claims}`;
  const key = createPrivateKey({ key: config.privateKey, format: "pem" });
  // ES256 JOSE signatures are raw r||s (P1363), not DER.
  const signature = cryptoSign("SHA256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  const token = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { token, createdAtMs: nowMs, keyId: config.keyId };
  return token;
}

export class AscError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "AscError";
    this.status = status;
    this.code = code;
  }
}

type AscErrorBody = {
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
};

async function ascFetch<T>(
  config: AscConfig,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = buildAscJwt(config, Date.now());
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  // 204 on DELETE and on relationship writes; there is no body to parse.
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!res.ok) {
    let code: string | null = null;
    let detail = text.slice(0, 400);
    try {
      const parsed = JSON.parse(text) as AscErrorBody;
      const first = parsed.errors?.[0];
      if (first) {
        code = first.code ?? null;
        detail = [first.title, first.detail].filter(Boolean).join(": ") || detail;
      }
    } catch {
      // Non-JSON error body (rare; usually an edge/proxy error page).
    }
    throw new AscError(detail, res.status, code);
  }

  return (text ? JSON.parse(text) : undefined) as T;
}

type BetaGroupsResponse = {
  data: Array<{ id: string; attributes?: { name?: string; isInternalGroup?: boolean } }>;
};

/**
 * Every beta group on the app, so the Studio can show you which one invites
 * land in instead of making you paste an opaque id.
 */
export async function listBetaGroups(): Promise<
  Array<{ id: string; name: string; internal: boolean }>
> {
  const config = getAscConfig();
  if (!config) throw new AscError("App Store Connect is not configured", 0, null);

  const res = await ascFetch<BetaGroupsResponse>(
    config,
    `/v1/apps/${config.appId}/betaGroups?limit=200`,
  );
  return res.data.map((g) => ({
    id: g.id,
    name: g.attributes?.name ?? "(unnamed)",
    internal: g.attributes?.isInternalGroup === true,
  }));
}

// Resolving a group by name costs a round trip, and the answer never changes
// during a deploy. Cache it per process.
let cachedGroupId: { name: string; id: string } | null = null;

async function resolveBetaGroupId(config: AscConfig): Promise<string> {
  if (config.betaGroupId) return config.betaGroupId;
  if (cachedGroupId && cachedGroupId.name === config.betaGroupName) return cachedGroupId.id;

  const groups = await listBetaGroups();
  const wanted = config.betaGroupName.toLowerCase();
  const match = groups.find((g) => g.name.toLowerCase() === wanted);
  if (!match) {
    throw new AscError(
      `No beta group named "${config.betaGroupName}". Existing groups: ${
        groups.map((g) => g.name).join(", ") || "(none)"
      }`,
      404,
      null,
    );
  }
  // External groups are the ones that can receive public applicants; an
  // internal group only accepts users who hold a role on the App Store
  // Connect team, so an invite there would fail confusingly later.
  if (match.internal) {
    throw new AscError(
      `Beta group "${match.name}" is an internal group; applicants need an external group.`,
      400,
      null,
    );
  }
  cachedGroupId = { name: config.betaGroupName, id: match.id };
  return match.id;
}

/**
 * Creates the external beta group applicants land in, if it does not exist.
 *
 * Doing this over the API rather than in the App Store Connect UI removes a
 * setup step that is easy to get subtly wrong: an internal group looks
 * identical in the sidebar but silently refuses every public applicant,
 * because internal groups only accept people who hold a role on the team.
 */
export async function ensureBetaGroup(): Promise<
  | { ok: true; id: string; name: string; created: boolean }
  | { ok: false; error: string }
> {
  const config = getAscConfig();
  if (!config) return { ok: false, error: "App Store Connect is not configured" };

  try {
    const groups = await listBetaGroups();
    const wanted = config.betaGroupName.toLowerCase();
    const existing = groups.find((g) => g.name.toLowerCase() === wanted);

    if (existing) {
      if (existing.internal) {
        return {
          ok: false,
          error: `A group named "${existing.name}" exists but is internal. Rename it, or point ASC_BETA_GROUP_NAME at a different name.`,
        };
      }
      return { ok: true, id: existing.id, name: existing.name, created: false };
    }

    const created = await ascFetch<{ data: { id: string } }>(config, "/v1/betaGroups", {
      method: "POST",
      body: {
        data: {
          type: "betaGroups",
          attributes: {
            name: config.betaGroupName,
            // No public link: the /beta form is the gate, and a link that
            // could be forwarded would route around it entirely.
            publicLinkEnabled: false,
            // Testers should get the newest build without us re-adding them
            // to each one by hand.
            feedbackEnabled: true,
          },
          relationships: {
            app: { data: { type: "apps", id: config.appId } },
          },
        },
      },
    });

    cachedGroupId = { name: config.betaGroupName, id: created.data.id };
    return { ok: true, id: created.data.id, name: config.betaGroupName, created: true };
  } catch (err) {
    return { ok: false, error: err instanceof AscError ? err.message : String(err) };
  }
}

type BuildsResponse = {
  data: Array<{
    id: string;
    attributes?: { version?: string; expired?: boolean; processingState?: string };
  }>;
};

/**
 * The most recent builds Apple holds for the app. Used by the preflight check
 * to answer the question that actually decides whether a tester has a good
 * first minute: is there anything for them to install once they accept.
 */
export async function listRecentBuilds(limit = 5): Promise<
  Array<{ id: string; version: string; expired: boolean; processingState: string }>
> {
  const config = getAscConfig();
  if (!config) throw new AscError("App Store Connect is not configured", 0, null);

  const res = await ascFetch<BuildsResponse>(
    config,
    `/v1/builds?filter[app]=${config.appId}&sort=-version&limit=${limit}`,
  );
  return res.data.map((b) => ({
    id: b.id,
    version: b.attributes?.version ?? "?",
    expired: b.attributes?.expired === true,
    processingState: b.attributes?.processingState ?? "UNKNOWN",
  }));
}

/**
 * The builds a specific group can actually install.
 *
 * This is the question that decides whether an invited tester has anything to
 * open, and it is NOT answered by listRecentBuilds(): a build can exist on the
 * app while the group has no access to it, which is the default for a build
 * uploaded without a group assignment. A tester in that state accepts the
 * invite, opens TestFlight, and finds an empty screen.
 *
 * Note the missing `sort`: this relationship endpoint rejects it, unlike
 * /v1/builds.
 */
export async function listBuildsForGroup(
  groupId: string,
  limit = 10,
): Promise<Array<{ version: string; expired: boolean }>> {
  const config = getAscConfig();
  if (!config) throw new AscError("App Store Connect is not configured", 0, null);

  const res = await ascFetch<{
    data: Array<{ attributes?: { version?: string; expired?: boolean } }>;
  }>(config, `/v1/betaGroups/${groupId}/builds?limit=${limit}`);

  return res.data.map((b) => ({
    version: b.attributes?.version ?? "?",
    expired: b.attributes?.expired === true,
  }));
}

type BetaTesterResponse = { data: { id: string } };
type BetaTestersListResponse = { data: Array<{ id: string }> };

export type InviteResult =
  | { ok: true; testerId: string; alreadyExisted: boolean }
  | { ok: false; error: string; code: string | null; status: number };

/**
 * Adds one applicant to the external beta group. Apple sends the TestFlight
 * invite email itself as a side effect, which is the whole point: no mailbox
 * of ours is in the path.
 *
 * Never throws. A failed invite has to leave the applicant row intact with the
 * reason recorded, so the Studio can offer a retry button instead of losing
 * the application.
 */
export async function inviteTesterToBetaGroup(args: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<InviteResult> {
  const config = getAscConfig();
  if (!config) {
    return { ok: false, error: "App Store Connect is not configured", code: null, status: 0 };
  }

  const email = args.email.trim().toLowerCase();
  // Apple requires both name fields. Applicants only give us a first name, so
  // the surname falls back to a neutral placeholder rather than blocking.
  const firstName = args.firstName?.trim() || email.split("@")[0];
  const lastName = args.lastName?.trim() || "Beta";

  try {
    const groupId = await resolveBetaGroupId(config);

    try {
      const created = await ascFetch<BetaTesterResponse>(config, "/v1/betaTesters", {
        method: "POST",
        body: {
          data: {
            type: "betaTesters",
            attributes: { firstName, lastName, email },
            relationships: {
              betaGroups: { data: [{ type: "betaGroups", id: groupId }] },
            },
          },
        },
      });
      return { ok: true, testerId: created.data.id, alreadyExisted: false };
    } catch (err) {
      // A tester who already exists on the team (from an earlier beta, or
      // because they were added by hand) is a 409. That is not a failure:
      // find them and attach them to the group instead.
      if (err instanceof AscError && err.status === 409) {
        const existing = await ascFetch<BetaTestersListResponse>(
          config,
          `/v1/betaTesters?filter[email]=${encodeURIComponent(email)}&limit=1`,
        );
        const testerId = existing.data[0]?.id;
        if (!testerId) throw err;
        await ascFetch<void>(config, `/v1/betaTesters/${testerId}/relationships/betaGroups`, {
          method: "POST",
          body: { data: [{ type: "betaGroups", id: groupId }] },
        });
        return { ok: true, testerId, alreadyExisted: true };
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof AscError) {
      return { ok: false, error: err.message, code: err.code, status: err.status };
    }
    return { ok: false, error: String(err), code: null, status: 0 };
  }
}

/**
 * Removes a tester from the whole team. Used when the beta closes, and when
 * you kick someone from the Studio.
 */
export async function removeTester(testerId: string): Promise<{ ok: boolean; error?: string }> {
  const config = getAscConfig();
  if (!config) return { ok: false, error: "App Store Connect is not configured" };
  try {
    await ascFetch<void>(config, `/v1/betaTesters/${testerId}`, { method: "DELETE" });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof AscError ? err.message : String(err) };
  }
}

/**
 * Cheap credential check for the Studio: proves the key, issuer and app id
 * line up before you rely on them at 3am. Returns the resolvable groups.
 */
export async function checkAscCredentials(): Promise<
  | { ok: true; groups: Array<{ id: string; name: string; internal: boolean }> }
  | { ok: false; error: string }
> {
  if (!isAscConfigured()) {
    return { ok: false, error: "Missing ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY / ASC_APP_ID" };
  }
  try {
    return { ok: true, groups: await listBetaGroups() };
  } catch (err) {
    return { ok: false, error: err instanceof AscError ? err.message : String(err) };
  }
}
