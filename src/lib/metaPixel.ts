export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

type MetaParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    _fbq?: unknown;
    // Mirrors the ga-disable-* switch: set for internal users so their
    // own visits never train the ad account. See MetaPixel.
    dpMetaPixelDisabled?: boolean;
  }
}

function canTrack(): boolean {
  if (!META_PIXEL_ID) return false;
  if (typeof window === "undefined") return false;
  if (window.dpMetaPixelDisabled) return false;
  return typeof window.fbq === "function";
}

/** Standard Meta event (PageView, Lead, ...). */
export function trackMetaEvent(eventName: string, params: MetaParams = {}, eventId?: string) {
  if (!canTrack()) return;
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined),
  );
  if (eventId) {
    window.fbq!("track", eventName, clean, { eventID: eventId });
    return;
  }
  window.fbq!("track", eventName, clean);
}

/**
 * A beta application. `eventID` is generated even though nothing sends the
 * Conversions API copy yet: adding it later must not double-count the leads
 * already sitting in the dataset, and Meta only deduplicates when both
 * copies carry the same id.
 */
export function trackMetaLead(params: MetaParams = {}) {
  const eventId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `lead-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  trackMetaEvent("Lead", params, eventId);
}
