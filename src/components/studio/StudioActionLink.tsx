"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type StudioActionLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  pendingLabel?: string;
};

export default function StudioActionLink({
  href,
  children,
  className,
  style,
  pendingLabel = "Opening...",
}: StudioActionLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <button
      type="button"
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      onClick={() =>
        startTransition(() => {
          router.push(href);
        })
      }
      disabled={isPending}
      className={className}
      style={{
        cursor: isPending ? "progress" : "pointer",
        opacity: isPending ? 0.7 : 1,
        transition: "opacity 0.15s",
        ...(style ?? {}),
      }}
    >
      {isPending ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              display: "inline-block",
              animation: "spin 0.6s linear infinite",
            }}
          />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
