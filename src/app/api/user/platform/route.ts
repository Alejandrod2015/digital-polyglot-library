// /src/app/api/user/platform/route.ts
// Stamps publicMetadata.signupPlatform = "web" the first time a signed-in web
// user reaches the app. Set-if-absent and idempotent: it never overwrites an
// existing value (so an "ios" stamp from the mobile session route always wins),
// which is why the metrics acquisition funnel can trust signupPlatform instead
// of inferring the platform from later activity (killing the "s/d" bucket).
//
// Also the web half of the beta tester reconcile: this is the one call that
// every signed-in web user makes, so it is where a tester whose `user.created`
// webhook never fired gets linked to their application.
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { touchTesterActivity } from "@/lib/betaProgram";
import {
  FIRST_TOUCH_COOKIE,
  classifyOrigin,
  decodeFirstTouch,
  encodeOrigin,
} from "@/lib/signupSource";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await clerkClient.users.getUser(userId);
    const existing = (user.publicMetadata as Record<string, unknown>) ?? {};
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      null;

    // Beta bookkeeping is best-effort and must never decide the response.
    void touchTesterActivity(userId, email).catch((err) => {
      console.error("touchTesterActivity failed:", err);
    });

    // Origen: el primer toque que dejo la cookie en su primera visita. Va
    // aparte de la plataforma porque responde otra pregunta ("de donde
    // vino") y porque puede llegar cuando la plataforma ya esta sellada,
    // p.ej. quien nacio en la app y luego abre la web.
    const hasOrigin = typeof existing.signupSource === "string" && existing.signupSource;
    const touch = decodeFirstTouch(req.cookies.get(FIRST_TOUCH_COOKIE)?.value);
    // Sin cookie no se sella nada: un "s/d" grabado taparia para siempre el
    // dato bueno que llegaria en la siguiente visita con cookie.
    const origin = hasOrigin || !touch ? null : encodeOrigin(classifyOrigin(touch));

    const platformStamped =
      typeof existing.signupPlatform === "string" && existing.signupPlatform
        ? (existing.signupPlatform as string)
        : null;
    if (platformStamped && !origin) {
      return NextResponse.json({ signupPlatform: platformStamped });
    }

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        signupPlatform: platformStamped ?? "web",
        ...(origin ? { signupSource: origin } : {}),
      },
    });
    return NextResponse.json({ signupPlatform: platformStamped ?? "web", signupSource: origin });
  } catch (error) {
    console.error("Error stamping signupPlatform:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
