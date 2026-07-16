import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { deleteAllUserData } from "@/lib/deleteUserData";

export const runtime = "nodejs";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

/**
 * User-initiated account + data deletion (Google Play / GDPR requirement for
 * apps with sign-in). Auth is the caller's own Clerk web session, so a user can
 * only delete themselves.
 *
 * Order matters: erase the data first (which also writes RevokedUser, killing
 * any live mobile session immediately), then delete the Clerk identity. The
 * `user.deleted` webhook then fires and re-runs deleteAllUserData, which is
 * idempotent, so a webhook hiccup can never leave data behind.
 */
export async function POST(): Promise<Response> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteAllUserData(userId);
    await clerkClient.users.deleteUser(userId);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
