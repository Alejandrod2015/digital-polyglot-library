import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerkAppearance";

type SignInPageProps = {
  searchParams: Promise<{
    redirect_url?: string | string[];
    returnTo?: string | string[];
  }>;
};

function pickFirst(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isSafeInternalPath(path?: string): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

export default async function Page({ searchParams }: SignInPageProps) {
  const qs = await searchParams;
  const requestedRedirect = pickFirst(qs.redirect_url) ?? pickFirst(qs.returnTo);
  const safeRedirect = isSafeInternalPath(requestedRedirect) ? requestedRedirect : undefined;

  return (
    <main className="flex justify-center items-center min-h-screen">
      <SignIn
        appearance={clerkAppearance}
        forceRedirectUrl={safeRedirect}
        fallbackRedirectUrl="/auth/post-login"
        signUpFallbackRedirectUrl="/auth/post-login"
      />
    </main>
  );
}
