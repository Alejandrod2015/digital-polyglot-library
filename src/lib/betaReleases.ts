// Build notes: the communication half of the beta program.
//
// Publishing a release is one action that fans out to every active tester by
// email and push. The part that earns its keep is `fixedForThem`: before each
// send, we look up the reports THIS tester filed that were marked fixed in
// THIS build, and name them back. A tester who sees their own sentence in a
// changelog files the next report; one who gets a generic changelog does not.

import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";
import { sendBetaEmail, backfillBetaTesterLinks } from "@/lib/betaProgram";
import { isApnsConfigured, sendApnsPush } from "@/lib/apnsPush";
import type { BetaRelease } from "@/generated/prisma";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

type StoredToken = { provider?: string; token?: string };

// El filtro de destinatarios vive ahora en la propia consulta, porque no es
// una lista de estados: `invited` cuenta o no según haya entrado la persona.

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/**
 * APNs tokens for a specific set of Clerk users. resolvePushRecipients() walks
 * the entire user base, which is the wrong shape here: a beta is a handful of
 * people and we already know exactly who they are.
 */
async function tokensForUsers(userIds: string[]): Promise<string[]> {
  const tokens = new Set<string>();
  const results = await Promise.all(
    userIds.map((id) => clerkClient.users.getUser(id).catch(() => null)),
  );
  for (const user of results) {
    if (!user) continue;
    const raw = (user.privateMetadata as Record<string, unknown>)?.mobilePushTokens;
    if (!Array.isArray(raw)) continue;
    for (const entry of raw as StoredToken[]) {
      if (!entry || typeof entry !== "object") continue;
      if (entry.provider !== "apns") continue;
      const value = typeof entry.token === "string" ? entry.token.trim() : "";
      if (value) tokens.add(value);
    }
  }
  return Array.from(tokens);
}

export type PublishResult = {
  ok: boolean;
  releaseId: string;
  emailed: number;
  emailFailed: number;
  pushed: number;
  pushSkippedReason?: string;
  error?: string;
};

/**
 * Sends the build note for one release. Idempotent through the email ledger:
 * calling it twice cannot mail the same tester about the same build twice, so
 * a half-finished run is safe to simply repeat.
 */
export async function publishRelease(
  releaseId: string,
  actorEmail?: string,
): Promise<PublishResult> {
  const release: BetaRelease | null = await prisma.betaRelease.findUnique({
    where: { id: releaseId },
  });
  if (!release) return { ok: false, releaseId, emailed: 0, emailFailed: 0, pushed: 0, error: "Release not found" };

  // Reparar los enlaces con Clerk ANTES de elegir a quién se escribe, igual
  // que hace el cron y por el mismo motivo: aquí abajo se filtra por
  // `clerkUserId`, así que un enlace sin reparar no se queda en un número mal
  // contado, deja a un tester real fuera de la nota de versión.
  await backfillBetaTesterLinks({ force: true }).catch((err) => {
    console.error("backfillBetaTesterLinks failed before publishing a release:", err);
  });

  const testers = await prisma.betaSignup.findMany({
    // Quien nunca entró NO recibe la nota de versión. El correo dice "abre
    // TestFlight y pulsa Actualizar", que a alguien que jamás instaló la app
    // no le pide algo inútil: le pide algo imposible, y encima le da a
    // entender que el programa no sabe quién es. Ese mismo día ya le toca el
    // aviso de instalación, que es lo que de verdad tiene que hacer.
    //
    // La condición es la misma con la que el cron decide ese aviso
    // (`invited` sin `clerkUserId`), para que las dos mitades no puedan
    // discrepar sobre quién ha entrado.
    where: {
      planRevokedAt: null,
      OR: [
        { status: "accepted" },
        { status: "invited", clerkUserId: { not: null } },
      ],
    },
    // `platform` decides whether the build note says TestFlight or Google Play.
    select: {
      id: true,
      email: true,
      firstName: true,
      targetLanguage: true,
      platform: true,
      clerkUserId: true,
    },
  });

  if (testers.length === 0) {
    return { ok: true, releaseId, emailed: 0, emailFailed: 0, pushed: 0, error: "No active testers" };
  }

  // One query for everyone's fixed reports, then group in memory. Doing it per
  // tester would be N round trips for a list that is small enough to hold.
  const fixedRows = await prisma.betaFeedback.findMany({
    where: { releaseId, status: "fixed", signupId: { in: testers.map((t) => t.id) } },
    select: { signupId: true, message: true },
  });
  const fixedBySignup = new Map<string, string[]>();
  for (const row of fixedRows) {
    if (!row.signupId) continue;
    const list = fixedBySignup.get(row.signupId) ?? [];
    // Their own words, trimmed to a line so a long report stays readable
    // inside a bulleted list.
    list.push(row.message.length > 160 ? `${row.message.slice(0, 157)}...` : row.message);
    fixedBySignup.set(row.signupId, list);
  }

  const releaseData = {
    version: release.version,
    buildNumber: release.buildNumber,
    headline: release.headline,
    whatsNew: asStringArray(release.whatsNew),
    knownIssues: asStringArray(release.knownIssues),
    askThem: release.askThem,
  };

  let emailed = 0;
  let emailFailed = 0;

  for (const tester of testers) {
    const result = await sendBetaEmail({
      kind: "release_note",
      signup: tester,
      releaseId,
      data: { release: releaseData, fixedForThem: fixedBySignup.get(tester.id) ?? [] },
    });
    if (result === "sent") emailed++;
    else if (result === "failed") emailFailed++;
  }

  // Push is a nudge on top of the email, never the only channel: a tester who
  // has notifications off must still learn there is a build.
  let pushed = 0;
  let pushSkippedReason: string | undefined;
  const testerUserIds = testers.map((t) => t.clerkUserId).filter((id): id is string => !!id);

  if (!isApnsConfigured()) {
    pushSkippedReason = "APNs is not configured";
  } else if (testerUserIds.length === 0) {
    pushSkippedReason = "No testers have signed in yet, so there are no devices to push to";
  } else {
    try {
      const tokens = await tokensForUsers(testerUserIds);
      if (tokens.length === 0) {
        pushSkippedReason = "No registered devices among the testers";
      } else {
        const results = await sendApnsPush(tokens, {
          title: `Build ${release.buildNumber} is live`,
          body: release.headline,
          data: { type: "beta_release", buildNumber: release.buildNumber },
        });
        pushed = results.filter((r) => r.ok).length;
      }
    } catch (err) {
      pushSkippedReason = String(err);
    }
  }

  await prisma.betaRelease.update({
    where: { id: releaseId },
    data: {
      status: "published",
      publishedAt: release.publishedAt ?? new Date(),
      notifiedCount: emailed,
      ...(actorEmail && !release.createdByEmail ? { createdByEmail: actorEmail } : {}),
    },
  });

  return { ok: true, releaseId, emailed, emailFailed, pushed, pushSkippedReason };
}
