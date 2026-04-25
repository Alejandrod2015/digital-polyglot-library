import { useEffect, useRef, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

/**
 * Truth-based "are we offline?" signal. Combines the OS-level network
 * status from NetInfo with a short debounce so that brief blips (cold
 * start before NetInfo has emitted its first event, Wi-Fi handoff,
 * captive-portal revalidation) never flash the offline banner.
 *
 * Debounce is ASYMMETRIC by design:
 *   - Going offline → waits `offlineDelayMs` before reporting true.
 *     If the network comes back before the delay, nothing is reported.
 *   - Going online  → reports false immediately. Relief should feel
 *     instant; there's no upside to holding a stale "offline" banner
 *     once we know the network is back.
 *
 * `isInternetReachable` is honored when the OS can determine it
 * (captive portals, Wi-Fi without uplink). When it's null (not yet
 * probed) we fall back to `isConnected` alone to avoid a false
 * positive during the first few ms after mount.
 */
export function useOfflineStatus(offlineDelayMs = 1800): boolean {
  const [isOffline, setIsOffline] = useState(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearPending() {
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    }

    function handleChange(state: NetInfoState) {
      // Explicit-false isConnected is a hard offline signal from the OS.
      // isInternetReachable === false covers "Wi-Fi connected but no
      // uplink" (captive portals). `null` means the OS hasn't probed
      // yet — treat as online to avoid false-positive flashes at boot.
      const offlineNow =
        state.isConnected === false || state.isInternetReachable === false;

      if (offlineNow) {
        // Only start a debounce timer if we're not already offline.
        if (!pendingTimer.current) {
          pendingTimer.current = setTimeout(() => {
            pendingTimer.current = null;
            setIsOffline(true);
          }, offlineDelayMs);
        }
      } else {
        // Back online: cancel any pending offline transition AND flip
        // the state immediately if we were already showing the banner.
        clearPending();
        setIsOffline((current) => (current ? false : current));
      }
    }

    // Prime from the current state so we don't wait for an event that
    // may never come if the network is stable.
    NetInfo.fetch().then(handleChange).catch(() => undefined);
    const unsubscribe = NetInfo.addEventListener(handleChange);

    return () => {
      clearPending();
      unsubscribe();
    };
  }, [offlineDelayMs]);

  return isOffline;
}
