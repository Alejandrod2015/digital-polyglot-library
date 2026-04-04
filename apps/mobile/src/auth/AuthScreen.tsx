import * as WebBrowser from "expo-web-browser";
import { useClerk, useSignIn, useSignUp, useSSO } from "@clerk/expo";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

type ScreenState =
  | { kind: "initial" }
  | { kind: "email-form"; mode: "signIn" | "signUp" }
  | { kind: "verify-code"; email: string; mode: "signIn" | "signUp" };

export function AuthScreen(args: {
  onAuthenticated: (token: string) => void;
  onContinuePreview: () => void;
  onClerkSessionCreated: () => void;
}) {
  const { onContinuePreview, onClerkSessionCreated } = args;
  const [screen, setScreen] = useState<ScreenState>({ kind: "initial" });
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const { setActive } = useClerk();
  const { startSSOFlow } = useSSO();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  // ── Google OAuth ────────────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async () => {
    setError(null);
    setSubmitting("google");
    try {
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: "oauth_google",
      });
      if (createdSessionId) {
        const activate = ssoSetActive || setActive;
        await activate({ session: createdSessionId });
        onClerkSessionCreated();
      }
    } catch (err) {
      console.error("[auth] Google sign-in error:", err);
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  }, [startSSOFlow, onClerkSessionCreated]);

  // ── Email + Password Sign In ────────────────────────────────────────
  const handlePasswordSignIn = useCallback(async () => {
    if (!signIn) return;
    setError(null);
    setSubmitting("password");
    try {
      await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (signIn.status === "complete" && signIn.createdSessionId && setActive) {
        await setActive({ session: signIn.createdSessionId });
        onClerkSessionCreated();
      } else if (signIn.status === "needs_first_factor") {
        const emailCodeFactor = signIn.supportedFirstFactors?.find(
          (f) => f.strategy === "email_code"
        );
        if (emailCodeFactor && "emailAddressId" in emailCodeFactor) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          });
          setScreen({ kind: "verify-code", email: email.trim(), mode: "signIn" });
        } else {
          setError("Unable to sign in with these credentials.");
        }
      } else {
        setError("Sign-in incomplete. Please try again.");
      }
    } catch (err) {
      console.error("[auth] Password sign-in error:", err);
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  }, [signIn, email, password, setActive, onClerkSessionCreated]);

  // ── Email Sign Up ───────────────────────────────────────────────────
  const handleEmailSignUp = useCallback(async () => {
    if (!signUp) return;
    setError(null);
    setSubmitting("signup");
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setScreen({ kind: "verify-code", email: email.trim(), mode: "signUp" });
    } catch (err) {
      console.error("[auth] Sign-up error:", err);
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  }, [signUp, email, password]);

  // ── Verify Email Code ───────────────────────────────────────────────
  const handleVerifyCode = useCallback(async () => {
    setError(null);
    setSubmitting("verify");
    try {
      if (screen.kind !== "verify-code") return;

      if (screen.mode === "signIn" && signIn) {
        const result = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: code.trim(),
        });
        if (result.status === "complete" && result.createdSessionId && setActive) {
          await setActive({ session: result.createdSessionId });
          onClerkSessionCreated();
        } else {
          setError("Verification incomplete.");
        }
      } else if (screen.mode === "signUp" && signUp) {
        const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status === "complete" && result.createdSessionId && setActive) {
          await setActive({ session: result.createdSessionId });
          onClerkSessionCreated();
        } else {
          setError("Verification incomplete.");
        }
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  }, [screen, signIn, signUp, setActive, code, onClerkSessionCreated]);

  // ── Verify Code Screen ──────────────────────────────────────────────
  if (screen.kind === "verify-code") {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center" }}>
        <View style={styles.card}>
          <Header />
          <Text style={styles.headline}>Check your email</Text>
          <Text style={styles.subtext}>We sent a code to {screen.email}</Text>
          <TextInput
            style={styles.input}
            placeholder="Verification code"
            placeholderTextColor="#4e6a8a"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoFocus
          />
          <View style={styles.actions}>
            <PrimaryButton
              label="Verify"
              loading={submitting === "verify"}
              disabled={!code.trim()}
              onPress={() => void handleVerifyCode()}
            />
            <GhostButton label="Back" onPress={() => { setScreen({ kind: "initial" }); setCode(""); setError(null); }} />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Email Form Screen ───────────────────────────────────────────────
  if (screen.kind === "email-form") {
    const isSignUp = screen.mode === "signUp";
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.card}>
          <Header />
          <Text style={styles.headline}>{isSignUp ? "Create account" : "Sign in"}</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#4e6a8a"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#4e6a8a"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={() => {
              if (email.trim() && password) {
                void (screen.kind === "email-form" && screen.mode === "signUp" ? handleEmailSignUp() : handlePasswordSignIn());
              }
            }}
          />
          <View style={styles.actions}>
            <PrimaryButton
              label={isSignUp ? "Create account" : "Sign in"}
              loading={submitting === "password" || submitting === "signup"}
              disabled={!email.trim() || !password}
              onPress={() => void (isSignUp ? handleEmailSignUp() : handlePasswordSignIn())}
            />
            <GhostButton label="Back" onPress={() => { setScreen({ kind: "initial" }); setError(null); }} />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Initial Screen ──────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      <Header />
      <Text style={styles.headline}>Read stories.{"\n"}Learn languages.</Text>
      <Text style={styles.subtext}>
        Sign in to open your saved books, stories, and listening progress on iPhone.
      </Text>
      <View style={styles.actions}>
        <Pressable
          disabled={submitting !== null}
          onPress={() => void handleGoogleSignIn()}
          style={[styles.googleButton, submitting !== null && styles.buttonDisabled]}
        >
          {submitting === "google" ? (
            <ActivityIndicator color="#1a1a1a" />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          )}
        </Pressable>

        <Pressable
          disabled={submitting !== null}
          onPress={() => setScreen({ kind: "email-form", mode: "signIn" })}
          style={[styles.secondaryButton, submitting !== null && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryButtonText}>Sign in with email</Text>
        </Pressable>

        <Pressable
          disabled={submitting !== null}
          onPress={() => setScreen({ kind: "email-form", mode: "signUp" })}
          style={[styles.tertiaryButton, submitting !== null && styles.buttonDisabled]}
        >
          <Text style={styles.tertiaryButtonText}>Create account</Text>
        </Pressable>

        <GhostButton label="Browse without an account" onPress={onContinuePreview} />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Shared Components ──────────────────────────────────────────────────

function Header() {
  return (
    <View style={styles.brand}>
      <Text style={styles.brandMark}>◆</Text>
      <Text style={styles.brandName}>Digital Polyglot</Text>
    </View>
  );
}

function PrimaryButton(props: { label: string; loading: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={props.loading || props.disabled}
      onPress={props.onPress}
      style={[styles.primaryButton, (props.loading || props.disabled) && styles.buttonDisabled]}
    >
      {props.loading ? (
        <ActivityIndicator color="#0c1626" />
      ) : (
        <Text style={styles.primaryButtonText}>{props.label}</Text>
      )}
    </Pressable>
  );
}

function GhostButton(props: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={styles.ghostButton}>
      <Text style={styles.ghostButtonText}>{props.label}</Text>
    </Pressable>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 28, backgroundColor: "#0f1e33", borderWidth: 1, borderColor: "#1e3450", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 32, shadowOffset: { width: 0, height: 16 } },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 },
  brandMark: { color: "#f8c15c", fontSize: 11 },
  brandName: { color: "#f8c15c", fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  headline: { color: "#f5f7fb", fontSize: 36, fontWeight: "800", lineHeight: 42, marginBottom: 12 },
  subtext: { color: "#7a95b3", fontSize: 15, lineHeight: 22, marginBottom: 28 },
  actions: { gap: 10 },
  googleButton: { backgroundColor: "#ffffff", borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  googleButtonText: { color: "#1a1a1a", fontSize: 16, fontWeight: "700" },
  primaryButton: { backgroundColor: "#f8c15c", borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  primaryButtonText: { color: "#0c1626", fontSize: 16, fontWeight: "800" },
  secondaryButton: { borderRadius: 16, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "#27405f", backgroundColor: "#132238" },
  secondaryButtonText: { color: "#c8d8ee", fontSize: 15, fontWeight: "700" },
  tertiaryButton: { paddingVertical: 15, alignItems: "center" },
  tertiaryButtonText: { color: "#7a95b3", fontSize: 15, fontWeight: "600" },
  ghostButton: { paddingVertical: 12, alignItems: "center" },
  ghostButtonText: { color: "#4e6a8a", fontSize: 14, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  errorText: { color: "#ffb4ab", fontSize: 13, lineHeight: 18, marginTop: 12 },
  input: { backgroundColor: "#132238", borderRadius: 14, borderWidth: 1, borderColor: "#27405f", paddingHorizontal: 16, paddingVertical: 14, color: "#f5f7fb", fontSize: 16, marginBottom: 12 },
});
