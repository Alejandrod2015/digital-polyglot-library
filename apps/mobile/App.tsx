import "./src/polyfills";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClerkProvider, useAuth, useClerk } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Linking, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
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

WebBrowser.maybeCompleteAuthSession();

type PendingReminderNavigation = {
  key: string;
  target: ReminderDestination;
};

const MOBILE_AUTH_REDIRECT_URI = "digitalpolyglot://auth/callback";

function extractMobileAuthToken(urlString: string | null | undefined): string | null {
  if (!urlString) return null;

  try {
    const url = new URL(urlString);
    const isSupportedProtocol =
      url.protocol === "digitalpolyglot:" || url.protocol === "com.digitalpolyglot.mobile:";
    if (!isSupportedProtocol) {
      return null;
    }

    const token = url.searchParams.get("token")?.trim() ?? "";
    return token || null;
  } catch {
    return null;
  }
}

function getNotificationsModule():
  | typeof import("expo-notifications")
  | null {
  try {
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

function useMobileShellState() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [previewModeOnly, setPreviewModeOnly] = useState(false);
  const [pushState, setPushState] = useState<PushRegistrationState>({ status: "idle" });
  const [pendingReminderNavigation, setPendingReminderNavigation] = useState<PendingReminderNavigation | null>(null);

  const handleAuthenticated = useCallback(async (token: string) => {
    await saveMobileSessionToken(token);
    setSessionToken(token);
    setPreviewModeOnly(false);
    setPushState({
      status: "unsupported",
      message: "Push notifications will be enabled in the next native rebuild.",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const storedToken = await loadMobileSessionToken();
      if (cancelled) return;
      setSessionToken((currentToken) => currentToken ?? storedToken);
      setLoadingSession(false);
    }

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateInitialUrl() {
      const initialUrl = await Linking.getInitialURL();
      if (cancelled) return;
      const token = extractMobileAuthToken(initialUrl);
      if (!token) return;
      void handleAuthenticated(token);
    }

    void hydrateInitialUrl();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      const token = extractMobileAuthToken(url);
      if (!token) return;
      void handleAuthenticated(token);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [handleAuthenticated]);

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
      setPendingReminderNavigation({
        key: `${Date.now()}-initial`,
        target,
      });
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
      setPendingReminderNavigation({
        key: `${Date.now()}-tap`,
        target,
      });
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

  return {
    sessionToken,
    session,
    loadingSession,
    previewModeOnly,
    pushState,
    pendingReminderNavigation,
    setPreviewModeOnly,
    setSessionToken,
    setPushState,
    setPendingReminderNavigation,
    handleAuthenticated,
  };
}

function FallbackAuthScreen(args: {
  onAuthenticated: (token: string) => void;
  onContinuePreview: () => void;
}) {
  const { onAuthenticated, onContinuePreview } = args;
  const [submitting, setSubmitting] = useState<"web" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function beginWebSignIn() {
    setSubmitting("web");
    setError(null);

    try {
      const redirectUri = AuthSession.makeRedirectUri({
        native: MOBILE_AUTH_REDIRECT_URI,
        scheme: "digitalpolyglot",
        path: "auth/callback",
      });
      const startUrl = new URL("/mobile-auth", mobileConfig.apiBaseUrl);
      startUrl.searchParams.set("redirect_uri", redirectUri);

      const result = await WebBrowser.openAuthSessionAsync(startUrl.toString(), redirectUri);
      if (result.type !== "success" || !result.url) {
        throw new Error("Sign-in was cancelled before it finished.");
      }

      const url = new URL(result.url);
      const token = url.searchParams.get("token")?.trim() ?? "";
      if (!token) {
        throw new Error("The mobile sign-in completed without a session token.");
      }

      onAuthenticated(token);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={styles.eyebrow}>iPhone library</Text>
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>Web fallback</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>Open your stories on iPhone</Text>
      <Text style={styles.cardBody}>
        This build is missing the native auth key, so we are falling back to web sign-in instead of crashing.
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Pressable
        onPress={() => void beginWebSignIn()}
        disabled={submitting !== null}
        style={[styles.primaryButton, submitting ? styles.primaryButtonDisabled : null]}
      >
        <Text style={styles.primaryButtonText}>
          {submitting === "web" ? "Opening..." : "Use web sign-in"}
        </Text>
      </Pressable>
      <Pressable onPress={onContinuePreview} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Continue in preview</Text>
      </Pressable>
    </View>
  );
}

function FallbackMobileAppRoot() {
  const {
    sessionToken,
    session,
    loadingSession,
    previewModeOnly,
    pushState,
    pendingReminderNavigation,
    setPreviewModeOnly,
    setSessionToken,
    setPushState,
    setPendingReminderNavigation,
    handleAuthenticated,
  } = useMobileShellState();

  async function handleSignOut() {
    await clearMobileSessionToken();
    setSessionToken(null);
    setPreviewModeOnly(false);
    setPushState({ status: "idle" });
  }

  if (loadingSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading iOS workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!sessionToken && !previewModeOnly) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.authContainer}>
          <FallbackAuthScreen
            onAuthenticated={(token) => void handleAuthenticated(token)}
            onContinuePreview={() => setPreviewModeOnly(true)}
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
        onHandledReminderNavigation={() => setPendingReminderNavigation(null)}
        onSignOut={() => void handleSignOut()}
        onRequestSignIn={() => setPreviewModeOnly(false)}
      />
    </SafeAreaView>
  );
}

function NativeMobileAppRoot() {
  const {
    sessionToken,
    session,
    loadingSession,
    previewModeOnly,
    pushState,
    pendingReminderNavigation,
    setPreviewModeOnly,
    setSessionToken,
    setPushState,
    setPendingReminderNavigation,
    handleAuthenticated,
  } = useMobileShellState();
  const { isLoaded: clerkLoaded, isSignedIn: isClerkSignedIn, getToken } = useAuth();
  const { signOut: clerkSignOut } = useClerk();

  const handleNativeSessionSync = useCallback(async () => {
    const clerkSessionToken = await getToken();
    if (!clerkSessionToken) {
      return false;
    }

    const mobileToken = await exchangeClerkSessionForMobileToken(clerkSessionToken);
    await handleAuthenticated(mobileToken);
    return true;
  }, [getToken, handleAuthenticated]);

  useEffect(() => {
    if (!clerkLoaded || !isClerkSignedIn || sessionToken || loadingSession) {
      return;
    }

    void handleNativeSessionSync().catch((error) => {
      console.error("Failed to sync Clerk session into mobile session", error);
    });
  }, [clerkLoaded, handleNativeSessionSync, isClerkSignedIn, loadingSession, sessionToken]);

  async function handleSignOut() {
    await clearMobileSessionToken();
    await clerkSignOut().catch(() => {});
    setSessionToken(null);
    setPreviewModeOnly(false);
    setPushState({ status: "idle" });
  }

  if (loadingSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading iOS workspace...</Text>
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
        onHandledReminderNavigation={() => setPendingReminderNavigation(null)}
        onSignOut={() => void handleSignOut()}
        onRequestSignIn={() => setPreviewModeOnly(false)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  if (!mobileConfig.clerkPublishableKey) {
    console.warn("[mobile auth] Missing Clerk publishable key. Falling back to web sign-in mode.");
    return <FallbackMobileAppRoot />;
  }

  return (
    <ClerkProvider publishableKey={mobileConfig.clerkPublishableKey} tokenCache={tokenCache}>
      <NativeMobileAppRoot />
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
  card: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: "#12233a",
    borderWidth: 1,
    borderColor: "rgba(127,149,178,0.24)",
    gap: 16,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: "#8fb2ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  livePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.18)",
  },
  livePillText: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#f5f7fb",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
  },
  cardBody: {
    color: "#9fb2c9",
    fontSize: 17,
    lineHeight: 25,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#d7e3f4",
    fontSize: 16,
    fontWeight: "700",
  },
});
