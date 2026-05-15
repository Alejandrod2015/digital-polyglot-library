import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import PostLoginTracker from "./PostLoginTracker";

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

  return <PostLoginTracker isNewUser={isNewUser} />;
}
