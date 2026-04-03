import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileConfig } from "../config";

WebBrowser.maybeCompleteAuthSession();

const MOBILE_AUTH_REDIRECT_URI = "digitalpolyglot://auth/callback";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function AuthScreen(args: {
  onAuthenticated: (token: string) => void;
  onContinuePreview: () => void;
}) {
  const { onAuthenticated, onContinuePreview } = args;
  const [submitting, setSubmitting] = useState<"getStarted" | "signIn" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function beginWebAuth(mode: "signIn" | "signUp") {
    setError(null);
    setSubmitting(mode === "signIn" ? "signIn" : "getStarted");

    try {
      const redirectUri = AuthSession.makeRedirectUri({
        native: MOBILE_AUTH_REDIRECT_URI,
        scheme: "digitalpolyglot",
        path: "auth/callback",
      });

      const startUrl = new URL("/mobile-auth", mobileConfig.apiBaseUrl);
      startUrl.searchParams.set("redirect_uri", redirectUri);
      startUrl.searchParams.set("mode", mode);

      const result = await WebBrowser.openAuthSessionAsync(startUrl.toString(), redirectUri);

      if (result.type !== "success" || !result.url) {
        return;
      }

      const url = new URL(result.url);
      const token = url.searchParams.get("token")?.trim() ?? "";
      if (!token) {
        throw new Error("Sign-in completed without a session token. Please try again.");
      }

      onAuthenticated(token);
    } catch (authError) {
      setError(toErrorMessage(authError));
    } finally {
      setSubmitting(null);
    }
  }

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
          onPress={() => void beginWebAuth("signUp")}
          style={[styles.primaryButton, submitting !== null && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {submitting === "getStarted" ? "Opening…" : "Get started"}
          </Text>
        </Pressable>

        <Pressable
          disabled={submitting !== null}
          onPress={() => void beginWebAuth("signIn")}
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
