import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { mobileConfig } from "../config";
import { NativeClerkModule, type NativeAuthMode } from "./nativeClerkModule";
import { exchangeClerkSessionForMobileToken } from "./exchangeClerkSession";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function readQaNativeAuthMode(urlString: string | null | undefined): NativeAuthMode | null {
  if (!__DEV__ || !urlString) return null;

  try {
    const url = new URL(urlString);
    if (url.protocol !== "digitalpolyglot:" || url.hostname !== "qa") return null;
    const action = url.pathname.replace(/^\/+/, "");
    if (action !== "native-auth") return null;
    return url.searchParams.get("mode") === "sign-up" ? "signUp" : "signIn";
  } catch {
    return null;
  }
}

function readSessionId(value: Record<string, unknown> | null | undefined): string {
  return typeof value?.sessionId === "string" ? value.sessionId.trim() : "";
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

export function AuthScreen(args: {
  onAuthenticated: (token: string) => void;
  onContinuePreview: () => void;
}) {
  const { onAuthenticated, onContinuePreview } = args;
  const { getToken } = useAuth();
  const [submitting, setSubmitting] = useState<"getStarted" | "signIn" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getClerkSessionTokenWithRetry(): Promise<string | null> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const token = await getToken();
      if (token) return token;
      await new Promise((r) => setTimeout(r, 300));
    }
    return null;
  }

  async function exchangeAfterNativeAuth(): Promise<string> {
    const clerkSessionToken = await getClerkSessionTokenWithRetry();
    if (!clerkSessionToken) {
      throw new Error("Sign-in completed but no session token was available. Please try again.");
    }
    return await exchangeClerkSessionForMobileToken({ clerkSessionToken });
  }

  async function beginNativeAuth(mode: NativeAuthMode) {
    if (!NativeClerkModule) {
      setError("Native Clerk is not available in this build.");
      return;
    }

    if (!mobileConfig.clerkPublishableKey) {
      setError("This build is missing the Clerk publishable key.");
      return;
    }

    try {
      const keyType = mobileConfig.clerkPublishableKey.startsWith("pk_live_") ? "LIVE" : "TEST";
      console.log("[native-auth] begin", {
        mode,
        keyType,
        keyPrefix: mobileConfig.clerkPublishableKey.substring(0, 12),
      });

      await NativeClerkModule.configure(mobileConfig.clerkPublishableKey, null);

      // Clear any stale existing Clerk session from keychain to avoid
      // the native UI showing "you're already signed in" unexpectedly.
      const existingSession = await NativeClerkModule.getSession().catch(() => null);
      if (readSessionId(existingSession)) {
        console.log("[native-auth] clearing stale existing session before auth");
        await NativeClerkModule.signOut().catch(() => {});
        await new Promise((r) => setTimeout(r, 300));
      }

      let didResetForMismatch = false;

      for (let attempt = 0; attempt < 2; attempt++) {
        console.log("[native-auth] presentAuth:start", { attempt });
        const result = await NativeClerkModule.presentAuth({ mode, dismissable: true });
        console.log("[native-auth] presentAuth:result", result ?? null);

        if (result?.cancelled) {
          return;
        }

        try {
          const mobileToken = await exchangeAfterNativeAuth();
          console.log("[native-auth] authenticated");
          onAuthenticated(mobileToken);
          return;
        } catch (exchangeError) {
          if (!didResetForMismatch && isRecoverableNativeSessionMismatch(exchangeError)) {
            didResetForMismatch = true;
            console.warn("[native-auth] mismatch detected, resetting native state", exchangeError);
            await NativeClerkModule.signOut().catch(() => {});
            await new Promise((r) => setTimeout(r, 250));
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
    if (!__DEV__ || submitting !== null) return;
    let cancelled = false;

    async function maybeLaunchQaNativeAuth() {
      const initialUrl = await Linking.getInitialURL();
      if (cancelled) return;
      const mode = readQaNativeAuthMode(initialUrl);
      if (mode) void beginNativeAuth(mode);
    }

    void maybeLaunchQaNativeAuth();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      const mode = readQaNativeAuthMode(url);
      if (mode) void beginNativeAuth(mode);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [submitting]);

  return (
    <View style={styles.card}>
      <View style={styles.brand}>
        <Text style={styles.brandMark}>◆</Text>
        <Text style={styles.brandName}>Digital Polyglot</Text>
      </View>

      <Text style={styles.headline}>Read stories.{"\n"}Learn languages.</Text>
      <Text style={styles.subtext}>
        Sign in to open your saved books, stories, and listening progress on iPhone.
      </Text>

      <View style={styles.actions}>
        <Pressable
          disabled={submitting !== null}
          onPress={() => {
            setError(null);
            setSubmitting("getStarted");
            void beginNativeAuth("signInOrUp");
          }}
          style={[styles.primaryButton, submitting !== null && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {submitting === "getStarted" ? "Opening…" : "Get started"}
          </Text>
        </Pressable>

        <Pressable
          disabled={submitting !== null}
          onPress={() => {
            setError(null);
            setSubmitting("signIn");
            void beginNativeAuth("signIn");
          }}
          style={[styles.secondaryButton, submitting !== null && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryButtonText}>
            {submitting === "signIn" ? "Opening…" : "I already have an account"}
          </Text>
        </Pressable>

        <Pressable onPress={onContinuePreview} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Browse without an account</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 28,
    backgroundColor: "#0f1e33",
    borderWidth: 1,
    borderColor: "#1e3450",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  brandMark: {
    color: "#f8c15c",
    fontSize: 11,
  },
  brandName: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  headline: {
    color: "#f5f7fb",
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 42,
    marginBottom: 12,
  },
  subtext: {
    color: "#7a95b3",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#f8c15c",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#0c1626",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#132238",
  },
  secondaryButtonText: {
    color: "#c8d8ee",
    fontSize: 15,
    fontWeight: "700",
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostButtonText: {
    color: "#4e6a8a",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: "#ffb4ab",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
});
