import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio, InterruptionModeIOS } from "expo-av";
import {
  LEVEL_TEST_INITIAL_STATE,
  canReplay,
  cefrDisplayLabel,
  currentQuestion,
  currentStation,
  formatCefrDisplay,
  levelTestOutcome,
  levelTestSessionReducer,
  questionsVisible,
  type LevelTestOutcome,
  type LevelTestPayload,
  type LevelTestStation,
} from "@digital-polyglot/domain";
import { apiFetch } from "../lib/api";
import { mobileConfig } from "../config";
import { LanguageFlag } from "./LanguageFlag";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";

/**
 * The listening level test (2026-09-20). Replaces the grammar quiz for
 * the languages that have it (`hasListeningLevelTest`): the learner
 * climbs a ladder of STATIONS, one per level, each a clip of real story
 * audio followed by a comprehension question and a vocabulary question
 * from that same story. Both right = the rung is passed; two failures in
 * a row end the test. Every decision (what shows when, what a tap does,
 * the result) lives in `levelTestSessionReducer` in
 * `@digital-polyglot/domain`, unit-tested there; this file only plays
 * the audio and renders the state.
 *
 * Same contract as `LevelTestRunner` so the two call sites (onboarding
 * and the locked-story path) do not care which runner they got:
 *   - onboarding: `level` is one rung BELOW what was demonstrated.
 *   - locked story: `level` is what was demonstrated; there the test
 *     unlocks a level, it does not place the whole journey.
 *
 * Clips are fetched from `/api/mobile/level-test`, not bundled, so a
 * station can be swapped without a build. No answer is revealed during
 * the test: it is a placement, not a lesson.
 */

export const LISTENING_LEVEL_TEST_LANGUAGES = new Set(["Spanish"]);

export function hasListeningLevelTest(language: string | null | undefined): boolean {
  return Boolean(language && LISTENING_LEVEL_TEST_LANGUAGES.has(language));
}

export type ListeningLevelTestResult = LevelTestOutcome;

type Props = {
  open: boolean;
  language: string;
  variant?: string | null;
  source: "onboarding" | "locked-story";
  onComplete: (result: ListeningLevelTestResult) => void;
  onCancel: () => void;
};

const PANEL_TRAVEL = 1100;

export function ListeningLevelTest({ open, language, variant, source, onComplete, onCancel }: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(PANEL_TRAVEL)).current;
  const [mounted, setMounted] = useState(open);

  const [state, dispatch] = useReducer(levelTestSessionReducer, LEVEL_TEST_INITIAL_STATE);
  const { phase, stations, stationIndex, audio: audioState, replaysLeft, questionIndex, selected, skipped } = state;
  const station = currentStation(state);
  const question = currentQuestion(state);
  const outcome = levelTestOutcome(state, source);

  const soundRef = useRef<Audio.Sound | null>(null);
  const playRunRef = useRef(0);

  const stopAudio = useCallback(async () => {
    playRunRef.current += 1;
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      try {
        await sound.stopAsync();
      } catch {}
      try {
        await sound.unloadAsync();
      } catch {}
    }
  }, []);

  // Fetch the test every time the runner opens; reset everything.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    dispatch({ type: "reset" });
    (async () => {
      try {
        const query = new URLSearchParams({ language, ...(variant ? { variant } : {}) });
        const data = await apiFetch<LevelTestPayload>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: `/api/mobile/level-test?${query.toString()}`,
          timeoutMs: 15000,
        });
        if (cancelled) return;
        dispatch({ type: "loaded", payload: data });
      } catch (err) {
        console.warn("[level-test] could not load", err);
        if (!cancelled) dispatch({ type: "loadFailed" });
      }
    })();
    return () => {
      cancelled = true;
      void stopAudio();
    };
  }, [open, language, variant, stopAudio]);

  // Slide-up animation, same pattern as LevelTestRunner.
  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 28,
          stiffness: 240,
          mass: 0.95,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: PANEL_TRAVEL,
          duration: 240,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, mounted, backdrop, translateY]);

  /**
   * Play the station's clips one after the other. Each paragraph has its
   * own mp3, so this is a small chain rather than one seek. A run id
   * guards against a replay or a cancel racing an earlier chain.
   */
  const playStation = useCallback(
    async (target: LevelTestStation) => {
      await stopAudio();
      const run = playRunRef.current;
      dispatch({ type: "audioStarted" });
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          staysActiveInBackground: false,
        });
        for (const clip of target.clips) {
          if (playRunRef.current !== run) return;
          const { sound } = await Audio.Sound.createAsync({ uri: clip.url }, { shouldPlay: true });
          soundRef.current = sound;
          await new Promise<void>((resolve, reject) => {
            sound.setOnPlaybackStatusUpdate((status) => {
              if (!status.isLoaded) {
                if ("error" in status && status.error) reject(new Error(status.error));
                return;
              }
              if (status.didJustFinish) resolve();
            });
          });
          if (playRunRef.current !== run) return;
          soundRef.current = null;
          await sound.unloadAsync();
        }
        if (playRunRef.current === run) dispatch({ type: "audioDone" });
      } catch (err) {
        console.warn("[level-test] clip failed", err);
        if (playRunRef.current === run) dispatch({ type: "audioFailed" });
      }
    },
    [stopAudio]
  );

  // Auto-play when a station comes on screen (audio is "idle" only then).
  useEffect(() => {
    if (phase !== "station" || !station || audioState !== "idle") return;
    void playStation(station);
  }, [phase, station, audioState, playStation]);

  useEffect(() => {
    return () => {
      void stopAudio();
    };
  }, [stopAudio]);

  if (!mounted) return null;

  function startTest() {
    dispatch({ type: "start" });
  }

  function replay() {
    if (!station || !canReplay(state)) return;
    dispatch({ type: "replay" });
    void playStation(station);
  }

  function submitAnswer() {
    const wasLastQuestion = questionIndex === 1;
    dispatch({ type: "submit" });
    if (wasLastQuestion) void stopAudio();
  }

  function skipAsBrandNew() {
    void stopAudio();
    dispatch({ type: "skipBrandNew" });
  }

  function claimResult() {
    onComplete(outcome);
  }

  function handleCancel() {
    void stopAudio();
    onCancel();
  }

  const progressPct =
    stations.length === 0
      ? 0
      : Math.round(((stationIndex + (questionIndex === 1 ? 0.5 : 0)) / stations.length) * 100);
  const minutes = Math.max(2, Math.ceil(stations.length * 0.6));

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <Animated.View pointerEvents={open ? "auto" : "none"} style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Pressable onPress={handleCancel} hitSlop={12} style={styles.headerIcon}>
            <Feather name="x" size={20} color="#f5f7fb" />
          </Pressable>
          <View pointerEvents="none" style={styles.headerCenterAbsolute}>
            <LanguageFlag language={language} variant={variant} size={26} />
            <Text style={styles.headerTitle}>Level test</Text>
          </View>
        </View>

        {phase === "station" ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        ) : null}

        {phase === "loading" ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={tokenColor.cyan} />
            <Text style={styles.centerBody}>Getting your clips ready…</Text>
          </View>
        ) : null}

        {phase === "error" ? (
          <View style={styles.centerBlock}>
            <Feather name="wifi-off" size={32} color={tokenColor.cyan} />
            <Text style={styles.centerTitle}>Can&apos;t load the test</Text>
            <Text style={styles.centerBody}>
              Check your connection and try again. You can also start from the
              beginning and change level later from your journeys.
            </Text>
          </View>
        ) : null}

        {phase === "intro" ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>LISTEN AND ANSWER</Text>
            <Text style={styles.introTitle}>Short clips from real stories</Text>
            <Text style={styles.introBody}>
              You&apos;ll hear {stations.length} clips, each a little harder than
              the last, and answer two quick questions about each one. About{" "}
              {minutes} minutes.
            </Text>
            <View style={styles.tipCard}>
              <Feather name="headphones" size={16} color={tokenColor.cyan} />
              <Text style={styles.tipText}>
                Each clip plays once, and you can replay it one time. Don&apos;t
                worry about catching every word.
              </Text>
            </View>
          </ScrollView>
        ) : null}

        {phase === "station" && station && question ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>
              CLIP {stationIndex + 1} OF {stations.length}
            </Text>

            <View style={styles.clipCard}>
              <View style={styles.clipIcon}>
                {audioState === "playing" ? (
                  <ActivityIndicator color={tokenBg[1]} />
                ) : (
                  <Feather
                    name={audioState === "failed" ? "alert-circle" : "volume-2"}
                    size={22}
                    color={tokenBg[1]}
                  />
                )}
              </View>
              <View style={styles.clipText}>
                <Text style={styles.clipTitle}>
                  {audioState === "playing"
                    ? "Listening…"
                    : audioState === "failed"
                      ? "The clip didn't play"
                      : audioState === "done"
                        ? "Clip finished"
                        : "Starting…"}
                </Text>
                <Text style={styles.clipHint}>
                  {audioState === "failed"
                    ? "Try the replay, or answer from what you heard."
                    : `From "${station.story.title}"`}
                </Text>
              </View>
              <Pressable
                onPress={replay}
                disabled={!canReplay(state)}
                hitSlop={8}
                style={[styles.replayButton, !canReplay(state) ? styles.replayButtonDisabled : null]}
              >
                <Feather name="rotate-ccw" size={16} color="#ffffff" />
                <Text style={styles.replayText}>{replaysLeft > 0 ? "Replay" : "Used"}</Text>
              </Pressable>
            </View>

            {questionsVisible(state) ? (
              <>
                <Text style={styles.questionPrompt}>
                  {questionIndex === 0 ? "What happened?" : "One word from the clip"}
                </Text>
                <Text style={styles.questionText}>{question.question}</Text>
                <View style={styles.options}>
                  {question.options.map((option, index) => {
                    const isSelected = selected === index;
                    return (
                      <Pressable
                        key={`${station.id}-${questionIndex}-${index}`}
                        onPress={() => dispatch({ type: "select", index })}
                        style={[styles.option, isSelected ? styles.optionSelected : null]}
                      >
                        <Text style={styles.optionText}>{option}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.waitingHint}>The questions appear when the clip ends.</Text>
            )}
          </ScrollView>
        ) : null}

        {phase === "result" ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {(() => {
              const levelCode = outcome.level;
              const levelName = cefrDisplayLabel(levelCode) ?? levelCode;
              const levelDisplay = formatCefrDisplay(levelCode);
              return (
                <View style={styles.resultBlock}>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultBadgeText}>{levelName}</Text>
                  </View>
                  <Text style={styles.resultTitle}>
                    {source === "onboarding" ? `We think you're at ${levelDisplay}` : `You're at ${levelDisplay}`}
                  </Text>
                  {!skipped ? (
                    <Text style={styles.resultBody}>
                      {outcome.correct} of {outcome.total} answers right.
                    </Text>
                  ) : null}
                  <Text style={styles.resultDescription}>
                    {source === "onboarding"
                      ? `Your ${language} journey starts here. Too easy or too hard? You can add another level anytime from your journeys.`
                      : `${levelName} stories are unlocked. Pick up where you wanted to go; earlier levels stay available too.`}
                  </Text>
                </View>
              );
            })()}
          </ScrollView>
        ) : null}

        <View style={styles.footer}>
          {phase === "intro" ? (
            <>
              <Pressable onPress={startTest} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Start listening</Text>
                <Feather name="arrow-right" size={18} color={tokenBg[1]} />
              </Pressable>
              {source === "onboarding" ? (
                <Pressable onPress={skipAsBrandNew} hitSlop={8} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>I&apos;m brand new to {language}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {phase === "error" ? (
            <>
              {source === "onboarding" ? (
                <Pressable onPress={skipAsBrandNew} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Start from the beginning</Text>
                  <Feather name="arrow-right" size={18} color={tokenBg[1]} />
                </Pressable>
              ) : null}
              <Pressable onPress={handleCancel} hitSlop={8} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
            </>
          ) : null}

          {phase === "station" ? (
            <Pressable
              onPress={submitAnswer}
              disabled={selected === null}
              style={[styles.primaryButton, selected === null ? styles.primaryButtonDisabled : null]}
            >
              <Text style={styles.primaryButtonText}>{questionIndex === 0 ? "Next" : "Continue"}</Text>
              <Feather name="arrow-right" size={18} color={tokenBg[1]} />
            </Pressable>
          ) : null}

          {phase === "result" ? (
            <Pressable onPress={claimResult} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {source === "onboarding" ? "Start journey" : "Unlock level"}
              </Text>
              <Feather name="arrow-right" size={18} color={tokenBg[1]} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 95,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 24, 52, 0.7)",
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#0c1626",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerCenterAbsolute: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  progressTrack: {
    marginHorizontal: 18,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: tokenColor.xp,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 14,
  },
  centerBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  centerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  centerBody: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  eyebrow: {
    color: tokenColor.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  introTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  introBody: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
    lineHeight: 22,
  },
  tipCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginTop: 4,
  },
  tipText: {
    flex: 1,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 18,
  },
  clipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "rgba(7,18,31,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  clipIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokenColor.xp,
  },
  clipText: {
    flex: 1,
    gap: 2,
  },
  clipTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  clipHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  replayButtonDisabled: {
    opacity: 0.35,
  },
  replayText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  waitingHint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
  questionPrompt: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6,
  },
  questionText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  options: {
    gap: 8,
    marginTop: 6,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  optionSelected: {
    borderColor: tokenColor.cyan,
    backgroundColor: "rgba(125, 211, 252, 0.1)",
  },
  optionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  resultBlock: {
    alignItems: "center",
    gap: 12,
    paddingTop: 32,
  },
  resultBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokenColor.xp,
  },
  resultBadgeText: {
    color: tokenBg[1],
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  resultTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 8,
    textAlign: "center",
  },
  resultBody: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "700",
  },
  resultDescription: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: tokenColor.xp,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: tokenBg[1],
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "700",
  },
});
