import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// WHY this redirects on the SERVER (changed 2026-08-05):
//
// It used to render `null` and bounce to "/" from a `useEffect` inside a
// client component. That made the whole login flow depend on hydration: if the
// client bundle fails, is slow, or throws anywhere up the tree, the user is
// left on an empty navy screen with no way out and no error. It happened, and
// the server log showed the tell; a 200 on /auth/post-login and no follow-up
// GET / at all.
//
// A redirect issued here reaches the browser as a real navigation before any
// JavaScript runs, so it cannot get stuck. The GA4 event that used to fire in
// that effect now rides along as `?auth=` and is sent by GA4Tracker, which is
// already mounted app-wide. Analytics is allowed to fail; the login is not.

export default async function PostLoginPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const createdAt = user?.createdAt ?? 0;
  const lastSignInAt = user?.lastSignInAt ?? 0;
  // Treat the session as a fresh sign-up if Clerk just created the account
  // (last sign-in is within 60s of account creation, or there is no prior sign-in).
  const isNewUser = Boolean(
    createdAt && (!lastSignInAt || Math.abs(lastSignInAt - createdAt) < 60_000),
  );

  redirect(isNewUser ? "/?auth=signup" : "/?auth=login");
}
