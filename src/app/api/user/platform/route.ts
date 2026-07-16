// /src/app/api/user/platform/route.ts
// Stamps publicMetadata.signupPlatform = "web" the first time a signed-in web
// user reaches the app. Set-if-absent and idempotent: it never overwrites an
// existing value (so an "ios" stamp from the mobile session route always wins),
// which is why the metrics acquisition funnel can trust signupPlatform instead
// of inferring the platform from later activity (killing the "s/d" bucket).
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { NextResponse } from "next/server";

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
