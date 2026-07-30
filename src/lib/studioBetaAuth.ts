// Shared admin guard for the /api/studio/beta/* routes. The beta surface
// exposes applicant emails and can mail every tester at once, so it is
// admin-only rather than merely studio-member-only.

import { auth, currentUser } from "@clerk/nextjs/server";
import { getStudioMember } from "@/lib/studio-access";

export type AdminCheck = { email: string } | { error: string; status: number };

export async function requireBetaAdmin(): Promise<AdminCheck> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return { error: "Unauthorized", status: 401 };

  const member = await getStudioMember(email);
  if (!member || member.role !== "admin") {
    return { error: "Forbidden: admin only", status: 403 };
  }

  return { email };
}
