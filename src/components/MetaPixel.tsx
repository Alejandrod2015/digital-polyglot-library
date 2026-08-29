"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { META_PIXEL_ID, trackMetaEvent } from "@/lib/metaPixel";
import { getCookieConsentKey } from "@/components/CookieConsentBanner";

/**
 * Meta pixel for the web app and the marketing pages.
 *
 * It rides the same consent signal and the same internal-user exclusion as
 * GA4Tracker, and it is deliberately a sibling of it rather than a branch
 * inside it: the two vendors have different lifecycles, and a pixel that
 * fails to load must not take analytics down with it.
 *
 * PageView is NOT fired by the init snippet. The app navigates client-side,
 * so a single snippet-level PageView would count one visit per session; the
 * effect below fires one per resolved path instead, like GA4Tracker does.
 */
export default function MetaPixel({
  requiresConsentOptIn = true,
}: {
  requiresConsentOptIn?: boolean;
}) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const consentKey = getCookieConsentKey();
  // The inline snippet below is what defines window.fbq (and its queue), and
  // next/script runs it AFTER the first effects of this component. Without
  // this flag the very first PageView is evaluated while fbq is still
  // undefined, dropped by trackMetaEvent, and never retried: a visitor who
  // lands on /beta and applies without navigating counts as a Lead with no
  // PageView before it.
  const [pixelReady, setPixelReady] = useState(false);
  const [consentChoice, setConsentChoice] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem(getCookieConsentKey())
      : null
  );
  const hasConsent =
    consentChoice === "accepted" ||
    (!requiresConsentOptIn && consentChoice !== "rejected");
  const isInternalUser =
    Boolean(user?.publicMetadata?.internalUser) ||
    Boolean(user?.publicMetadata?.isInternal) ||
    Boolean(user?.publicMetadata?.analyticsExcluded);

  const pagePath = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("auth");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncConsent = () => {
      setConsentChoice(window.localStorage.getItem(consentKey));
    };

    syncConsent();
    window.addEventListener("dp-cookie-consent", syncConsent as EventListener);
    window.addEventListener("storage", syncConsent);

    return () => {
      window.removeEventListener("dp-cookie-consent", syncConsent as EventListener);
      window.removeEventListener("storage", syncConsent);
    };
  }, [consentKey]);

  // The flag is what trackMetaEvent reads, so a staff member who lands on
  // /beta while signed in cannot fire a Lead from a stray test submission.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dpMetaPixelDisabled = isInternalUser;
  }, [isInternalUser]);

  useEffect(() => {
    if (!pixelReady) return;
    if (!isLoaded) return;
    if (!META_PIXEL_ID) return;
    if (!hasConsent) return;
    if (isInternalUser) return;
    trackMetaEvent("PageView");
  }, [hasConsent, isLoaded, isInternalUser, pagePath, pixelReady]);

  if (!META_PIXEL_ID || !isLoaded || isInternalUser || !hasConsent) return null;

  return (
    <Script
      id="meta-pixel-init"
      strategy="afterInteractive"
      onReady={() => setPixelReady(true)}
    >
      {`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${META_PIXEL_ID}');
      `}
    </Script>
  );
}
