import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function PostLoginPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  try {
    const [bookCount, storyCount] = await Promise.all([
      prisma.libraryBook.count({ where: { userId } }),
      prisma.libraryStory.count({ where: { userId } }),
    ]);

    if (bookCount + storyCount > 0) {
      redirect("/my-library");
    }
  } catch {
    // If the DB check fails, keep onboarding flow stable.
  }

  redirect("/explore");
}
