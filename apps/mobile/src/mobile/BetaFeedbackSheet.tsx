// In-app feedback sheet for beta builds.
//
// Replaces the `mailto:` that used to sit behind the Support button. The
// difference that matters is not the transport: it is that this attaches the
// build number, the OS, the device and the screen on its own, so a tester's
// entire job is typing one sentence, and every report arrives already tied to
// the build it came from. That link is what lets a build note tell somebody,
// by name, that the thing they reported is fixed.

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { apiFetch } from "../lib/api";

type Kind = "bug" | "confusing" | "idea" | "praise";

const KINDS: Array<{ value: Kind; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { value: "bug", label: "Broke", icon: "alert-triangle" },
  { value: "confusing", label: "Confusing", icon: "help-circle" },
  { value: "idea", label: "Idea", icon: "zap" },
  { value: "praise", label: "Liked it", icon: "heart" },
];

const PLACEHOLDERS: Record<Kind, string> = {
  bug: "The audio started about a second late every time I opened a story.",
  confusing: "I could not tell which words were tappable until I tried them all.",
  idea: "I would love to save a word straight from the player.",
  praise: "The tap-to-translate is the reason I kept going.",
};

export type BetaFeedbackSheetProps = {
  visible: boolean;
  onClose: () => void;
  baseUrl: string;
  token: string | null;
  /** Screen the user was on when they opened this. Pure context, never typed. */
  screen?: string | null;
};

export default function BetaFeedbackSheet({
  visible,
  onClose,
  baseUrl,
  token,
  screen,
}: BetaFeedbackSheetProps) {
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read once per mount: none of this changes while the sheet is open, and
  // recomputing it on every keystroke would be pure waste.
  //
  // `expo-application` is the source of truth, not `Constants.expoConfig`.
  // expoConfig echoes app.json, and app.json has drifted from Info.plist in
  // this project before (commit dc9768ec exists precisely because Info.plist
  // was the third version source nobody was bumping). A report stamped with a
  // build number the tester is not actually running is worse than one with no
  // build number at all, because "fixed in build N" would then name the wrong
  // build. expoConfig stays only as a fallback for the simulator.
  const build = useMemo(() => {
    const expo = Constants.expoConfig;
    const expoConfigBuild =
      Platform.OS === "ios"
        ? expo?.ios?.buildNumber
        : expo?.android?.versionCode !== undefined
          ? String(expo.android.versionCode)
          : undefined;

    // expo-application is a native module, so it is only present once the
    // native project has been rebuilt with it linked. Reading it is wrapped
    // because a diagnostic field must never be the reason a tester cannot
    // file a report: if the module is missing we quietly fall back to the
    // app.json values rather than taking the whole sheet down.
    let nativeVersion: string | null = null;
    let nativeBuild: string | null = null;
    try {
      nativeVersion = Application.nativeApplicationVersion ?? null;
      nativeBuild = Application.nativeBuildVersion ?? null;
    } catch {
      // Not linked in this binary. Fallbacks below.
    }

    return {
      appVersion: nativeVersion ?? expo?.version ?? null,
      buildNumber: nativeBuild ?? expoConfigBuild ?? null,
      deviceModel: Device.modelName ?? null,
      osVersion: Device.osVersion ? `${Device.osName ?? Platform.OS} ${Device.osVersion}` : null,
    };
  }, []);

  function reset() {
    setMessage("");
    setKind("bug");
    setError(null);
    setSent(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (message.trim().length < 3) {
      setError("Write at least a few words.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiFetch({
        baseUrl,
        path: "/api/mobile/beta-feedback",
        token,
        method: "POST",
        body: {
          kind,
          message: message.trim(),
          screen: screen ?? null,
          platform: Platform.OS,
          ...build,
        },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {sent ? (
              <View style={styles.sentWrap}>
                <Feather name="check-circle" size={40} color="#5fd0a3" />
                <Text style={styles.sentTitle}>Got it. Thank you.</Text>
                <Text style={styles.sentBody}>
                  It goes straight to the person building the app. If it turns into a fix, you will get
                  an email naming it when that build ships.
                </Text>
                <Pressable onPress={close} style={[styles.submit, styles.submitDone]}>
                  <Text style={styles.submitText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>What happened?</Text>
                <Text style={styles.lead}>
                  One sentence is a complete answer. The build and your device are attached
                  automatically.
                </Text>

                <View style={styles.kinds}>
                  {KINDS.map((k) => {
                    const active = kind === k.value;
                    return (
                      <Pressable
                        key={k.value}
                        onPress={() => setKind(k.value)}
                        style={[styles.kind, active && styles.kindActive]}
                      >
                        <Feather name={k.icon} size={14} color={active ? "#2a1a02" : "#a8bcd8"} />
                        <Text style={[styles.kindText, active && styles.kindTextActive]}>{k.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={PLACEHOLDERS[kind]}
                  placeholderTextColor="#5c7796"
                  multiline
                  style={styles.input}
                  autoFocus
                />

                {build.buildNumber ? (
                  <Text style={styles.meta}>
                    Build {build.buildNumber}
                    {build.deviceModel ? ` · ${build.deviceModel}` : ""}
                    {screen ? ` · ${screen}` : ""}
                  </Text>
                ) : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  onPress={submit}
                  disabled={sending}
                  style={[styles.submit, sending && styles.submitDisabled]}
                >
                  {sending ? (
                    <ActivityIndicator color="#2a1a02" />
                  ) : (
                    <Text style={styles.submitText}>Send it</Text>
                  )}
                </Pressable>

                <Pressable onPress={close} style={styles.cancel}>
                  <Text style={styles.cancelText}>Not now</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(3,12,26,0.72)", justifyContent: "flex-end" },
  sheetWrap: { width: "100%" },
  sheet: {
    backgroundColor: "#07203f",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: "rgba(125,211,252,0.18)",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 16,
  },
  title: { color: "#eef4fc", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  lead: { color: "#a8bcd8", fontSize: 14, fontWeight: "600", lineHeight: 20, marginTop: 8 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  kind: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  kindActive: { backgroundColor: "#fcd34d" },
  kindText: { color: "#a8bcd8", fontSize: 13, fontWeight: "800" },
  kindTextActive: { color: "#2a1a02" },
  input: {
    marginTop: 16,
    minHeight: 110,
    borderRadius: 16,
    backgroundColor: "#051834",
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.16)",
    padding: 14,
    color: "#eef4fc",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    textAlignVertical: "top",
  },
  meta: { color: "#5c7796", fontSize: 11.5, fontWeight: "700", marginTop: 10 },
  error: { color: "#f87171", fontSize: 13, fontWeight: "700", marginTop: 10 },
  submit: {
    marginTop: 18,
    backgroundColor: "#fcd34d",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.7 },
  submitDone: { marginTop: 24, alignSelf: "stretch" },
  submitText: { color: "#2a1a02", fontSize: 16, fontWeight: "900" },
  cancel: { marginTop: 12, alignItems: "center", paddingVertical: 8 },
  cancelText: { color: "#8aa0be", fontSize: 14, fontWeight: "700" },
  sentWrap: { alignItems: "center", paddingVertical: 26, paddingHorizontal: 8 },
  sentTitle: { color: "#eef4fc", fontSize: 22, fontWeight: "900", marginTop: 14 },
  sentBody: {
    color: "#a8bcd8",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
  },
});
