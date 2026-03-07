import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import PostLoginRedirect from "./redirect-client";

export default async function PostLoginPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <PostLoginRedirect />;
}
