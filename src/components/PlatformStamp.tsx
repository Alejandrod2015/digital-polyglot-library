"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Pings `/api/user/platform` once per signed-in user so the account gets
 * `signupPlatform: "web"` stamped (set-if-absent, an "ios" stamp always wins).
 *
 * WHY IT LIVES IN THE ROOT LAYOUT: this used to be an effect inside
 * HomeClient, so it only fired when the home page loaded. Anyone who signed
 * up and closed the tab before reaching `/` was never stamped and landed in
 * the "s/d" bucket of the acquisition funnel forever, even when the visit log
 * showed plainly that they had come in through the browser. On 2026-08-11 an
 * applicant went /beta → /sign-up → verify-email and stopped there; the funnel
 * showed a blank platform for someone we had a full web session for.
 *
 * Mounted next to VisitLogger it fires on the first page that renders with a
 * session, whichever that is. The POST is also where a beta tester gets
 * relinked to their application when the Clerk webhook missed them.
 */
export default function PlatformStamp() {
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (typeof window === "undefined") return;
    const key = `dp_platform_stamped_v1:${userId}`;
    if (window.localStorage.getItem(key) === "1") return;
    window.localStorage.setItem(key, "1");
    void fetch("/api/user/platform", { method: "POST" }).catch(() => {
      window.localStorage.removeItem(key);
    });
  }, [isLoaded, userId]);

  return null;
}
