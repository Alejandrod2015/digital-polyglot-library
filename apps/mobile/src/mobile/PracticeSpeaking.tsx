import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio, InterruptionModeIOS } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { apiFetch } from "../lib/api";

/**
 * PracticeSpeaking; "Speak with AI", Polyglot-only.
 *
 * Single-turn spoken practice: the AI asks one short question in the
 * target language, the learner answers out loud, Whisper transcribes it
 * and the AI replies with a short follow-up + one English feedback tip.
 * No conversation loop, no local STT; everything heavy runs server-side
 * at POST /api/mobile/speaking. The mic clip is read as base64 and sent
 * in the JSON body so it reuses the existing apiFetch wrapper.
 */

type Phase = "loading_question" | "ready" | "recording" | "thinking" | "result" | "error";

export type PracticeSpeakingProps = {
  baseUrl: string;
  token: string | null;
  language: string;
  level: string;
  onClose: () => void;
};

type PromptResponse = { question?: string; error?: string };
type ReplyResponse = { transcript?: string; reply?: string; feedback?: string; error?: string };

async function setRecordingAudioMode(recording: boolean): Promise<void> {
  // Recording needs allowsRecordingIOS:true; we flip it back to false
  // afterwards so the normal playback path (which always sets false)
  // isn't left in a recording-biased route that quiets playback.
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: recording,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  });
}

export function PracticeSpeaking({ baseUrl, token, language, level, onClose }: PracticeSpeakingProps) {
  const [phase, setPhase] = useState<Phase>("loading_question");
  const [question, setQuestion] = useState("");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [feedback, setFeedback] = useState("");
  const [errorText, setErrorText] = useState("");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Best-effort teardown if the user leaves mid-recording.
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
        setRecordingAudioMode(false).catch(() => {});
      }
    };
  }, []);

  const loadQuestion = useCallback(async () => {
    setPhase("loading_question");
    setErrorText("");
    setTranscript("");
    setReply("");
    setFeedback("");
    try {
      const res = await apiFetch<PromptResponse>({
        baseUrl,
        path: "/api/mobile/speaking",
        token,
        method: "POST",
        timeoutMs: 30000,
        body: { action: "prompt", language, level },
      });
      if (!mountedRef.current) return;
      if (!res.question) throw new Error(res.error || "No question returned.");
      setQuestion(res.question);
      setPhase("ready");
    } catch (err) {
      if (!mountedRef.current) return;
      setErrorText(err instanceof Error ? err.message : "Could not load a question.");
      setPhase("error");
    }
  }, [baseUrl, token, language, level]);

  useEffect(() => {
    void loadQuestion();
  }, [loadQuestion]);

  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setErrorText("Microphone access is needed to practice speaking. Enable it in Settings.");
        setPhase("error");
        return;
      }
      await setRecordingAudioMode(true);
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      if (mountedRef.current) setPhase("recording");
    } catch {
      await setRecordingAudioMode(false).catch(() => {});
      if (mountedRef.current) {
        setErrorText("Couldn't start recording. Try again.");
        setPhase("error");
      }
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;
    setPhase("thinking");
    try {
      await recording.stopAndUnloadAsync();
      await setRecordingAudioMode(false);
      const uri = recording.getURI();
      if (!uri) throw new Error("No recording produced.");

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

      const res = await apiFetch<ReplyResponse>({
        baseUrl,
        path: "/api/mobile/speaking",
        token,
        method: "POST",
        timeoutMs: 45000,
        body: { action: "reply", language, level, question, audioBase64, mimeType: "audio/m4a" },
      });
      if (!mountedRef.current) return;
      setTranscript(res.transcript || "");
      setReply(res.reply || "");
      setFeedback(res.feedback || "");
      setPhase("result");
    } catch (err) {
      await setRecordingAudioMode(false).catch(() => {});
      if (!mountedRef.current) return;
      setErrorText(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPhase("error");
    }
  }, [baseUrl, token, language, level, question]);

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close speaking practice"
          testID="qa-speaking-close"
          style={styles.closeBtn}
        >
          <Feather name="x" size={22} color="#cdd9ec" />
        </Pressable>
        <Text style={styles.headerTitle}>Speak with AI</Text>
        <View style={styles.closeBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.questionCard}>
          <Text style={styles.cardLabel}>QUESTION</Text>
          {phase === "loading_question" ? (
            <ActivityIndicator color="#f8c15c" style={{ marginTop: 12 }} />
          ) : (
            <Text style={styles.questionText}>{question}</Text>
          )}
        </View>

        {phase === "result" ? (
          <>
            <View style={styles.answerCard}>
              <Text style={styles.cardLabel}>YOU SAID</Text>
              <Text style={styles.answerText}>
                {transcript || "I couldn't make out what you said."}
              </Text>
            </View>
            {reply ? (
              <View style={styles.replyCard}>
                <Text style={styles.cardLabel}>AI</Text>
                <Text style={styles.replyText}>{reply}</Text>
              </View>
            ) : null}
            {feedback ? (
              <View style={styles.feedbackCard}>
                <Feather name="message-circle" size={14} color="#86efac" />
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {phase === "error" ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {phase === "ready" ? (
          <Pressable
            onPress={() => void startRecording()}
            accessibilityRole="button"
            accessibilityLabel="Start recording your answer"
            testID="qa-speaking-record"
            style={({ pressed }) => [styles.micButton, pressed ? styles.btnPressed : null]}
          >
            <Feather name="mic" size={26} color="#0e1727" />
            <Text style={styles.micButtonLabel}>HOLD TO SPEAK · TAP TO START</Text>
          </Pressable>
        ) : null}

        {phase === "recording" ? (
          <Pressable
            onPress={() => void stopRecording()}
            accessibilityRole="button"
            accessibilityLabel="Stop recording and send"
            testID="qa-speaking-stop"
            style={({ pressed }) => [styles.stopButton, pressed ? styles.btnPressed : null]}
          >
            <Feather name="square" size={22} color="#ffffff" />
            <Text style={styles.stopButtonLabel}>STOP & SEND</Text>
          </Pressable>
        ) : null}

        {phase === "thinking" ? (
          <View style={styles.thinkingRow}>
            <ActivityIndicator color="#f8c15c" />
            <Text style={styles.thinkingText}>Listening…</Text>
          </View>
        ) : null}

        {phase === "result" ? (
          <Pressable
            onPress={() => void loadQuestion()}
            accessibilityRole="button"
            accessibilityLabel="Next question"
            testID="qa-speaking-next"
            style={({ pressed }) => [styles.nextButton, pressed ? styles.btnPressed : null]}
          >
            <Feather name="arrow-right" size={20} color="#0e1727" />
            <Text style={styles.nextButtonLabel}>NEXT QUESTION</Text>
          </Pressable>
        ) : null}

        {phase === "error" ? (
          <Pressable
            onPress={() => void loadQuestion()}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            testID="qa-speaking-retry"
            style={({ pressed }) => [styles.nextButton, pressed ? styles.btnPressed : null]}
          >
            <Feather name="refresh-cw" size={18} color="#0e1727" />
            <Text style={styles.nextButtonLabel}>TRY AGAIN</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 20, paddingTop: 6 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: { color: "#ffffff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  body: { paddingBottom: 16, gap: 14 },
  questionCard: {
    backgroundColor: "#152844",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2d476b",
  },
  cardLabel: {
    color: "#9cb0c9",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  questionText: { color: "#ffffff", fontSize: 19, fontWeight: "800", lineHeight: 26 },
  answerCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  answerText: { color: "#e8eefb", fontSize: 16, fontWeight: "600", lineHeight: 22 },
  replyCard: {
    backgroundColor: "rgba(125,211,252,0.10)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.30)",
  },
  replyText: { color: "#ffffff", fontSize: 17, fontWeight: "700", lineHeight: 24 },
  feedbackCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(134,239,172,0.10)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.28)",
  },
  feedbackText: { flex: 1, color: "#d7f5e3", fontSize: 14, fontWeight: "600", lineHeight: 20 },
  errorCard: {
    backgroundColor: "rgba(255,95,95,0.10)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,95,95,0.28)",
  },
  errorText: { color: "#ffd2d2", fontSize: 14, fontWeight: "600", lineHeight: 20 },
  footer: { paddingVertical: 16 },
  micButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f8c15c",
    borderRadius: 999,
    paddingVertical: 16,
  },
  micButtonLabel: { color: "#0e1727", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#ef4444",
    borderRadius: 999,
    paddingVertical: 16,
  },
  stopButtonLabel: { color: "#ffffff", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  thinkingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  thinkingText: { color: "#cdd9ec", fontSize: 14, fontWeight: "700" },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f8c15c",
    borderRadius: 999,
    paddingVertical: 16,
  },
  nextButtonLabel: { color: "#0e1727", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
