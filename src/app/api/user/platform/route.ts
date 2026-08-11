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
import { NextResponse } from "next/server";
import { touchTesterActivity } from "@/lib/betaProgram";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function POST() {
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

    if (typeof existing.signupPlatform === "string" && existing.signupPlatform) {
      return NextResponse.json({ signupPlatform: existing.signupPlatform });
    }

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { ...existing, signupPlatform: "web" },
    });
    return NextResponse.json({ signupPlatform: "web" });
  } catch (error) {
    console.error("Error stamping signupPlatform:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
