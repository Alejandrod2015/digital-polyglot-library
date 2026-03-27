import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createMobileSessionToken } from "@/lib/mobileSession";
import { prisma } from "@/lib/prisma";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAllowedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "digitalpolyglot:" || url.protocol === "com.digitalpolyglot.mobile:";
  } catch {
    return false;
  }
}

export default async function MobileAuthPage(props: {
  searchParams: Promise<{ redirect_uri?: string }>;
}) {
  const searchParams = await props.searchParams;
  const redirectUri = searchParams.redirect_uri?.trim() ?? "";

  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    redirect("/sign-in");
  }

  const { userId } = await auth();
  if (!userId) {
    const nextPath = `/mobile-auth?redirect_uri=${encodeURIComponent(redirectUri)}`;
    redirect(`/sign-in?redirect_url=${encodeURIComponent(nextPath)}`);
  }

  const user = await currentUser();
  const [savedBooksCount, savedStoriesCount] = await Promise.all([
    prisma.libraryBook.count({ where: { userId } }),
    prisma.libraryStory.count({ where: { userId } }),
  ]);
  const publicMetadata = user?.publicMetadata ?? {};
  const token = createMobileSessionToken({
    userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || null,
    plan: typeof publicMetadata.plan === "string" ? publicMetadata.plan : null,
    targetLanguages: isStringArray(publicMetadata.targetLanguages) ? publicMetadata.targetLanguages : [],
    booksCount: savedBooksCount,
    storiesCount: savedStoriesCount,
  });

  const url = new URL(redirectUri);
  url.searchParams.set("token", token);
  redirect(url.toString());
}
