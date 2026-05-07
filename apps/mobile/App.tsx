import "./src/polyfills";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClerkProvider, useAuth, useClerk } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import * as SplashScreen from "expo-splash-screen";

// Prevent the native splash from auto-hiding the moment React mounts.
// We hide it programmatically AFTER the JS has rendered the in-app
// `ExtendedSplash` component, so the user never sees a brief gap or
// size change between the native logo and the React-rendered one.
// Has to run at module load (not inside a component) to win the race
// against the native auto-hide.
SplashScreen.preventAutoHideAsync().catch(() => {
  // The promise rejects when called too late (already hidden) — safe
  // to ignore. The fallback is the default auto-hide behavior.
});
import {
  Image,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type TextProps,
} from "react-native";
import {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";
import { nunitoFamilyForWeight } from "./src/theme/tokens";

/**
 * Global Text patch: map `fontWeight` on every <Text> to the matching
 * Nunito family so existing components (which use fontWeight: "900"
 * etc.) pick up the right font file without any edit. Custom fonts in
 * RN don't honor fontWeight alone — the family name is authoritative.
 * Runs once at module load, before any component renders.
 */
const TextAny = Text as unknown as {
  render: (props: TextProps, ref: unknown) => unknown;
};
const originalTextRender = TextAny.render;
TextAny.render = function patchedTextRender(props: TextProps, ref: unknown) {
  const flattened = StyleSheet.flatten(props.style) ?? {};
  const weight = (flattened as { fontWeight?: string | number }).fontWeight;
  const nextStyle = [{ fontFamily: nunitoFamilyForWeight(weight) }, props.style];
  return originalTextRender.call(this, { ...props, style: nextStyle }, ref);
};
import { AuthScreen } from "./src/auth/AuthScreen";
import { exchangeClerkSessionForMobileToken } from "./src/auth/exchangeClerkSession";
import {
  clearMobileSessionToken,
  decodeMobileSessionToken,
  loadMobileSessionToken,
  saveMobileSessionToken,
  type MobileSessionPayload,
} from "./src/auth/mobileSession";
import {
  clearSessionAnchor,
  loadSessionAnchor,
  saveSessionAnchor,
  type SessionAnchor,
} from "./src/auth/sessionAnchor";
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
  // Parallel "proof of prior sign-in" that survives the exact failure
  // modes that affect SecureStore cold-start. When sessionToken is null
  // but sessionAnchor is set, we enter the Shell in offline-degraded
  // mode instead of dead-ending at AuthScreen.
  const [sessionAnchor, setSessionAnchor] = useState<SessionAnchor | null>(null);
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
    // Write the anchor alongside the token so offline cold-starts have a
    // non-secure fallback if Keychain ever fails to return the JWT.
    const decoded = decodeMobileSessionToken(token);
    if (decoded) {
      const anchor: SessionAnchor = {
        userId: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        plan: decoded.plan,
        targetLanguages: decoded.targetLanguages,
        booksCount: decoded.booksCount,
        storiesCount: decoded.storiesCount,
        savedAt: new Date().toISOString(),
      };
      await saveSessionAnchor(anchor);
      setSessionAnchor(anchor);
    }
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

      // Load both sources of "user is signed in" evidence in parallel. The
      // token (SecureStore) is authoritative when readable; the anchor
      // (documentDirectory) is a fallback for when Keychain fails or the
      // token is structurally broken.
      const [storedToken, storedAnchor] = await Promise.all([
        loadMobileSessionToken(),
        loadSessionAnchor(),
      ]);
      if (cancelled) return;

      // If the token is structurally unparseable we drop it — no way the
      // API will ever accept it. An EXPIRED token we keep: offline
      // cold-start needs some proof of prior sign-in, and online the
      // first 401 naturally triggers sign-out via the Shell.
      let effectiveToken: string | null = storedToken;
      let decodedToken: ReturnType<typeof decodeMobileSessionToken> = null;
      if (storedToken) {
        decodedToken = decodeMobileSessionToken(storedToken);
        if (!decodedToken) {
          await clearMobileSessionToken();
          effectiveToken = null;
        }
      }

      // Backfill defensivo del sessionAnchor: si tenemos token válido
      // pero NO hay anchor en disco, lo guardamos AHORA derivándolo
      // del token. Importante: AWAIT (no fire-and-forget) — si la app
      // se cerraba antes de que el write terminara, el archivo
      // quedaba sin escribir y la siguiente apertura offline tiraba
      // al usuario al AuthScreen. Con await garantizamos que el
      // anchor está en disco antes de continuar.
      let effectiveAnchor: SessionAnchor | null = storedAnchor;
      if (!effectiveAnchor && decodedToken) {
        effectiveAnchor = {
          userId: decodedToken.sub,
          email: decodedToken.email,
          name: decodedToken.name,
          plan: decodedToken.plan,
          targetLanguages: decodedToken.targetLanguages,
          booksCount: decodedToken.booksCount,
          storiesCount: decodedToken.storiesCount,
          savedAt: new Date().toISOString(),
        };
        await saveSessionAnchor(effectiveAnchor);
      }

      setSessionToken((currentToken) => currentToken ?? effectiveToken);
      setSessionAnchor((currentAnchor) => currentAnchor ?? effectiveAnchor);
      setLoadingSession(false);
    }

    void hydrateSession();
    return () => { cancelled = true; };
  }, []);

  // Defensa extra: cada vez que `sessionToken` se setea a uno válido,
  // garantizamos que el anchor en disco está actualizado. Cubre los
  // casos en que `hydrateSession` no llegó a backfillar (porque
  // SecureStore retornó null en ese cold-start) y luego, al venir
  // online, Clerk auto-sync mintió un token nuevo: ahí guardamos el
  // anchor que la próxima apertura offline va a necesitar.
  useEffect(() => {
    if (!sessionToken) return;
    const decoded = decodeMobileSessionToken(sessionToken);
    if (!decoded) return;
    const anchor: SessionAnchor = {
      userId: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      plan: decoded.plan,
      targetLanguages: decoded.targetLanguages,
      booksCount: decoded.booksCount,
      storiesCount: decoded.storiesCount,
      savedAt: new Date().toISOString(),
    };
    void saveSessionAnchor(anchor);
    setSessionAnchor((current) => current ?? anchor);
  }, [sessionToken]);

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
          void clearSessionAnchor();
          setSessionToken(null);
          setSessionAnchor(null);
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

  // Safety-net timer for the case where Clerk cannot hydrate (no network,
  // server down, etc.) AND we don't have a valid local mobile session. Without
  // it the splash would hang forever; with it we fall through to the auth
  // screen after 4s so the user can retry or try again later.
  const [clerkHydrationTimedOut, setClerkHydrationTimedOut] = useState(false);
  useEffect(() => {
    if (clerkLoaded) {
      setClerkHydrationTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setClerkHydrationTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, [clerkLoaded]);

  const handleSignOut = useCallback(async () => {
    await clearMobileSessionToken();
    await clearSessionAnchor();
    await clerkSignOut().catch(() => {});
    setSessionToken(null);
    setSessionAnchor(null);
    setPreviewModeOnly(false);
    setPushState({ status: "idle" });
  }, [clerkSignOut]);

  const handleSignOutSync = useCallback(() => {
    void handleSignOut();
  }, [handleSignOut]);

  const handleRequestSignIn = useCallback(() => {
    setPreviewModeOnly(false);
    // Clear the offline anchor so the AuthScreen actually renders.
    // Without this, an expired session that left an anchor behind keeps
    // the app on MobileLibraryShell forever — Sign in becomes a no-op.
    void clearSessionAnchor();
    setSessionAnchor(null);
  }, []);

  const handleHandledReminderNavigation = useCallback(() => {
    setPendingReminderNavigation(null);
  }, []);

  // "Keep showing the loading splash" signals that would otherwise fall
  // through to AuthScreen and cause a visible login/signup flash on cold
  // start for already-logged-in users:
  //   1. Our SecureStore hydration is still in flight (`loadingSession`).
  //   2. Clerk hasn't finished hydrating its own stored session yet — we
  //      don't know whether the user is signed in until `clerkLoaded` is
  //      true. BUT this is bypassed when we already have a valid local
  //      mobile JWT (`hasValidLocalSession`): we know the user is signed in
  //      without needing Clerk to confirm it, which is critical for offline
  //      cold-starts where Clerk can't reach its servers and would hang the
  //      splash forever. The 4s timeout is a second safety net for the
  //      edge-case where we have no local JWT and Clerk also can't hydrate.
  //   3. Clerk IS signed in but we're still waiting for the mobile-session
  //      JWT exchange (`handleNativeSessionSync`) to complete.
  // Two independent pieces of evidence that the user has signed in:
  //   - a parseable JWT in SecureStore (authoritative when present)
  //   - a document-directory anchor (fallback for Keychain failures)
  // Either one is enough to skip Clerk hydration and enter the Shell,
  // because offline we cannot verify anything against Clerk anyway.
  const hasLocalSignInEvidence = Boolean(session) || Boolean(sessionAnchor);
  const clerkHydrating = !clerkLoaded && !hasLocalSignInEvidence && !clerkHydrationTimedOut;
  // Only show the "Clerk signed in, waiting for mobile JWT exchange"
  // splash when we have NO evidence at all. If we already have an anchor
  // from a prior sign-in, we can enter the Shell offline-degraded instead
  // of hanging on the splash while Clerk tries (and fails) to reach its
  // servers.
  const clerkSyncPending =
    clerkLoaded && isClerkSignedIn && !sessionToken && !sessionAnchor;
  const shouldShowSplash = loadingSession || clerkHydrating || clerkSyncPending;

  if (shouldShowSplash) {
    // Same pattern as the font-loading branch above: render an
    // empty matching-bg View while the native splash (kept up via
    // preventAutoHideAsync) covers the screen. ExtendedSplash
    // takes over later inside MobileLibraryShell. Eliminates the
    // visible "static logo" intermediate state.
    return <View style={styles.safeArea} />;
  }

  // Only show AuthScreen when there's NO evidence of a prior sign-in.
  // An anchor alone (no token) is still enough to enter the Shell in
  // offline-degraded mode — the Shell's existing `isOffline` banner and
  // cached snapshot cover the UX, and as soon as we go online again,
  // Clerk's auto-sync will mint a fresh token and everything hydrates.
  if (!sessionToken && !sessionAnchor && !previewModeOnly) {
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
        // Fall back to the anchor when the decoded token isn't available
        // (offline cold-start where SecureStore failed). Those fields
        // are only used for display + as hints for the UI; the anchor
        // captures them at sign-in time so the Shell looks identical.
        sessionUserId={session?.sub ?? sessionAnchor?.userId ?? null}
        sessionName={session?.name ?? sessionAnchor?.name ?? null}
        sessionEmail={session?.email ?? sessionAnchor?.email ?? null}
        sessionPlan={session?.plan ?? sessionAnchor?.plan ?? null}
        sessionTargetLanguages={session?.targetLanguages ?? sessionAnchor?.targetLanguages ?? []}
        sessionBooksCount={session?.booksCount ?? sessionAnchor?.booksCount ?? 0}
        sessionStoriesCount={session?.storiesCount ?? sessionAnchor?.storiesCount ?? 0}
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
  // Block the app until Nunito is ready. While it's loading we keep the
  // same branded splash the rest of the app uses so there's no white
  // flash and no "font swap" visible to the user on cold start. If the
  // fonts ever fail to load we still render the app — RN falls back to
  // the system font rather than leaving the user stuck on the splash.
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // Timeout defensivo. `useFonts` puede colgarse sin error en un cold
  // start offline si las fonts no estaban cacheadas y la red no
  // responde — `fontsLoaded` permanece false y `fontError` nunca se
  // setea. Antes el app quedaba congelada en un View vacío con color
  // de fondo (el usuario veía "solo el azul, ni el logo"). Después de
  // 3 segundos, forzamos el render con system fonts como fallback.
  // El comentario original ya reconocía este caso pero no estaba
  // implementado.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(id);
  }, []);

  if (!fontsLoaded && !fontError && !fontTimeout) {
    // Render NOTHING during font loading — the native splash
    // (kept up via SplashScreen.preventAutoHideAsync at module
    // load) is still covering the screen, so the user sees
    // continuous "logo on dark bg" until ExtendedSplash takes
    // over. Earlier this branch rendered a separate static
    // splash image which the user perceived as "static logo for
    // a few seconds, then animated logo" — two visible logo
    // states. Returning a plain background View eliminates that
    // intermediate state.
    return <View style={styles.safeArea} />;
  }

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
  splashContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0c1626",
  },
  splashLogo: {
    // Same width:'100%' + intrinsic aspect ratio as ExtendedSplash
    // and the native splash, so all three render the wordmark at
    // the exact same size and the user can't perceive the handoff
    // between them.
    width: "100%",
    aspectRatio: 904 / 437,
  },
});
