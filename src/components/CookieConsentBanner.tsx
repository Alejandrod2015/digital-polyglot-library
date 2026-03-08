"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "dp_cookie_consent_v1";

type ConsentState = "accepted" | "rejected" | null;

function readConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONSENT_KEY);
  return raw === "accepted" || raw === "rejected" ? raw : null;
}

function writeConsent(value: Exclude<ConsentState, null>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent("dp-cookie-consent", { detail: value }));
}

export function getCookieConsentKey() {
  return CONSENT_KEY;
}

export default function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  if (!ready || consent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#081a31]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200/75">
            Cookie choices
          </p>
          <p className="mt-2 text-sm leading-6 text-blue-50/92">
            We use essential cookies to run the app. We would also like to use analytics cookies
            to understand usage and improve the product. You can accept or reject analytics now.
          </p>
          <p className="mt-2 text-xs leading-5 text-blue-100/65">
            Read our <Link href="/privacy" className="text-white underline underline-offset-2">Privacy Policy</Link> and{" "}
            <Link href="/cookies" className="text-white underline underline-offset-2">Cookie Policy</Link>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              writeConsent("rejected");
              setConsent("rejected");
            }}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Reject analytics
          </button>
          <button
            type="button"
            onClick={() => {
              writeConsent("accepted");
              setConsent("accepted");
            }}
            className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
