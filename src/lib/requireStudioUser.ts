import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function requireStudioUser(returnTo: string) {
  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }

  return { userId };
}
