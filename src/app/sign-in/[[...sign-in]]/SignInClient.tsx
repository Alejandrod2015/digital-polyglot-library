"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { clerkAppearance } from "@/lib/clerkAppearance";

function isSafeInternalPath(path?: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

export default function SignInClient() {
  const searchParams = useSearchParams();
  const requestedRedirect =
    searchParams.get("redirect_url") ?? searchParams.get("returnTo");
  const safeRedirect = isSafeInternalPath(requestedRedirect)
    ? requestedRedirect
    : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn
        appearance={clerkAppearance}
        fallbackRedirectUrl={safeRedirect ?? "/auth/post-login"}
        signUpFallbackRedirectUrl={safeRedirect ?? "/auth/post-login"}
      />
    </main>
  );
}
