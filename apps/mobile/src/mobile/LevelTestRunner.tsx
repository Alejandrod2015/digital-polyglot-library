import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LanguageFlag } from "./LanguageFlag";
import {
  type CEFRLevel,
  type LevelTestQuestion,
  getLevelTestQuestions,
  levelFromScore,
} from "./levelTest";
import { cefrDisplayLabel, formatCefrDisplay } from "@digital-polyglot/domain";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";

/**
 * Full-screen overlay that runs the 10-question level test for a
 * given language. Self-contained: handles its own scoring, animation,
 * and result screen. Calls back when the user finishes (with the
 * computed CEFR level) or cancels.
 *
 * The runner is opened from two places:
 *   - Onboarding step 3 — after the user picks their self-reported
 *     level, we offer the test as a more accurate alternative.
 *   - Locked-story tap — when the user tries to open a story above
 *     their current level.
 *
 * Both call sites pass the same `language` (and optional `variant`)
 * so the runner picks the right question set.
 */

type Props = {
  open: boolean;
  language: string;
  variant?: string | null;
  /** Where the test was launched from. Affects copy on the result
   *  screen ("Start your journey" vs "Unlock this level"). */
  source: "onboarding" | "locked-story";
  /** Called when the user finishes the test. The runner closes
   *  itself first; the parent decides what to do with the result
   *  (update preferredLevel, mark levels accessible, etc.). */
  onComplete: (result: { level: CEFRLevel; correct: number; total: number }) => void;
  /** Called when the user dismisses the test before finishing. */
  onCancel: () => void;
};

const PANEL_TRAVEL = 1100;

export function LevelTestRunner({
  open,
  language,
  variant,
  source,
  onComplete,
  onCancel,
}: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(PANEL_TRAVEL)).current;
  const [mounted, setMounted] = useState(open);

  // Test state
  const questions = useMemo(() => getLevelTestQuestions(language, variant) ?? [], [language, variant]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const currentQuestion: LevelTestQuestion | undefined = questions[questionIndex];

  // Shufflear las opciones por pregunta. Sin esto, las 30 preguntas del
  // banco tienen `answer === options[0]`, así que un usuario que toque
  // siempre el primer botón obtiene 10/10 sin leer una sola pregunta.
  // El shuffle se recalcula al cambiar de pregunta para que cada round
  // reordene fresco; la validación sigue siendo por string-match contra
  // `currentQuestion.answer`, así que el shuffle es invisible al resto.
  const shuffledOptions = useMemo<readonly string[]>(() => {
    if (!currentQuestion) return [];
    const copy = [...currentQuestion.options];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [currentQuestion]);

  // Reset state every time the runner opens.
  useEffect(() => {
    if (open) {
      setQuestionIndex(0);
      setSelectedOption(null);
      setRevealed(false);
      setScore(0);
      setFinished(false);
    }
  }, [open]);

  // Slide-up animation, same pattern as JourneysPanel / LegalSheet.
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
      ]).start(({ finished: animDone }) => {
        if (animDone) setMounted(false);
      });
    }
  }, [open, mounted, backdrop, translateY]);

  if (!mounted) return null;

  function handleSelect(option: string) {
    if (revealed) return;
    setSelectedOption(option);
  }

  function handleCheck() {
    if (!currentQuestion || !selectedOption) return;
    setRevealed(true);
    if (selectedOption === currentQuestion.answer) {
      setScore((prev) => prev + 1);
    }
  }

  function handleNext() {
    if (!currentQuestion) return;
    if (questionIndex >= questions.length - 1) {
      setFinished(true);
      return;
    }
    setQuestionIndex((idx) => idx + 1);
    setSelectedOption(null);
    setRevealed(false);
  }

  function handleClaimResult() {
    const level = levelFromScore(score);
    onComplete({ level, correct: score, total: questions.length });
  }

  // No content authored for this language → render an apologetic
  // empty state so the runner doesn't show 0/0 progress.
  if (questions.length === 0) {
    return (
      <View style={styles.fill} pointerEvents="box-none">
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[styles.backdrop, { opacity: backdrop }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        </Animated.View>
        <Animated.View
          style={[styles.panel, { transform: [{ translateY }] }]}
        >
          <View style={styles.header}>
            <Pressable onPress={onCancel} hitSlop={12} style={styles.headerIcon}>
              <Feather name="x" size={20} color="#f5f7fb" />
            </Pressable>
            <View pointerEvents="none" style={styles.headerCenterAbsolute}>
              <Text style={styles.headerTitle}>Level test</Text>
            </View>
          </View>
          <View style={styles.emptyBlock}>
            <Feather name="clock" size={32} color={tokenColor.cyan} />
            <Text style={styles.emptyTitle}>Coming soon</Text>
            <Text style={styles.emptyBody}>
              The level test for {language} isn&apos;t available yet. Pick a
              starting level on the previous step for now.
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  const progressPct = Math.round(((questionIndex + (revealed ? 1 : 0)) / questions.length) * 100);

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdrop }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      </Animated.View>

      <Animated.View
        style={[styles.panel, { transform: [{ translateY }] }]}
      >
        {/* Header: close + flag + title + (optional) progress */}
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12} style={styles.headerIcon}>
            <Feather name="x" size={20} color="#f5f7fb" />
          </Pressable>
          {/* Title is absolutely-centered relative to the screen so
              we don't need a dummy placeholder on the right just to
              balance the close button — that produced a confusing
              empty circle in the earlier version. */}
          <View pointerEvents="none" style={styles.headerCenterAbsolute}>
            <LanguageFlag language={language} variant={variant} size={26} />
            <Text style={styles.headerTitle}>Level test</Text>
          </View>
        </View>

        {/* Progress bar — drives the user forward visually. */}
        {!finished ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        ) : null}

        {!finished && currentQuestion ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.questionEyebrow}>
              QUESTION {questionIndex + 1} OF {questions.length}
            </Text>
            <Text style={styles.questionPrompt}>{currentQuestion.prompt}</Text>
            <View style={styles.sentenceCard}>
              <Text style={styles.sentenceText}>{currentQuestion.sentence}</Text>
            </View>

            <View style={styles.options}>
              {shuffledOptions.map((option) => {
                const isSelected = selectedOption === option;
                const isCorrect = revealed && option === currentQuestion.answer;
                const isWrong = revealed && isSelected && option !== currentQuestion.answer;
                return (
                  <Pressable
                    key={option}
                    onPress={() => handleSelect(option)}
                    disabled={revealed}
                    style={[
                      styles.option,
                      isSelected ? styles.optionSelected : null,
                      isCorrect ? styles.optionCorrect : null,
                      isWrong ? styles.optionWrong : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isCorrect || isWrong ? styles.optionTextOnAccent : null,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {revealed && currentQuestion.rationale ? (
              <View style={styles.rationaleCard}>
                <Feather
                  name="info"
                  size={14}
                  color={selectedOption === currentQuestion.answer ? tokenColor.xp : tokenColor.cyan}
                />
                <Text style={styles.rationaleText}>{currentQuestion.rationale}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {finished ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {(() => {
              // Friendly level name (e.g. "Intermediate") as the primary
              // label; the CEFR code stays an optional secondary annotation.
              const levelCode = levelFromScore(score);
              const levelName = cefrDisplayLabel(levelCode) ?? levelCode;
              const levelDisplay = formatCefrDisplay(levelCode);
              return (
                <View style={styles.resultBlock}>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultBadgeText}>{levelName}</Text>
                  </View>
                  <Text style={styles.resultTitle}>
                    You&apos;re at {levelDisplay}
                  </Text>
                  <Text style={styles.resultBody}>
                    {score} of {questions.length} correct.
                  </Text>
                  <Text style={styles.resultDescription}>
                    {/* Plain apostrophe inside the template literal —
                        `&apos;` only works in raw JSX text, not inside
                        a `${...}` expression, where it would render as
                        the literal characters "&apos;". */}
                    {source === "onboarding"
                      ? `Your ${language} journey starts at ${levelDisplay}. Easier levels stay open whenever you want extra practice.`
                      : `${levelName} stories are unlocked. Pick up where you wanted to go — earlier levels stay available too.`}
                  </Text>
                </View>
              );
            })()}
          </ScrollView>
        ) : null}

        {/* Footer: Check / Next / Claim — depends on state. */}
        <View style={styles.footer}>
          {finished ? (
            <Pressable onPress={handleClaimResult} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {source === "onboarding" ? "Start journey" : "Unlock level"}
              </Text>
              <Feather name="arrow-right" size={18} color={tokenBg[1]} />
            </Pressable>
          ) : revealed ? (
            <Pressable onPress={handleNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {questionIndex >= questions.length - 1 ? "See result" : "Next"}
              </Text>
              <Feather name="arrow-right" size={18} color={tokenBg[1]} />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleCheck}
              disabled={!selectedOption}
              style={[
                styles.primaryButton,
                !selectedOption ? styles.primaryButtonDisabled : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>Check</Text>
            </Pressable>
          )}
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
  // Absolute centering so the title sits in the true horizontal
  // middle of the screen regardless of what's on the left/right.
  // pointerEvents="none" on the wrapper lets taps fall through to
  // the close button beneath.
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
  questionEyebrow: {
    color: tokenColor.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  questionPrompt: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sentenceCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(7,18,31,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginVertical: 4,
  },
  sentenceText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 28,
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
  optionCorrect: {
    borderColor: tokenColor.xp,
    backgroundColor: "rgba(252, 211, 77, 0.18)",
  },
  optionWrong: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.16)",
  },
  optionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  optionTextOnAccent: {
    color: "#ffffff",
  },
  rationaleCard: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginTop: 8,
  },
  rationaleText: {
    flex: 1,
    color: "rgba(255,255,255,0.75)",
    fontSize: 12.5,
    lineHeight: 17,
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
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  resultTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 8,
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
  emptyBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 8,
  },
  emptyBody: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
