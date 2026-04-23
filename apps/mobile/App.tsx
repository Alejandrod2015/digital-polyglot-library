import "./src/polyfills";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClerkProvider, useAuth, useClerk } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ActivityIndicator, Image, Linking, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { AuthScreen } from "./src/auth/AuthScreen";
import { exchangeClerkSessionForMobileToken } from "./src/auth/exchangeClerkSession";
import {
  clearMobileSessionToken,
  decodeMobileSessionToken,
  loadMobileSessionToken,
  saveMobileSessionToken,
  type MobileSessionPayload,
} from "./src/auth/mobileSession";
import { MobileLibraryShell } from "./src/mobile/MobileLibraryShell";
import { type PushRegistrationState } from "./src/notifications/registerPush";
import { parseReminderDestination } from "./src/notifications/dailyReminder";
import type { ReminderDestination } from "./src/notifications/dailyReminder";
import { mobileConfig } from "./src/config";
import { apiFetch } from "./src/lib/api";

type PendingReminderNavigation = {
  key: string;
  target: ReminderDestination;
};

function extractMobileAuthToken(urlString: string | null | undefined): string | null {
  if (!urlString) return null;

  try {
    const url = new URL(urlString);
    const isSupportedProtocol =
      url.protocol === "digitalpolyglot:" || url.protocol === "com.digitalpolyglot.mobile:";
    if (!isSupportedProtocol) return null;
    const token = url.searchParams.get("token")?.trim() ?? "";
    return token || null;
  } catch {
    return null;
  }
}

function extractQaAction(urlString: string | null | undefined): string | null {
  if (!urlString) return null;

  try {
    const url = new URL(urlString);
    if (url.protocol !== "digitalpolyglot:" || url.hostname !== "qa") return null;
    return url.pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

function getNotificationsModule(): typeof import("expo-notifications") | null {
  try {
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

function MobileAppRoot() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [previewModeOnly, setPreviewModeOnly] = useState(false);
  const [pushState, setPushState] = useState<PushRegistrationState>({ status: "idle" });
  const [pendingReminderNavigation, setPendingReminderNavigation] =
    useState<PendingReminderNavigation | null>(null);
  const { isLoaded: clerkLoaded, isSignedIn: isClerkSignedIn, getToken } = useAuth();
  const { signOut: clerkSignOut } = useClerk();
  const handleAuthenticated = useCallback(async (token: string) => {
    console.log("[mobile-auth] handleAuthenticated:start", { tokenLength: token.length });
    await saveMobileSessionToken(token);
    console.log("[mobile-auth] handleAuthenticated:saved");
    setSessionToken(token);
    setPreviewModeOnly(false);
    setPushState({
      status: "unsupported",
      message: "Push notifications will be enabled in the next native rebuild.",
    });
    console.log("[mobile-auth] handleAuthenticated:done");
  }, []);

  const handleNativeSessionSync = useCallback(async () => {
    const clerkSessionToken = await getToken();
    if (!clerkSessionToken) return false;
    const mobileToken = await exchangeClerkSessionForMobileToken(clerkSessionToken);
    await handleAuthenticated(mobileToken);
    return true;
  }, [getToken, handleAuthenticated]);

  // Hydrate stored mobile session on startup
  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      if (__DEV__) {
        await clearMobileSessionToken();
        setLoadingSession(false);
        return;
      }

      const storedToken = await loadMobileSessionToken();
      if (cancelled) return;

      if (storedToken) {
        const decoded = decodeMobileSessionToken(storedToken);
        const nowSec = Math.floor(Date.now() / 1000);
        if (!decoded || decoded.exp <= nowSec) {
          await clearMobileSessionToken();
          setLoadingSession(false);
          return;
        }
      }

      setSessionToken((currentToken) => currentToken ?? storedToken);
      setLoadingSession(false);
    }

    void hydrateSession();
    return () => { cancelled = true; };
  }, []);

  // Auto-sync existing Clerk session into a mobile session token
  useEffect(() => {
    if (!clerkLoaded || !isClerkSignedIn || sessionToken || loadingSession) return;

    void handleNativeSessionSync().catch((error) => {
      console.error("[mobile-auth] Failed to sync Clerk session", error);
    });
  }, [clerkLoaded, handleNativeSessionSync, isClerkSignedIn, loadingSession, sessionToken]);

  // Handle deep-link auth tokens
  useEffect(() => {
    let cancelled = false;

    async function hydrateInitialUrl() {
      const initialUrl = await Linking.getInitialURL();
      if (cancelled) return;
      const token = extractMobileAuthToken(initialUrl);
      if (token) {
        void handleAuthenticated(token);
        return;
      }
      if (__DEV__) {
        const qaAction = extractQaAction(initialUrl);
        if (qaAction === "continue-preview") setPreviewModeOnly(true);
      }
    }

    void hydrateInitialUrl();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      const token = extractMobileAuthToken(url);
      if (token) {
        void handleAuthenticated(token);
        return;
      }
      if (__DEV__) {
        const qaAction = extractQaAction(url);
        if (qaAction === "continue-preview") {
          setPreviewModeOnly(true);
        } else if (qaAction === "sign-out") {
          void clearMobileSessionToken();
          setSessionToken(null);
          setPreviewModeOnly(false);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [handleAuthenticated]);

  // Handle push notification taps
  useEffect(() => {
    const NotificationsMaybe = getNotificationsModule();
    if (!NotificationsMaybe) return;
    const Notifications = NotificationsMaybe;

    let cancelled = false;

    async function hydrateLastNotificationResponse() {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (cancelled || !response) return;
      const target = parseReminderDestination(response.notification.request.content.data?.target);
      if (!target) return;
      if (sessionToken) {
        void apiFetch<{ success: true }>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/metrics",
          token: sessionToken,
          method: "POST",
          body: {
            storySlug: "daily-loop",
            bookSlug: "mobile",
            eventType: "reminder_tapped",
            metadata: { targetKind: target.kind, source: "initial_response" },
          },
        }).catch(() => {});
      }
      setPendingReminderNavigation({ key: `${Date.now()}-initial`, target });
    }

    void hydrateLastNotificationResponse();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = parseReminderDestination(response.notification.request.content.data?.target);
      if (!target) return;
      if (sessionToken) {
        void apiFetch<{ success: true }>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/metrics",
          token: sessionToken,
          method: "POST",
          body: {
            storySlug: "daily-loop",
            bookSlug: "mobile",
            eventType: "reminder_tapped",
            metadata: { targetKind: target.kind, source: "listener" },
          },
        }).catch(() => {});
      }
      setPendingReminderNavigation({ key: `${Date.now()}-tap`, target });
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [sessionToken]);

  const session = useMemo<MobileSessionPayload | null>(
    () => (sessionToken ? decodeMobileSessionToken(sessionToken) : null),
    [sessionToken]
  );

  const handleSignOut = useCallback(async () => {
    await clearMobileSessionToken();
    await clerkSignOut().catch(() => {});
    setSessionToken(null);
    setPreviewModeOnly(false);
    setPushState({ status: "idle" });
  }, [clerkSignOut]);

  const handleSignOutSync = useCallback(() => {
    void handleSignOut();
  }, [handleSignOut]);

  const handleRequestSignIn = useCallback(() => {
    setPreviewModeOnly(false);
  }, []);

  const handleHandledReminderNavigation = useCallback(() => {
    setPendingReminderNavigation(null);
  }, []);

  // Three "keep showing the loading splash" signals that used to fall through
  // to AuthScreen and caused a visible login/signup flash on cold start for
  // already-logged-in users:
  //   1. Our SecureStore hydration is still in flight (`loadingSession`).
  //   2. Clerk hasn't finished hydrating its own stored session yet — we
  //      don't know whether the user is signed in until `clerkLoaded` is true.
  //   3. Clerk IS signed in but we're still waiting for the mobile-session
  //      JWT exchange (`handleNativeSessionSync`) to complete.
  const clerkHydrating = !clerkLoaded;
  const clerkSyncPending = clerkLoaded && isClerkSignedIn && !sessionToken;
  const shouldShowSplash = loadingSession || clerkHydrating || clerkSyncPending;

  if (shouldShowSplash) {
    // Branded splash: the full colour logo on a white background matches the
    // native iOS LaunchScreen (systemBackgroundColor is white) so there is no
    // visible flash between the native launch image and this JS splash while
    // Clerk + our SecureStore token exchange finish hydrating.
    return (
      <SafeAreaView style={[styles.safeArea, styles.splashSafeArea]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.splashContainer}>
          <Image
            source={require("./assets/splash-logo.png")}
            style={styles.splashLogo}
            resizeMode="contain"
            accessibilityLabel="Digital Polyglot"
          />
          <ActivityIndicator color="#1e62e3" style={styles.loadingSpinner} />
        </View>
      </SafeAreaView>
    );
  }

  if (!sessionToken && !previewModeOnly) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.authContainer}>
          <AuthScreen
            onAuthenticated={(token) => void handleAuthenticated(token)}
            onContinuePreview={() => setPreviewModeOnly(true)}
            onClerkSessionCreated={() => void handleNativeSessionSync()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <MobileLibraryShell
        sessionToken={sessionToken}
        sessionUserId={session?.sub ?? null}
        sessionName={session?.name ?? null}
        sessionEmail={session?.email ?? null}
        sessionPlan={session?.plan ?? null}
        sessionTargetLanguages={session?.targetLanguages ?? []}
        sessionBooksCount={session?.booksCount ?? 0}
        sessionStoriesCount={session?.storiesCount ?? 0}
        pushState={pushState}
        pendingReminderNavigation={pendingReminderNavigation}
        onHandledReminderNavigation={handleHandledReminderNavigation}
        onSignOut={handleSignOutSync}
        onRequestSignIn={handleRequestSignIn}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={mobileConfig.clerkPublishableKey} tokenCache={tokenCache}>
      <MobileAppRoot />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0c1626",
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#f5f7fb",
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  loadingBrand: {
    color: "#f5f7fb",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  loadingSpinner: {
    marginTop: 18,
  },
  splashSafeArea: {
    backgroundColor: "#ffffff",
  },
  splashContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ffffff",
  },
  splashLogo: {
    width: 260,
    height: 132,
  },
});
