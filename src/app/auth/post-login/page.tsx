import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function PostLoginPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Keep auth callback route minimal and stable.
  // We avoid DB work here to prevent callback breakage.
  redirect("/explore");
}
