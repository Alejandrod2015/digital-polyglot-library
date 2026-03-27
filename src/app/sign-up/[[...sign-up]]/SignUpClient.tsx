"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { clerkAppearance } from "@/lib/clerkAppearance";

function isSafeInternalPath(path?: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

export default function SignUpClient() {
  const searchParams = useSearchParams();
  const requestedRedirect =
    searchParams.get("redirect_url") ?? searchParams.get("returnTo");
  const safeRedirect = isSafeInternalPath(requestedRedirect)
    ? requestedRedirect
    : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignUp
        appearance={clerkAppearance}
        fallbackRedirectUrl={safeRedirect ?? "/auth/post-login"}
        signInFallbackRedirectUrl={safeRedirect ?? "/auth/post-login"}
      />
    </main>
  );
}
