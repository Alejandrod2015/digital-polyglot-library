"use client";

import { Smartphone } from "lucide-react";
import { trackGa4Event } from "@/lib/ga4";

type Props = {
  /** Where the card is mounted, for analytics ("story_end", "claim_success"). */
  surface: string;
  /** "auto" hides the card on md+ viewports (a desktop visitor cannot install
   *  the app and /go/app would bounce them to /explore). "always" renders on
   *  every viewport; the claim screen uses it because a desktop buyer still
   *  needs to LEARN the apps exist, even if the install happens later on
   *  their phone. */
  visibility?: "auto" | "always";
};

/**
 * "The apps exist" card. Single CTA to /go/app, the device-aware bridge
 * (iOS -> deep link/TestFlight, Android -> deep link/Play, desktop ->
 * /explore). Rendered at the end of a story body and on the claim
 * success screen; both are moments where the reader just got value and
 * has not yet been told there is a native app.
 */
export default function GetAppCta({ surface, visibility = "auto" }: Props) {
  return (
    <div className={visibility === "auto" ? "md:hidden" : undefined}>
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-[var(--card-border,rgba(255,255,255,0.12))] bg-[var(--card-bg,rgba(255,255,255,0.05))] px-5 py-5 text-center">
        <div className="mx-auto mb-3 inline-grid h-11 w-11 place-items-center rounded-full bg-white/10">
          <Smartphone className="h-5 w-5 text-[var(--color-gold,#f8c15c)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--foreground,#fff)]">
          Read on the go
        </p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--muted,rgba(255,255,255,0.65))]">
          Digital Polyglot is also an app for iPhone and Android, with the same
          library and your progress synced.
        </p>
        <a
          href="/go/app"
          onClick={() => trackGa4Event("get_app_cta_click", { surface })}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[14px] font-bold text-[#0e1727] transition hover:bg-gray-200"
        >
          <Smartphone className="h-4 w-4" />
          Get the app
        </a>
      </div>
    </div>
  );
}
