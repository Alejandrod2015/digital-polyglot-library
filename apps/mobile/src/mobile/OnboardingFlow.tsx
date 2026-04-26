import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LanguageFlag } from "./LanguageFlag";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";

/**
 * 3-step onboarding shown the first time a signed-in user lands in
 * the app. Captures language, motivation + level, and daily-goal +
 * reminder preferences, then commits everything in a single
 * /api/user/preferences write through `onComplete`.
 *
 * The "Sign up" step from the web mockup is intentionally omitted on
 * native: by the time we render this component the user already
 * authenticated through AuthScreen, so the third step is just the
 * daily-goal panel.
 *
 * Test mode: pass a truthy `testMode` flag to render the flow
 * without persisting anything when the user finishes (the parent
 * just closes it). Used for the "Test onboarding" entry that
 * polyglot-tier users can access from the menu.
 */

export type OnboardingPayload = {
  language: string;
  whys: string[];
  level: OnboardingLevel;
  dailyMinutes: 5 | 10 | 15 | 30;
  remindersEnabled: boolean;
  reminderHour: number | null;
};

type OnboardingLevel = "Brand new" | "A few words" | "Some";

type Props = {
  /** First name to show in the prompt — falls back to "you" */
  userName?: string | null;
  testMode?: boolean;
  onComplete: (payload: OnboardingPayload) => Promise<void> | void;
  onCancel?: () => void;
};

const LANGUAGE_OPTIONS: Array<{
  name: string;
  variant?: string;
  learners: string;
}> = [
  { name: "Spanish", variant: "LATAM", learners: "12.4M learners" },
  { name: "French", learners: "7.1M learners" },
  { name: "German", learners: "4.8M learners" },
  { name: "Italian", learners: "3.2M learners" },
  { name: "Portuguese", variant: "BRAZIL", learners: "2.6M learners" },
  { name: "Japanese", learners: "5.4M learners" },
  { name: "Korean", learners: "3.0M learners" },
  { name: "English", learners: "30M+ learners" },
];

type WhyOption = {
  key: string;
  title: string;
  hint: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};
const WHY_OPTIONS: WhyOption[] = [
  { key: "Travel", title: "Travel", hint: "Get around abroad", icon: "send" },
  { key: "Culture", title: "Culture", hint: "Books, films, music", icon: "star" },
  { key: "Family", title: "Family", hint: "Connect with loved ones", icon: "heart" },
  { key: "Work", title: "Work", hint: "Career & meetings", icon: "briefcase" },
  { key: "School", title: "School", hint: "Class or exam prep", icon: "book" },
  { key: "Just for fun", title: "Just for fun", hint: "Brain workout", icon: "smile" },
];

const LEVEL_OPTIONS: Array<{
  key: OnboardingLevel;
  badge: string;
  title: string;
  hint: string;
}> = [
  { key: "Brand new", badge: "A0", title: "Brand new", hint: "Never studied it" },
  { key: "A few words", badge: "A1", title: "A few words", hint: "Hola, gracias…" },
  { key: "Some", badge: "B1+", title: "I have some", hint: "I can hold a chat" },
];

const GOAL_OPTIONS: Array<{
  minutes: 5 | 10 | 15 | 30;
  title: string;
  hint: string;
  popular?: boolean;
}> = [
  { minutes: 5, title: "Casual", hint: "5 min / day" },
  { minutes: 10, title: "Steady", hint: "10 min / day" },
  { minutes: 15, title: "Serious", hint: "15 min / day", popular: true },
  { minutes: 30, title: "Intense", hint: "30 min / day" },
];

const REMINDER_HOURS = [8, 12, 19, 21];

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

export function OnboardingFlow({ userName, testMode, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [language, setLanguage] = useState<string | null>(null);
  const [whys, setWhys] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState<OnboardingLevel | null>(null);
  const [dailyMinutes, setDailyMinutes] = useState<5 | 10 | 15 | 30 | null>(15);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderHour, setReminderHour] = useState<number | null>(19);
  const [submitting, setSubmitting] = useState(false);

  // Slide animation between steps. translateX 24→0 + fade-in.
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    slide.setValue(24);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, slide, fade]);

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(language);
    if (step === 2) return whys.size > 0 && level !== null;
    return dailyMinutes !== null;
  }, [step, language, whys, level, dailyMinutes]);

  function handleContinue() {
    if (!canContinue) return;
    if (step < 3) {
      setStep(((step + 1) as 1 | 2 | 3));
      return;
    }
    void submit();
  }

  function handleBack() {
    if (step === 1) {
      onCancel?.();
      return;
    }
    setStep(((step - 1) as 1 | 2 | 3));
  }

  async function submit() {
    if (!language || !level || !dailyMinutes) return;
    setSubmitting(true);
    try {
      await onComplete({
        language,
        whys: Array.from(whys),
        level,
        dailyMinutes,
        remindersEnabled,
        reminderHour: remindersEnabled ? reminderHour : null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container} accessibilityLabel="qa-onboarding-flow" testID="qa-onboarding-flow">
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
          <Feather name="chevron-left" size={20} color="#f5f7fb" />
        </Pressable>
        <View style={styles.progressTrack}>
          {[1, 2, 3].map((segment) => (
            <View
              key={segment}
              style={[
                styles.progressSegment,
                segment <= step ? styles.progressSegmentDone : null,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressLabel}>{step}/3</Text>
      </View>

      {testMode ? (
        <View style={styles.testBadge}>
          <Feather name="zap" size={11} color={tokenColor.gold} />
          <Text style={styles.testBadgeText}>TEST MODE — selections are not saved</Text>
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.stepWrap,
          { opacity: fade, transform: [{ translateX: slide }] },
        ]}
      >
        {step === 1 ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>STEP 1 · LANGUAGE</Text>
            <Text style={styles.title}>What do you want to learn?</Text>
            <Text style={styles.subtitle}>
              Pick a journey to start. You can add more languages later.
            </Text>
            <View style={styles.languageList}>
              {LANGUAGE_OPTIONS.map((option) => {
                const selected = language === option.name;
                return (
                  <Pressable
                    key={option.name}
                    onPress={() => setLanguage(option.name)}
                    style={[
                      styles.languageRow,
                      selected ? styles.languageRowSelected : null,
                    ]}
                  >
                    <LanguageFlag language={option.name} size={36} />
                    <View style={styles.languageMeta}>
                      <View style={styles.languageHeading}>
                        <Text style={styles.languageName}>{option.name}</Text>
                        {option.variant ? (
                          <View style={styles.variantPill}>
                            <Text style={styles.variantPillText}>{option.variant}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.languageHint}>{option.learners}</Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        selected ? styles.radioSelected : null,
                      ]}
                    >
                      {selected ? (
                        <Feather name="check" size={14} color={tokenBg[1]} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

        {step === 2 ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>STEP 2 · ABOUT YOU</Text>
            <Text style={styles.title}>
              Why {language ?? "this language"}, and where are you?
            </Text>

            <View style={styles.subSection}>
              <View style={styles.subSectionHeader}>
                <View style={styles.subSectionDot}>
                  <Text style={styles.subSectionDotText}>1</Text>
                </View>
                <Text style={styles.subSectionLabel}>What&apos;s pulling you in?</Text>
              </View>
              <View style={styles.whyGrid}>
                {WHY_OPTIONS.map((option) => {
                  const checked = whys.has(option.key);
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        setWhys((prev) => {
                          const next = new Set(prev);
                          if (next.has(option.key)) next.delete(option.key);
                          else next.add(option.key);
                          return next;
                        });
                      }}
                      style={[styles.whyCard, checked ? styles.whyCardSelected : null]}
                    >
                      <Feather
                        name={option.icon}
                        size={18}
                        color={checked ? tokenColor.xp : "#9fb5d0"}
                      />
                      <Text
                        style={[
                          styles.whyCardTitle,
                          checked ? styles.whyCardTitleSelected : null,
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text style={styles.whyCardHint}>{option.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.subSection}>
              <View style={styles.subSectionHeader}>
                <View style={styles.subSectionDot}>
                  <Text style={styles.subSectionDotText}>2</Text>
                </View>
                <Text style={styles.subSectionLabel}>Where are you starting?</Text>
              </View>
              <View style={styles.levelList}>
                {LEVEL_OPTIONS.map((option) => {
                  const selected = level === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setLevel(option.key)}
                      style={[
                        styles.levelRow,
                        selected ? styles.levelRowSelected : null,
                      ]}
                    >
                      <View
                        style={[
                          styles.levelBadge,
                          selected ? styles.levelBadgeSelected : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.levelBadgeText,
                            selected ? styles.levelBadgeTextSelected : null,
                          ]}
                        >
                          {option.badge}
                        </Text>
                      </View>
                      <View style={styles.levelMeta}>
                        <Text style={styles.levelTitle}>{option.title}</Text>
                        <Text style={styles.levelHint}>{option.hint}</Text>
                      </View>
                      <View
                        style={[
                          styles.radio,
                          selected ? styles.radioSelected : null,
                        ]}
                      >
                        {selected ? (
                          <Feather name="check" size={14} color={tokenBg[1]} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        ) : null}

        {step === 3 ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>STEP 3 · COMMIT</Text>
            <Text style={styles.title}>Set your daily practice goal</Text>

            <View style={styles.goalGrid}>
              {GOAL_OPTIONS.map((option) => {
                const selected = dailyMinutes === option.minutes;
                return (
                  <Pressable
                    key={option.minutes}
                    onPress={() => setDailyMinutes(option.minutes)}
                    style={[styles.goalCard, selected ? styles.goalCardSelected : null]}
                  >
                    {option.popular ? (
                      <View style={styles.goalPopularPill}>
                        <Text style={styles.goalPopularText}>POPULAR</Text>
                      </View>
                    ) : null}
                    <Text style={styles.goalMinutes}>
                      {option.minutes}
                      <Text style={styles.goalMinutesUnit}> min</Text>
                    </Text>
                    <Text style={styles.goalTitle}>{option.title}</Text>
                    <Text style={styles.goalHint}>{option.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.reminderCard}>
              <View style={styles.reminderHead}>
                <View style={styles.reminderIcon}>
                  <MaterialCommunityIcons name="bell-outline" size={16} color={tokenColor.gold} />
                </View>
                <View style={styles.reminderText}>
                  <Text style={styles.reminderTitle}>Daily reminder</Text>
                  <Text style={styles.reminderHint}>
                    We&apos;ll nudge you. You can change this anytime.
                  </Text>
                </View>
                <Switch
                  value={remindersEnabled}
                  onValueChange={setRemindersEnabled}
                  trackColor={{ false: "rgba(255,255,255,0.2)", true: tokenColor.xp }}
                  thumbColor="#ffffff"
                />
              </View>
              {remindersEnabled ? (
                <View style={styles.hourRow}>
                  {REMINDER_HOURS.map((hour) => {
                    const selected = reminderHour === hour;
                    return (
                      <Pressable
                        key={hour}
                        onPress={() => setReminderHour(hour)}
                        style={[styles.hourChip, selected ? styles.hourChipSelected : null]}
                      >
                        <Text
                          style={[
                            styles.hourText,
                            selected ? styles.hourTextSelected : null,
                          ]}
                        >
                          {formatHour(hour)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>You&apos;re ready, {userName ?? "let's go"}</Text>
              <Text style={styles.summaryBody}>
                We&apos;ll build your {language ?? "first"} journey around{" "}
                {whys.size > 0 ? Array.from(whys).slice(0, 2).join(" + ") : "your goals"}.
              </Text>
            </View>
          </ScrollView>
        ) : null}
      </Animated.View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue || submitting}
          style={[
            styles.continueButton,
            !canContinue || submitting ? styles.continueButtonDisabled : null,
          ]}
        >
          <Text style={styles.continueText}>
            {submitting ? "Saving…" : step < 3 ? "Continue" : "Start journey"}
          </Text>
          <Feather name="chevron-right" size={18} color={tokenBg[1]} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0c1626",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  progressTrack: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressSegmentDone: {
    backgroundColor: tokenColor.xp,
  },
  progressLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "800",
  },
  testBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(252, 211, 77, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.3)",
    marginBottom: 4,
  },
  testBadgeText: {
    color: tokenColor.gold,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  stepWrap: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  eyebrow: {
    color: tokenColor.xp,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  title: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 20,
  },
  // ─── Step 1: language list ────────────────────────────────────────
  languageList: {
    marginTop: 6,
    gap: 10,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  languageRowSelected: {
    borderColor: "rgba(190, 242, 100, 0.5)",
    backgroundColor: "rgba(190, 242, 100, 0.08)",
  },
  languageMeta: {
    flex: 1,
    minWidth: 0,
  },
  languageHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  languageName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  variantPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(125, 211, 252, 0.14)",
  },
  variantPillText: {
    color: tokenColor.cyan,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  languageHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    backgroundColor: tokenColor.xp,
    borderColor: tokenColor.xp,
  },
  // ─── Step 2 ───────────────────────────────────────────────────────
  subSection: {
    marginTop: 14,
    gap: 10,
  },
  subSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subSectionDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(190, 242, 100, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(190, 242, 100, 0.4)",
  },
  subSectionDotText: {
    color: tokenColor.xp,
    fontSize: 11,
    fontWeight: "900",
  },
  subSectionLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  whyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  whyCard: {
    width: "48%",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 4,
  },
  whyCardSelected: {
    borderColor: "rgba(190, 242, 100, 0.5)",
    backgroundColor: "rgba(190, 242, 100, 0.08)",
  },
  whyCardTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
  },
  whyCardTitleSelected: {
    color: "#ffffff",
  },
  whyCardHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11.5,
    fontWeight: "700",
  },
  levelList: {
    gap: 8,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  levelRowSelected: {
    borderColor: "rgba(190, 242, 100, 0.5)",
    backgroundColor: "rgba(190, 242, 100, 0.08)",
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(125, 211, 252, 0.12)",
  },
  levelBadgeSelected: {
    backgroundColor: tokenColor.xp,
  },
  levelBadgeText: {
    color: tokenColor.cyan,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  levelBadgeTextSelected: {
    color: tokenBg[1],
  },
  levelMeta: {
    flex: 1,
    minWidth: 0,
  },
  levelTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  levelHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  // ─── Step 3 ───────────────────────────────────────────────────────
  goalGrid: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  goalCard: {
    width: "48%",
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 2,
    position: "relative",
  },
  goalCardSelected: {
    borderColor: "rgba(190, 242, 100, 0.55)",
    backgroundColor: "rgba(190, 242, 100, 0.10)",
  },
  goalPopularPill: {
    position: "absolute",
    top: -8,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: tokenColor.xp,
  },
  goalPopularText: {
    color: tokenBg[1],
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  goalMinutes: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  goalMinutesUnit: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(255,255,255,0.6)",
  },
  goalTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
  },
  goalHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "700",
  },
  reminderCard: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 12,
  },
  reminderHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reminderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(252, 211, 77, 0.16)",
  },
  reminderText: {
    flex: 1,
    minWidth: 0,
  },
  reminderTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  reminderHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 2,
  },
  hourRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hourChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  hourChipSelected: {
    borderColor: tokenColor.xp,
    backgroundColor: "rgba(190, 242, 100, 0.16)",
  },
  hourText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  hourTextSelected: {
    color: tokenColor.xp,
  },
  summaryCard: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "rgba(125, 211, 252, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.22)",
    gap: 4,
  },
  summaryTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  summaryBody: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 18,
  },
  // ─── Footer ───────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0c1626",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: tokenColor.xp,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueText: {
    color: tokenBg[1],
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
