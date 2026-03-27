import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getStudioMember,
  canAccessPath,
  type StudioRole,
} from "@/lib/studio-access";

type StudioAuth = {
  userId: string;
  email: string;
  role: StudioRole;
};

/**
 * Gate for all /studio pages.
 *
 * 1. Clerk checks: is the user logged in?
 * 2. studio-access checks: does this email have a studio role?
 * 3. Permission check: can this role access this specific path?
 *
 * If any check fails → redirect to home.
 */
export async function requireStudioUser(returnTo: string): Promise<StudioAuth> {
  const { userId } = await auth();

  // Not logged in → send to sign-in (they need a Clerk account first)
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }

  // Get email from Clerk
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!email) {
    redirect("/");
  }

  // Check studio whitelist (now from database)
  const member = await getStudioMember(email);
  if (!member) {
    redirect("/");
  }

  // Check path-level permission
  if (!canAccessPath(member.role, returnTo)) {
    redirect("/studio");
  }

  return { userId, email, role: member.role };
}
