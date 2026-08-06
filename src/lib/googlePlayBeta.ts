// The Android half of the beta program, on top of the Play Developer API.
//
// This is deliberately NOT symmetrical with appStoreConnect.ts, because Google
// is not symmetrical with Apple, and pretending otherwise is how you build a
// panel that lies. Two facts drive every design decision in this file:
//
//   1. `edits.testers` has exactly ONE field: `googleGroups[]`. There is no way
//      to add an individual tester by email through the API. "Inviting someone"
//      on Android means their Google account is a member of a Group that is
//      attached to the track.
//   2. Google emails the tester NOTHING. Apple sends its own invitation; Google
//      expects the developer to hand out an opt-in link that the tester opens
//      and accepts by hand. And that link only does anything once the track has
//      a published release.
//
// On top of that, digitalpolyglot.com is a plain consumer Google account, not
// Workspace or Cloud Identity (verified 2026-08-05: the domain's MX is not
// Google's and the account shows no "managed by" banner). So the Admin SDK and
// the Cloud Identity Groups API cannot reach our group either: we cannot add a
// member, and we cannot read the member list.
//
// What is left, and what this file does: attach a self-serve Google Group to
// the track ONCE, then hand every accepted tester a join link plus an opt-in
// link. That scales, because nobody has to touch Play Console per tester. What
// it cannot do is confirm that a given person joined, which is why
// `getPlayBetaState` reports the state of the TRACK and never claims to know
// the state of a tester.

import { getGooglePlayAccessToken, getGooglePlayCredentials } from "@/lib/googlePlay";

const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

/**
 * Closed testing.
 *
 * The track ids do NOT mean what they look like, and getting this wrong costs a
 * confusing 403 rather than a clear error. In the Play Console of today:
 * `internal` is Internal testing, **`alpha` is Closed testing**, `beta` is
 * **Open** testing, `production` is production. Attaching a tester group to
 * `beta` answers "The beta track has been upgraded to use open or closed
 * testing; switch back to communities-based testing before using the API for
 * this track", which is Play's way of saying that track is public now.
 *
 * Closed and not `internal`, because the internal track caps at 100 testers
 * added by hand as an email list in Play Console, with no group the API can
 * manage, and its opt-in link is an opaque per-app id that cannot be derived
 * from the package name. The closed track takes a Google Group and its opt-in
 * URL is always `play.google.com/apps/testing/<package>`, which makes the whole
 * flow computable from config instead of copied out of a console by hand.
 */
const DEFAULT_TRACK = "alpha";

export type PlayBetaConfig = {
  packageName: string;
  track: string;
  /** Google Group attached to the track. Members of it are the testers. */
  groupEmail: string | null;
};

export function getPlayBetaConfig(): PlayBetaConfig | null {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  // Asked of the shared credential reader rather than re-derived from env, so
  // the key-file fallback works here too. Before this, the preflight reported
  // "not configured" on a machine where the key was sitting right there.
  let hasCredentials = false;
  try {
    hasCredentials = Boolean(getGooglePlayCredentials().privateKey);
  } catch {
    hasCredentials = false;
  }
  if (!packageName || !hasCredentials) return null;

  return {
    packageName,
    track: process.env.GOOGLE_PLAY_BETA_TRACK?.trim() || DEFAULT_TRACK,
    groupEmail: process.env.GOOGLE_PLAY_BETA_GROUP_EMAIL?.trim().toLowerCase() || null,
  };
}

export function isPlayBetaConfigured(): boolean {
  return getPlayBetaConfig() !== null;
}

/**
 * What Play Console calls the track, next to what the API calls it. Every
 * message a human reads goes through this, because "the alpha track" sends you
 * looking for a section of the console that is labelled Closed testing.
 */
export function trackLabel(track: string): string {
  const names: Record<string, string> = {
    internal: "Internal testing",
    alpha: "Closed testing",
    beta: "Open testing",
    production: "Production",
  };
  const name = names[track];
  return name ? `${name} (${track})` : track;
}

/**
 * Where the tester opts in. Fixed shape for closed testing, so it needs no
 * console round trip. Returns null for a track whose opt-in URL is not
 * derivable (`internal`), rather than inventing a link that 404s.
 */
export function playOptInUrl(config?: PlayBetaConfig | null): string | null {
  const cfg = config ?? getPlayBetaConfig();
  if (!cfg) return null;
  if (cfg.track === "internal") return process.env.GOOGLE_PLAY_INTERNAL_OPT_IN_URL?.trim() || null;
  return `https://play.google.com/apps/testing/${cfg.packageName}`;
}

/**
 * Where the tester joins the group. Google Groups' web UI lives at
 * `/g/<name>`, and the name is the local part of the group address.
 */
export function playGroupJoinUrl(config?: PlayBetaConfig | null): string | null {
  const cfg = config ?? getPlayBetaConfig();
  const email = cfg?.groupEmail;
  if (!email) return null;
  const local = email.split("@")[0];
  if (!local) return null;
  return `https://groups.google.com/g/${local}`;
}

/** Direct Play Store listing. Only resolves once something is published. */
export function playStoreUrl(config?: PlayBetaConfig | null): string | null {
  const cfg = config ?? getPlayBetaConfig();
  if (!cfg) return null;
  return `https://play.google.com/store/apps/details?id=${cfg.packageName}`;
}

/* ────────────────────────────────────────────── low level */

type PlayRelease = {
  status?: string;
  name?: string;
  versionCodes?: string[];
  userFraction?: number;
};

type PlayTrack = {
  track?: string;
  releases?: PlayRelease[];
};

async function playFetch(
  path: string,
  init: RequestInit & { accessToken: string },
): Promise<{ ok: boolean; status: number; body: unknown; raw: string }> {
  const { accessToken, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    cache: "no-store",
  });
  const raw = await res.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body, raw };
}

function apiErrorMessage(status: number, raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) return `${status}: ${parsed.error.message}`;
  } catch {
    // fall through
  }
  return `${status}: ${raw.slice(0, 300)}`;
}

/**
 * Runs `fn` inside a Play edit and always cleans up after itself.
 *
 * androidpublisher has no way to read tracks or testers outside an edit, so
 * even a pure read costs one insert and one delete. `commit` is opt-in and off
 * by default: an edit that is deleted changes nothing in Play, which is what
 * makes every read in this file safe to run from a panel refresh.
 */
async function withEdit<T>(
  fn: (ctx: { accessToken: string; editPath: string }) => Promise<{ result: T; commit?: boolean }>,
): Promise<T> {
  const { packageName } = getGooglePlayCredentials();
  const { access_token: accessToken } = await getGooglePlayAccessToken();
  const appPath = `/${encodeURIComponent(packageName)}`;

  const inserted = await playFetch(`${appPath}/edits`, { method: "POST", accessToken });
  if (!inserted.ok) {
    throw new Error(`Could not open a Play edit (${apiErrorMessage(inserted.status, inserted.raw)})`);
  }
  const editId = (inserted.body as { id?: string })?.id;
  if (!editId) throw new Error("Play returned an edit without an id");

  const editPath = `${appPath}/edits/${editId}`;
  let committed = false;
  try {
    const { result, commit } = await fn({ accessToken, editPath });
    if (commit) {
      const res = await playFetch(`${editPath}:commit`, { method: "POST", accessToken });
      if (!res.ok) throw new Error(`Play refused the commit (${apiErrorMessage(res.status, res.raw)})`);
      committed = true;
    }
    return result;
  } finally {
    // A committed edit is already gone; deleting it answers 400. Only clean up
    // the ones we abandoned, so a genuine failure is not masked by noise.
    if (!committed) {
      await playFetch(editPath, { method: "DELETE", accessToken }).catch(() => undefined);
    }
  }
}

/* ────────────────────────────────────────────── state */

export type PlayBetaState = {
  configured: boolean;
  packageName: string | null;
  track: string;
  /** The group we expect on the track, from config. */
  groupEmail: string | null;
  /** The groups Play actually has on the track. */
  attachedGroups: string[];
  groupAttached: boolean;
  release: { status: string; name: string | null; versionCodes: string[] } | null;
  optInUrl: string | null;
  groupJoinUrl: string | null;
  /**
   * Everything standing between an accepted applicant and an installed app,
   * in plain words. Empty means an Android invite will actually work.
   */
  blockers: string[];
  /** Set when Play itself could not be reached, as opposed to being misconfigured. */
  error: string | null;
};

function emptyState(track: string): PlayBetaState {
  return {
    configured: false,
    packageName: null,
    track,
    groupEmail: null,
    attachedGroups: [],
    groupAttached: false,
    release: null,
    optInUrl: null,
    groupJoinUrl: null,
    blockers: [
      "Google Play is not configured (GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL, GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_PLAY_PACKAGE_NAME).",
    ],
    error: null,
  };
}

/**
 * The Android answer to "what does the store actually hold?", which on iOS is
 * a per-tester question and here can only be a per-track one.
 *
 * Read-only: it opens an edit, reads, and throws the edit away.
 */
export async function getPlayBetaState(): Promise<PlayBetaState> {
  const config = getPlayBetaConfig();
  if (!config) return emptyState(DEFAULT_TRACK);

  const base: PlayBetaState = {
    configured: true,
    packageName: config.packageName,
    track: config.track,
    groupEmail: config.groupEmail,
    attachedGroups: [],
    groupAttached: false,
    release: null,
    optInUrl: playOptInUrl(config),
    groupJoinUrl: playGroupJoinUrl(config),
    blockers: [],
    error: null,
  };

  try {
    const { tracks, testers } = await withEdit(async ({ accessToken, editPath }) => {
      const tracksRes = await playFetch(`${editPath}/tracks`, { accessToken });
      if (!tracksRes.ok) {
        throw new Error(`Could not read the tracks (${apiErrorMessage(tracksRes.status, tracksRes.raw)})`);
      }
      const testersRes = await playFetch(`${editPath}/testers/${encodeURIComponent(config.track)}`, {
        accessToken,
      });
      return {
        result: {
          tracks: ((tracksRes.body as { tracks?: PlayTrack[] })?.tracks ?? []) as PlayTrack[],
          testers: testersRes.ok
            ? ((testersRes.body as { googleGroups?: string[] })?.googleGroups ?? [])
            : [],
        },
      };
    });

    base.attachedGroups = testers.map((g) => g.trim().toLowerCase()).filter(Boolean);
    base.groupAttached = config.groupEmail !== null && base.attachedGroups.includes(config.groupEmail);

    const track = tracks.find((t) => t.track === config.track);
    // A release Play still calls `draft` is not installable by anyone, so it
    // counts as no release at all rather than as a half-success.
    const live = (track?.releases ?? []).find(
      (r) => r.status === "completed" || r.status === "inProgress",
    );
    if (live) {
      base.release = {
        status: live.status ?? "unknown",
        name: live.name ?? null,
        versionCodes: live.versionCodes ?? [],
      };
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
  }

  base.blockers = derivePlayBlockers(base);
  return base;
}

/**
 * Turns the raw state into the sentences the Studio shows. Kept separate from
 * the fetch so the panel and the preflight cannot drift into describing the
 * same broken setup two different ways.
 */
export function derivePlayBlockers(state: PlayBetaState): string[] {
  const blockers: string[] = [];
  if (!state.configured) {
    return [
      "Google Play is not configured (GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL, GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_PLAY_PACKAGE_NAME).",
    ];
  }
  if (state.error) {
    blockers.push(`Play could not be read: ${state.error}`);
    return blockers;
  }
  if (!state.groupEmail) {
    blockers.push(
      "No tester group configured. Set GOOGLE_PLAY_BETA_GROUP_EMAIL to the Google Group that holds the Android testers.",
    );
  } else if (!state.groupAttached) {
    blockers.push(
      `The group ${state.groupEmail} is not attached to ${trackLabel(state.track)}, so joining it grants nothing.`,
    );
  }
  if (!state.release) {
    blockers.push(
      `${trackLabel(state.track)} has no published release, so the opt-in link exists but has nothing to install.`,
    );
  }
  if (!state.optInUrl) {
    blockers.push(`No opt-in URL can be derived for ${trackLabel(state.track)}.`);
  }
  return blockers;
}

/* ────────────────────────────────────────────── the one write */

/**
 * Attaches the configured Google Group to the track, once.
 *
 * This is the ONLY function in the file that changes anything in Play, and it
 * is idempotent: if the group is already there it commits nothing. It replaces
 * the track's group list with the existing groups plus ours, never with ours
 * alone, so a group somebody added in the console by hand does not silently
 * lose its testers.
 */
export type AttachGroupResult = {
  ok: boolean;
  changed: boolean;
  groups: string[];
  error?: string;
};

export async function attachTesterGroup(): Promise<AttachGroupResult> {
  const config = getPlayBetaConfig();
  if (!config) return { ok: false, changed: false, groups: [], error: "Google Play is not configured" };
  if (!config.groupEmail) {
    return { ok: false, changed: false, groups: [], error: "GOOGLE_PLAY_BETA_GROUP_EMAIL is not set" };
  }

  try {
    return await withEdit<AttachGroupResult>(async ({ accessToken, editPath }) => {
      const testersPath = `${editPath}/testers/${encodeURIComponent(config.track)}`;
      const current = await playFetch(testersPath, { accessToken });
      if (!current.ok && current.status !== 404) {
        throw new Error(`Could not read the tester groups (${apiErrorMessage(current.status, current.raw)})`);
      }
      const existing = ((current.body as { googleGroups?: string[] })?.googleGroups ?? []).map((g) =>
        g.trim().toLowerCase(),
      );

      if (existing.includes(config.groupEmail!)) {
        return { result: { ok: true, changed: false, groups: existing } };
      }

      const groups = [...existing, config.groupEmail!];
      const updated = await playFetch(testersPath, {
        method: "PUT",
        accessToken,
        body: JSON.stringify({ googleGroups: groups }),
      });
      if (!updated.ok) {
        throw new Error(`Play refused the tester group (${apiErrorMessage(updated.status, updated.raw)})`);
      }

      return { result: { ok: true, changed: true, groups }, commit: true };
    });
  } catch (err) {
    return {
      ok: false,
      changed: false,
      groups: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
