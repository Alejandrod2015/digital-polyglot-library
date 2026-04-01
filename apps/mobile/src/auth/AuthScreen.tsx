import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { mobileConfig } from "../config";
import { NativeClerkModule, type NativeAuthMode } from "./nativeClerkModule";
import { exchangeClerkSessionForMobileToken } from "./exchangeClerkSession";


function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function readQaNativeAuthMode(urlString: string | null | undefined): NativeAuthMode | null {
  if (!__DEV__ || !urlString) {
    return null;
  }

  try {
    const url = new URL(urlString);
    if (url.protocol !== "digitalpolyglot:" || url.hostname !== "qa") {
      return null;
    }

    const action = url.pathname.replace(/^\/+/, "");
    if (action !== "native-auth") {
      return null;
    }

    return url.searchParams.get("mode") === "sign-up" ? "signUp" : "signIn";
  } catch {
    return null;
  }
}

function readSessionId(value: Record<string, unknown> | null | undefined): string {
  const sessionId = typeof value?.sessionId === "string" ? value.sessionId.trim() : "";
  return sessionId;
}

function readSessionStatus(value: Record<string, unknown> | null | undefined): string {
  return typeof value?.status === "string" ? value.status.trim().toLowerCase() : "";
}

function isRecoverableNativeSessionMismatch(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();

  return (
    message.includes("unable to find a signing key in jwks") ||
    message.includes("session lookup failed: not found") ||
    message.includes("session lookup returned no session") ||
    (message.includes("kid='") && message.includes("clerk")) ||
    (message.includes("bearer verification failed") && message.includes("clerk"))
  );
}

async function resetNativeAuthState() {
  if (!NativeClerkModule) {
    return;
  }

  await NativeClerkModule.signOut().catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function exchangeNativeSessionForMobileToken(
  fallbackSessionId?: string
): Promise<string> {
  if (!NativeClerkModule) {
    throw new Error("Native Clerk is not available in this build yet.");
  }

  console.log("[native-auth] exchange:start", {
    hasFallbackSessionId: Boolean(fallbackSessionId?.trim()),
    hasGetSessionToken: typeof NativeClerkModule.getSessionToken === "function",
  });
  const nativeSessionToken =
    typeof NativeClerkModule.getSessionToken === "function"
      ? ((await NativeClerkModule.getSessionToken().catch(() => null))?.trim() ?? "")
      : "";
  const errors: string[] = [];

  if (nativeSessionToken) {
    try {
      console.log("[native-auth] exchange:bearer");
      return await exchangeClerkSessionForMobileToken({ clerkSessionToken: nativeSessionToken });
    } catch (error) {
      console.error("[native-auth] exchange:bearer:error", error);
      errors.push(`bearer exchange: ${toErrorMessage(error)}`);
    }
  }

  const sessionId = fallbackSessionId?.trim() || (await waitForActiveNativeSession());
  try {
    console.log("[native-auth] exchange:session", { sessionId });
    return await exchangeClerkSessionForMobileToken({ sessionId });
  } catch (error) {
    console.error("[native-auth] exchange:session:error", error);
    errors.push(`session exchange: ${toErrorMessage(error)}`);
  }

  throw new Error(errors.join(" | ") || "Mobile session exchange failed.");
}

async function waitForActiveNativeSession(): Promise<string> {
  if (!NativeClerkModule) {
    throw new Error("Native Clerk is not available in this build yet.");
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const session = await NativeClerkModule.getSession();
    const sessionId = readSessionId(session);
    const status = readSessionStatus(session);

    if (sessionId && (!status || status === "active")) {
      console.log("[native-auth] session:active", { attempt, sessionId, status });
      return sessionId;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const fallbackSessionId = readSessionId(await NativeClerkModule.getSession());
  if (fallbackSessionId) {
    return fallbackSessionId;
  }

  throw new Error("Native auth completed without an active session.");
}

export function AuthScreen(args: {
  onAuthenticated: (token: string) => void;
  onContinuePreview: () => void;
}) {
  const { onAuthenticated, onContinuePreview } = args;
  const [submitting, setSubmitting] = useState<"getStarted" | "signIn" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function beginNativeAuth(mode: NativeAuthMode) {
    if (!NativeClerkModule) {
      setError(
        "Native Clerk is not available in this build yet. Rebuild the app after enabling the Clerk Expo plugin."
      );
      return;
    }

    if (!mobileConfig.clerkPublishableKey) {
      setError("This build is missing the Clerk publishable key.");
      return;
    }

    try {
      const keyType = mobileConfig.clerkPublishableKey.startsWith("pk_live_") ? "LIVE" : "TEST";
      console.log("[native-auth] begin", { mode, keyType, keyPrefix: mobileConfig.clerkPublishableKey.substring(0, 12) });
      await NativeClerkModule.configure(mobileConfig.clerkPublishableKey, null);
      console.log("[native-auth] configured");

      let didResetForMismatch = false;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        console.log("[native-auth] presentAuth:start", { attempt });
        const result = await NativeClerkModule.presentAuth({
          mode,
          dismissable: true,
        });
        console.log("[native-auth] presentAuth:result", result ?? null);

        const resolvedSessionId = result?.cancelled
          ? readSessionId(await NativeClerkModule.getSession()) || existingSessionId
          : result?.sessionId?.trim() ||
            readSessionId(await NativeClerkModule.getSession()) ||
            existingSessionId;

        if (!resolvedSessionId) {
          throw new Error(
            result?.cancelled
              ? "Sign-in was cancelled before it finished."
              : "Native auth completed without a session."
          );
        }

        try {
          const mobileToken = await exchangeNativeSessionForMobileToken(resolvedSessionId);
          console.log("[native-auth] authenticated");
          onAuthenticated(mobileToken);
          return;
        } catch (exchangeError) {
          if (!didResetForMismatch && isRecoverableNativeSessionMismatch(exchangeError)) {
            didResetForMismatch = true;
            console.warn("[native-auth] mismatch detected, resetting native state", exchangeError);
            await resetNativeAuthState();
            await NativeClerkModule.configure(mobileConfig.clerkPublishableKey, null);
            continue;
          }

          throw exchangeError;
        }
      }
    } catch (authError) {
      console.error("[native-auth] begin:error", authError);
      setError(toErrorMessage(authError));
    } finally {
      setSubmitting(null);
    }
  }


  useEffect(() => {
    if (!__DEV__ || submitting !== null) {
      return;
    }

    let cancelled = false;

    async function maybeLaunchQaNativeAuth() {
      const initialUrl = await Linking.getInitialURL();
      if (cancelled) return;

      const mode = readQaNativeAuthMode(initialUrl);
      if (!mode) {
        return;
      }

      void beginNativeAuth(mode);
    }

    void maybeLaunchQaNativeAuth();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      const mode = readQaNativeAuthMode(url);
      if (!mode) {
        return;
      }

      void beginNativeAuth(mode);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [submitting]);

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={styles.eyebrow}>iPhone library</Text>
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>Reader + audio</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>Read and listen in any language</Text>

      <Pressable
        disabled={submitting !== null}
        onPress={() => {
          setError(null);
          setSubmitting("getStarted");
          void beginNativeAuth("signInOrUp");
        }}
        style={[styles.primaryButton, submitting ? styles.primaryButtonDisabled : null]}
      >
        <Text style={styles.primaryButtonText}>
          {submitting === "getStarted" ? "Opening..." : "Get started"}
        </Text>
      </Pressable>

      <Pressable
        disabled={submitting !== null}
        onPress={() => {
          setError(null);
          setSubmitting("signIn");
          void beginNativeAuth("signIn");
        }}
        style={[styles.secondaryButton, submitting ? styles.primaryButtonDisabled : null]}
      >
        <Text style={styles.secondaryButtonText}>
          {submitting === "signIn" ? "Opening..." : "I already have an account"}
        </Text>
      </Pressable>

      <Pressable onPress={onContinuePreview} style={styles.tertiaryButton}>
        <Text style={styles.tertiaryButtonText}>Browse without an account</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#14243b",
    borderRadius: 28,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#27405f",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  eyebrow: {
    color: "#f8c15c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  livePill: {
    borderRadius: 999,
    backgroundColor: "#203754",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#315174",
  },
  livePillText: {
    color: "#d7e7ff",
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#f8c15c",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#132238",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 16,
    backgroundColor: "#203754",
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#315174",
  },
  tertiaryButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#315174",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#dbe9ff",
    fontSize: 15,
    fontWeight: "700",
  },
  tertiaryButtonText: {
    color: "#8fa8c8",
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: "#ffb4ab",
    fontSize: 14,
    lineHeight: 20,
  },
});
