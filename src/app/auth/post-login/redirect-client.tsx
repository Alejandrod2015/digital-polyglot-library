"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PostLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");

    const hardRedirect = window.setTimeout(() => {
      window.location.replace("/");
    }, 250);

    return () => window.clearTimeout(hardRedirect);
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--muted)]">
      Redirecting...
    </div>
  );
}
