import { useEffect, useRef, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

/**
 * Truth-based "are we offline?" signal. Combines the OS-level network
 * status from NetInfo with a long debounce so that brief blips never
 * flash the offline banner.
 *
 * Why we ONLY trust `isConnected`:
 *   On iOS, `isInternetReachable` oscillates between true / false /
 *   null while the OS revalidates connectivity (Wi-Fi handoff, ARP
 *   refresh, every time the screen wakes up). Tying the banner to it
 *   produced exactly the "shows up briefly even when I have signal"
 *   problem reported on device. `isConnected` is much steadier and
 *   only flips when the radio actually drops.
 *
 * Debounce is ASYMMETRIC by design:
 *   - Going offline → waits `offlineDelayMs` before reporting true.
 *     If the network comes back before the delay, nothing is reported.
 *   - Going online  → reports false immediately. Relief should feel
 *     instant; there's no upside to holding a stale "offline" banner
 *     once we know the network is back.
 *
 * Captive-portal-style "Wi-Fi without uplink" is not detected here
 * anymore; if we want that signal back later we can add a second
 * source (e.g., consecutive fetch failures from the API) instead of
 * relying on the noisy `isInternetReachable` flag.
 */
export function useOfflineStatus(offlineDelayMs = 3500): boolean {
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
      // Hard offline = the radio reports no connection. Anything else
      // (including `isInternetReachable === false` which used to be
      // here) is too noisy on iOS.
      const offlineNow = state.isConnected === false;

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
