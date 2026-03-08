"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { GA4_MEASUREMENT_ID } from "@/lib/ga4";
import { getCookieConsentKey } from "@/components/CookieConsentBanner";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

export default function GA4Tracker() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const consentKey = getCookieConsentKey();
  const [hasAnalyticsConsent, setHasAnalyticsConsent] = useState(false);
  const isInternalUser =
    Boolean(user?.publicMetadata?.internalUser) ||
    Boolean(user?.publicMetadata?.isInternal) ||
    Boolean(user?.publicMetadata?.analyticsExcluded);

  const pagePath = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncConsent = () => {
      setHasAnalyticsConsent(window.localStorage.getItem(consentKey) === "accepted");
    };

    syncConsent();
    window.addEventListener("dp-cookie-consent", syncConsent as EventListener);
    window.addEventListener("storage", syncConsent);

    return () => {
      window.removeEventListener("dp-cookie-consent", syncConsent as EventListener);
      window.removeEventListener("storage", syncConsent);
    };
  }, [consentKey]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!GA4_MEASUREMENT_ID) return;
    if (!hasAnalyticsConsent) return;
    if (typeof window !== "undefined") {
      window[`ga-disable-${GA4_MEASUREMENT_ID}`] = isInternalUser;
    }
    if (isInternalUser) return;
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [hasAnalyticsConsent, isLoaded, isInternalUser, pagePath]);

  if (!GA4_MEASUREMENT_ID || !isLoaded || isInternalUser || !hasAnalyticsConsent) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA4_MEASUREMENT_ID}', {
            send_page_view: false,
            anonymize_ip: true
          });
        `}
      </Script>
    </>
  );
}
