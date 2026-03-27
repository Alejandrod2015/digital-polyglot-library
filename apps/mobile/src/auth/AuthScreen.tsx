import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@clerk/expo";
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileConfig } from "../config";
import { exchangeClerkSessionForMobileToken } from "./exchangeClerkSession";

WebBrowser.maybeCompleteAuthSession();

const MOBILE_AUTH_REDIRECT_URI = "digitalpolyglot://auth/callback";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function AuthScreen(args: {
  onAuthenticated: (token: string) => void;
  onContinuePreview: () => void;
}) {
  const { onAuthenticated, onContinuePreview } = args;
  const { isLoaded: authLoaded, getToken } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const [submitting, setSubmitting] = useState<"sign-in" | "sign-up" | "verify-sign-up" | "web" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [awaitingEmailCode, setAwaitingEmailCode] = useState(false);

  async function getClerkSessionTokenWithRetry() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = await getToken();
      if (token) {
        return token;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  }

  async function completeNativeSession(createdSessionId: string, activate: ((params: { session: string }) => Promise<void>) | undefined) {
    if (!activate) {
      throw new Error("The native auth session could not be activated.");
    }

    await activate({ session: createdSessionId });

    const clerkSessionToken = await getClerkSessionTokenWithRetry();
    if (!clerkSessionToken) {
      throw new Error("Native auth completed but no Clerk session token was available.");
    }

    const mobileToken = await exchangeClerkSessionForMobileToken(clerkSessionToken);
    onAuthenticated(mobileToken);
  }

  async function beginNativeSignIn() {
    if (!authLoaded || !signInLoaded || !signIn || !setActive) {
      setError("Native sign-in is still loading. Try again in a second.");
      return;
    }

    if (!identifier.trim() || !password) {
      setError("Enter your email and password first.");
      return;
    }

    setSubmitting("sign-in");
    setError(null);

    try {
      const attempt = await signIn.create({
        strategy: "password",
        identifier: identifier.trim(),
        password,
      });

      if (!attempt.createdSessionId) {
        throw new Error("Sign-in did not create a session.");
      }

      await completeNativeSession(attempt.createdSessionId, setActive);
    } catch (authError) {
      setError(toErrorMessage(authError));
    } finally {
      setSubmitting(null);
    }
  }

  async function beginNativeSignUp() {
    if (!authLoaded || !signUpLoaded || !signUp) {
      setError("Native sign-up is still loading. Try again in a second.");
      return;
    }

    if (!identifier.trim() || !password) {
      setError("Enter your email and password first.");
      return;
    }

    setSubmitting("sign-up");
    setError(null);

    try {
      const attempt = await signUp.create({
        emailAddress: identifier.trim(),
        password,
      });

      if (attempt.createdSessionId) {
        await completeNativeSession(attempt.createdSessionId, setActiveSignUp);
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setAwaitingEmailCode(true);
    } catch (authError) {
      setError(toErrorMessage(authError));
    } finally {
      setSubmitting(null);
    }
  }

  async function verifyNativeSignUp() {
    if (!signUpLoaded || !signUp) {
      setError("Verification is still loading. Try again in a second.");
      return;
    }

    if (!verificationCode.trim()) {
      setError("Enter the code we sent to your email.");
      return;
    }

    setSubmitting("verify-sign-up");
    setError(null);

    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (!attempt.createdSessionId) {
        throw new Error("Email verification completed but no session was created.");
      }

      await completeNativeSession(attempt.createdSessionId, setActiveSignUp);
    } catch (authError) {
      setError(toErrorMessage(authError));
    } finally {
      setSubmitting(null);
    }
  }

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
      setError(toErrorMessage(authError));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={styles.eyebrow}>iPhone library</Text>
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>Reader + audio</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>Pick up your stories on iPhone</Text>
      <Text style={styles.cardBody}>
        Sign in with your existing account and the app will open your saved books, stories and
        listening progress in a mobile-friendly reader.
      </Text>

      <View style={styles.nativeSection}>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => {
              setAuthMode("sign-in");
              setAwaitingEmailCode(false);
              setVerificationCode("");
              setError(null);
            }}
            style={[styles.modeButton, authMode === "sign-in" ? styles.modeButtonActive : null]}
          >
            <Text style={[styles.modeButtonText, authMode === "sign-in" ? styles.modeButtonTextActive : null]}>
              Sign in
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setAuthMode("sign-up");
              setAwaitingEmailCode(false);
              setVerificationCode("");
              setError(null);
            }}
            style={[styles.modeButton, authMode === "sign-up" ? styles.modeButtonActive : null]}
          >
            <Text style={[styles.modeButtonText, authMode === "sign-up" ? styles.modeButtonTextActive : null]}>
              Sign up
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>
          {authMode === "sign-in" ? "Native sign-in" : "Native sign-up"}
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#7f95b2"
          value={identifier}
          onChangeText={setIdentifier}
          style={styles.input}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor="#7f95b2"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        {authMode === "sign-up" && awaitingEmailCode ? (
          <>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              placeholder="Email verification code"
              placeholderTextColor="#7f95b2"
              value={verificationCode}
              onChangeText={setVerificationCode}
              style={styles.input}
            />
            <Pressable
              disabled={submitting !== null}
              onPress={() => void verifyNativeSignUp()}
              style={[styles.primaryButton, submitting ? styles.primaryButtonDisabled : null]}
            >
              <Text style={styles.primaryButtonText}>
                {submitting === "verify-sign-up" ? "Verifying..." : "Verify email and continue"}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            disabled={submitting !== null}
            onPress={() => void (authMode === "sign-in" ? beginNativeSignIn() : beginNativeSignUp())}
            style={[styles.primaryButton, submitting ? styles.primaryButtonDisabled : null]}
          >
            <Text style={styles.primaryButtonText}>
              {submitting === "sign-in"
                ? "Signing in..."
                : submitting === "sign-up"
                  ? "Creating account..."
                  : authMode === "sign-in"
                    ? "Sign in on iPhone"
                    : "Create account on iPhone"}
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable
        disabled={submitting !== null}
        onPress={() => void beginWebSignIn()}
        style={[styles.secondaryButton, submitting ? styles.primaryButtonDisabled : null]}
      >
        <Text style={styles.secondaryButtonText}>
          {submitting === "web" ? "Opening web sign-in..." : "Use web sign-in instead"}
        </Text>
      </Pressable>

      <Pressable onPress={onContinuePreview} style={styles.tertiaryButton}>
        <Text style={styles.secondaryButtonText}>Browse preview catalog</Text>
      </Pressable>

      <Text style={styles.helperText}>
        Native auth is now the default. The web flow stays here only as fallback while we finish
        the transition.
      </Text>

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
  cardBody: {
    color: "#c8d4e5",
    fontSize: 16,
    lineHeight: 24,
  },
  nativeSection: {
    gap: 10,
    marginTop: 4,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#315174",
    backgroundColor: "#203754",
    paddingVertical: 10,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "#f8c15c",
    borderColor: "#f8c15c",
  },
  modeButtonText: {
    color: "#dbe9ff",
    fontSize: 14,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: "#132238",
  },
  sectionLabel: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#315174",
    backgroundColor: "#0f1c2f",
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
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
    backgroundColor: "#203754",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#dbe9ff",
    fontSize: 15,
    fontWeight: "800",
  },
  helperText: {
    color: "#9fb5d0",
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: "#ffb4b4",
    fontSize: 13,
    lineHeight: 18,
  },
});
