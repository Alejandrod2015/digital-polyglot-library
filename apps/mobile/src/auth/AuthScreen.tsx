import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { useClerk, useSignIn, useSignUp, useSSO } from "@clerk/expo";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

// The Clerk "future" API returns errors instead of throwing them.
function clerkErrorMessage(error: { message?: string; longMessage?: string } | null | undefined): string {
  return error?.longMessage || error?.message || "Something went wrong. Please try again.";
}

// Clerk's SDK imposes no deadline of its own, so a stalled request leaves the
// user on a spinner with no error and no way out: on 2026-07-30 a sign-in sat
// for 2 minutes 47 seconds before iOS, not the app, gave up on the connection.
// The app's own API layer already bounds every call at 10s (src/lib/api.ts);
// this brings the auth path in line with it.
//
// 20s rather than 10s because these calls can legitimately be slower than a
// normal request (password verification, sending an email), and a false
// timeout on a working sign-in is worse than a slightly long wait.
const AUTH_TIMEOUT_MS = 20_000;

class AuthTimeoutError extends Error {
  constructor() {
    super("The connection timed out. Check your internet connection and try again.");
    this.name = "AuthTimeoutError";
  }
}

/**
 * Stops the UI waiting on a Clerk call that never settles.
 *
 * This does NOT abort the underlying request: Clerk's SDK exposes no abort
 * handle, so the socket may still be open when this rejects. That is fine for
 * the purpose here, which is to give the user an error and a retry instead of
 * an endless spinner. A late response is simply ignored.
 *
 * OAuth is deliberately NOT wrapped: that flow hands off to a browser where
 * the user may legitimately take minutes to type a password.
 */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[auth] ${label} timed out after ${AUTH_TIMEOUT_MS}ms`);
      reject(new AuthTimeoutError());
    }, AUTH_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
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
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");

  const { setActive } = useClerk();
  const { startSSOFlow } = useSSO();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  // ── Social OAuth ────────────────────────────────────────────────────
  const handleSocialSignIn = useCallback(async (strategy: "oauth_google" | "oauth_facebook") => {
    setError(null);
    setSubmitting(strategy);
    try {
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy,
        redirectUrl: "digitalpolyglot://oauth-callback",
      });
      if (createdSessionId) {
        const activate = ssoSetActive || setActive;
        await activate({ session: createdSessionId });
        onClerkSessionCreated();
      }
    } catch (err) {
      console.error(`[auth] ${strategy} sign-in error:`, err);
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  }, [startSSOFlow, setActive, onClerkSessionCreated]);

  // ── Email + Password Sign In ────────────────────────────────────────
  const handlePasswordSignIn = useCallback(async () => {
    if (!signIn) return;
    setError(null);
    setSubmitting("password");
    try {
      const { error: passwordError } = await withTimeout(
        signIn.password({ identifier: email.trim(), password }),
        "password sign-in",
      );

      if (signIn.status === "complete") {
        const { error: finalizeError } = await withTimeout(signIn.finalize(), "finalize sign-in");
        if (finalizeError) {
          setError(clerkErrorMessage(finalizeError));
          return;
        }
        onClerkSessionCreated();
        return;
      }

      // Account exists but has no password (e.g. created via OAuth): fall back
      // to an email verification code as the first factor.
      const emailCodeSupported = signIn.supportedFirstFactors?.some(
        (f) => f.strategy === "email_code"
      );
      if (signIn.status === "needs_first_factor" && emailCodeSupported) {
        const { error: sendError } = await withTimeout(signIn.emailCode.sendCode(), "send email code");
        if (sendError) {
          setError(clerkErrorMessage(sendError));
          return;
        }
        setScreen({ kind: "verify-code", email: email.trim(), mode: "signIn" });
        return;
      }

      setError(passwordError ? clerkErrorMessage(passwordError) : "Unable to sign in with these credentials.");
    } catch (err) {
      console.error("[auth] Password sign-in error:", err);
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  }, [signIn, email, password, onClerkSessionCreated]);

  // ── Email Sign Up ───────────────────────────────────────────────────
  const handleEmailSignUp = useCallback(async () => {
    if (!signUp) return;
    setError(null);
    setSubmitting("signup");
    try {
      const { error: createError } = await withTimeout(
        signUp.create({ emailAddress: email.trim(), password }),
        "sign-up",
      );
      if (createError) {
        // Email already registered → don't dead-end with "try another";
        // flip to sign-in with the email kept so they can recover.
        const alreadyExists =
          createError.code === "form_identifier_exists" ||
          /taken|already.*exist|already.*registered/i.test(createError.message ?? "");
        if (alreadyExists) {
          setScreen({ kind: "email-form", mode: "signIn" });
          setError("You already have an account with this email. Enter your password to sign in.");
          return;
        }
        setError(clerkErrorMessage(createError));
        return;
      }
      const { error: sendError } = await withTimeout(signUp.verifications.sendEmailCode(), "send sign-up code");
      if (sendError) {
        setError(clerkErrorMessage(sendError));
        return;
      }
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
        const { error: verifyError } = await withTimeout(signIn.emailCode.verifyCode({ code: code.trim() }), "verify sign-in code");
        if (verifyError) {
          setError(clerkErrorMessage(verifyError));
          return;
        }
        if (signIn.status === "complete") {
          const { error: finalizeError } = await withTimeout(signIn.finalize(), "finalize sign-in");
          if (finalizeError) {
            setError(clerkErrorMessage(finalizeError));
            return;
          }
          onClerkSessionCreated();
        } else {
          setError("Verification incomplete.");
        }
      } else if (screen.mode === "signUp" && signUp) {
        const { error: verifyError } = await withTimeout(signUp.verifications.verifyEmailCode({ code: code.trim() }), "verify sign-up code");
        if (verifyError) {
          setError(clerkErrorMessage(verifyError));
          return;
        }
        if (signUp.status === "complete") {
          const { error: finalizeError } = await withTimeout(signUp.finalize(), "finalize sign-up");
          if (finalizeError) {
            setError(clerkErrorMessage(finalizeError));
            return;
          }
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
  }, [screen, signIn, signUp, code, onClerkSessionCreated]);

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
            autoComplete="email"
            textContentType="emailAddress"
            autoFocus
          />
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#4e6a8a"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              textContentType={isSignUp ? "newPassword" : "password"}
              returnKeyType="go"
              onSubmitEditing={() => {
                if (email.trim() && password) {
                  void (screen.kind === "email-form" && screen.mode === "signUp" ? handleEmailSignUp() : handlePasswordSignIn());
                }
              }}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={10}
              style={styles.passwordToggle}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#7a95b3" />
            </Pressable>
          </View>
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
      <Text style={styles.headline}>Speak the{"\n"}real language.</Text>
      <Text style={styles.subtext}>
        Sign in to keep your saved words, stories, and listening progress on all your devices.
      </Text>
      <View style={styles.actions}>
        <View style={styles.socialRow}>
          <Pressable
            disabled={submitting !== null}
            onPress={() => void handleSocialSignIn("oauth_google")}
            style={[styles.socialButton, submitting !== null && styles.buttonDisabled]}
          >
            {submitting === "oauth_google" ? (
              <ActivityIndicator color="#1a1a1a" size="small" />
            ) : (
              <>
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialButtonText}>Google</Text>
              </>
            )}
          </Pressable>

          <Pressable
            disabled={submitting !== null}
            onPress={() => void handleSocialSignIn("oauth_facebook")}
            style={[styles.socialButton, styles.facebookButton, submitting !== null && styles.buttonDisabled]}
          >
            {submitting === "oauth_facebook" ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.facebookIcon}>f</Text>
                <Text style={styles.facebookButtonText}>Facebook</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

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
  // El logotipo de verdad, centrado, en lugar del rombo con el nombre en
  // versalitas. Es la versión blanca, la misma del splash: así la marca que
  // ves al abrir la app es la que sigue ahí al entrar, y sobre el fondo
  // oscuro de esta tarjeta se lee, cosa que la versión a color no haría.
  return (
    <Image
      source={require("../../assets/splash-logo-white.png")}
      style={styles.brandLogo}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Digital Polyglot"
    />
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
  // 904×437 en origen: con 196 de ancho el alto sale ~95, y `contain` respeta
  // la proporción aunque se cambie una de las dos.
  brandLogo: { width: 196, height: 95, alignSelf: "center", marginBottom: 24 },
  headline: { color: "#f5f7fb", fontSize: 36, fontWeight: "800", lineHeight: 42, marginBottom: 12 },
  subtext: { color: "#7a95b3", fontSize: 15, lineHeight: 22, marginBottom: 28 },
  actions: { gap: 10 },
  socialRow: { flexDirection: "row", gap: 10 },
  socialButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#ffffff", borderRadius: 16, paddingVertical: 14 },
  socialIcon: { color: "#4285F4", fontSize: 20, fontWeight: "700", fontFamily: "System" },
  socialButtonText: { color: "#1a1a1a", fontSize: 15, fontWeight: "700" },
  facebookButton: { backgroundColor: "#1877F2" },
  facebookIcon: { color: "#ffffff", fontSize: 20, fontWeight: "800", fontFamily: "System" },
  facebookButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1e3450" },
  dividerText: { color: "#4e6a8a", fontSize: 13, fontWeight: "600" },
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
  passwordRow: { position: "relative", justifyContent: "center", marginBottom: 12 },
  passwordInput: { backgroundColor: "#132238", borderRadius: 14, borderWidth: 1, borderColor: "#27405f", paddingLeft: 16, paddingRight: 52, paddingVertical: 14, color: "#f5f7fb", fontSize: 16 },
  passwordToggle: { position: "absolute", right: 8, top: 0, bottom: 0, width: 44, alignItems: "center", justifyContent: "center" },
});
