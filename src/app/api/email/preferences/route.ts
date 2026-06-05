import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  readEmailToken,
  getEmailPreference,
  setEmailPreference,
} from "@/lib/emailPreferences";

/**
 * Read / write granular email preferences.
 *
 * Identity is resolved from either a signed token (clicked from an email, no
 * session) or the logged-in Clerk user. Token takes precedence so inbox links
 * always work.
 */

async function resolveEmail(
  req: Request,
  body?: { token?: string }
): Promise<{ email: string; userId: string | null } | null> {
  const url = new URL(req.url);
  const token = body?.token ?? url.searchParams.get("token");
  if (token) {
    const email = readEmailToken(token);
    if (email) return { email, userId: null };
  }
  const { userId } = await auth();
  if (userId) {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (email) return { email, userId };
  }
  return null;
}

export async function GET(req: Request): Promise<Response> {
  const resolved = await resolveEmail(req);
  if (!resolved) return NextResponse.json({ ok: false, error: "no identity" }, { status: 401 });
  const pref = await getEmailPreference(resolved.email);
  return NextResponse.json({ ok: true, preference: pref });
}

export async function POST(req: Request): Promise<Response> {
  let body: {
    token?: string;
    progress?: boolean;
    reminders?: boolean;
    unsubscribedAll?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }

  const resolved = await resolveEmail(req, body);
  if (!resolved) return NextResponse.json({ ok: false, error: "no identity" }, { status: 401 });

  const patch: { progress?: boolean; reminders?: boolean; unsubscribedAll?: boolean } = {};
  if (typeof body.progress === "boolean") patch.progress = body.progress;
  if (typeof body.reminders === "boolean") patch.reminders = body.reminders;
  if (typeof body.unsubscribedAll === "boolean") patch.unsubscribedAll = body.unsubscribedAll;

  const pref = await setEmailPreference(resolved.email, patch, resolved.userId);
  return NextResponse.json({ ok: true, preference: pref });
}
