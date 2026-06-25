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
import { LanguageFlag, regionFamily } from "./LanguageFlag";
import { LevelTestRunner } from "./LevelTestRunner";
import { TimePickerSheet } from "./TimePickerSheet";
import { type CEFRLevel, hasLevelTest } from "./levelTest";
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
  /** Every (language, variant) tuple the user picked, in order of
   *  selection. The first one becomes the active journey; the rest
   *  are persisted as additional journeys on the account. Picking
   *  Spanish ES + Spanish LATAM creates two distinct journeys with
   *  the same `language` ("Spanish") but different `variant`
   *  codes. */
  selections: Array<{ language: string; variant: string | null }>;
  /** Deduped list of language NAMES (ignores variants), used to
   *  populate the legacy server field `targetLanguages`. */
  languages: string[];
  /** Variant chosen alongside the primary language, when the picker
   *  exposes more than one regional flag (English: us|uk). null when
   *  no regional choice was made. Only the primary language's variant
   *  is captured for the legacy `preferredVariant` server field;
   *  secondary variants live in `selections`. */
  primaryVariant: string | null;
  whys: string[];
  level: OnboardingLevel;
  /** CEFR level from the level test, if the user took it. null when
   *  they skipped the test. */
  testedLevel: CEFRLevel | null;
  dailyMinutes: 5 | 10 | 15 | 30;
  remindersEnabled: boolean;
  reminderHour: number | null;
  reminderMinute?: number | null;
};

type OnboardingLevel = "Brand new" | "A few words" | "Some";

type Props = {
  /** First name to show in the prompt — falls back to "you" */
  userName?: string | null;
  testMode?: boolean;
  /** Set of canonical language names ("Spanish", "Korean", …) flagged as
   *  Próximamente in Studio Planning. Coming-soon rows render a "Próximamente"
   *  pill and refuse selection. The shell hydrates this from
   *  /api/mobile/languages — when the fetch fails we treat the set as empty
   *  and let everything be selectable rather than block onboarding. */
  comingSoonLanguages?: ReadonlySet<string>;
  /** Variants with no journeys yet, keyed `${language}:${regionFamily}`. Disables
   *  e.g. Spanish · Spain while Spanish · LATAM is live. */
  unavailableVariants?: ReadonlySet<string>;
  onComplete: (payload: OnboardingPayload) => Promise<void> | void;
  onCancel?: () => void;
  /** Fire-and-forget tracker injected by the shell so OnboardingFlow
   *  stays unaware of session/auth details. Used to record funnel
   *  events (started / step_completed / finished / abandoned /
   *  level_test_started / level_test_completed) into UserMetric. */
  trackEvent?: (
    eventType:
      | "onboarding_started"
      | "onboarding_step_completed"
      | "onboarding_finished"
      | "onboarding_abandoned"
      | "onboarding_level_test_started"
      | "onboarding_level_test_completed",
    metadata?: Record<string, unknown>
  ) => void;
};

type LanguageOption = {
  /** Unique row key. For most languages this equals `name`. English
   *  has two rows (us / uk) that share the name "English", so we
   *  disambiguate with `English|us` and `English|uk`. */
  key: string;
  /** Canonical language name persisted to preferences. */
  name: string;
  /** Display pill on the row. For English this is "US" / "UK"; for
   *  Spanish/Portuguese it's "LATAM"/"BRAZIL". */
  variantLabel?: string;
  /** Lower-case variant code passed to LanguageFlag and stored as
   *  preferredVariant on commit. Only set when the language has more
   *  than one regional flag in the picker (today: English us|uk). */
  variantCode?: string;
  learners: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  // Spanish: split between Spain (default ES, red-yellow-red) and
  // LATAM (Colombia flag, yellow-blue-red 2:1:1). Mutex per language
  // so picking one variant deselects the other. Colombia was chosen
  // for LATAM because its tricolor doesn't visually clash with any
  // other flag in our set (vs. Mexico's green-white-red, which is
  // indistinguishable from Italy at coin scale).
  // `learners` is the row subtitle. It is an honest variant/region
  // descriptor only — never a fabricated learner/speaker count. Empty
  // string = no subtitle (the COMING SOON / variant badge carries the
  // context on its own).
  { key: "Spanish|es", name: "Spanish", variantLabel: "SPAIN", variantCode: "es", learners: "Castilian Spanish" },
  { key: "Spanish|latam", name: "Spanish", variantLabel: "LATAM", variantCode: "latam", learners: "Latin American Spanish" },
  { key: "French", name: "French", learners: "" },
  { key: "German", name: "German", learners: "" },
  { key: "Italian", name: "Italian", learners: "" },
  // Portuguese: Brazilian (green field + yellow rhombus + blue circle)
  // is the default, European is the alternative.
  { key: "Portuguese|br", name: "Portuguese", variantLabel: "BRAZIL", variantCode: "br", learners: "Brazilian Portuguese" },
  { key: "Portuguese|pt", name: "Portuguese", variantLabel: "PORTUGAL", variantCode: "pt", learners: "European Portuguese" },
  { key: "Japanese", name: "Japanese", learners: "" },
  { key: "Korean", name: "Korean", learners: "" },
  // Chinese added in build 68 — was previously only listed in the
  // Add-journey panel, never in onboarding. Now consistent across
  // both entry points.
  { key: "Chinese", name: "Chinese", learners: "Mandarin" },
  // English ships two regional flags so users can pick the variant
  // that matches their target audience (US business English vs.
  // UK / Commonwealth English).
  { key: "English|us", name: "English", variantLabel: "US", variantCode: "us", learners: "American English" },
  { key: "English|uk", name: "English", variantLabel: "UK", variantCode: "uk", learners: "Commonwealth English" },
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

type LevelOption = {
  key: OnboardingLevel;
  badge: string;
  title: string;
  /** Hint can vary by language (e.g. example greetings); resolved
   *  at render time by `levelHintFor(option, language)`. */
  hint: string | ((language: string | null) => string);
};

// "A few words" sample greetings per language. Falls back to a
// neutral example when we don't have a recipe so we never show
// Spanish phrases on a German row, etc.
const FEW_WORDS_BY_LANGUAGE: Record<string, string> = {
  Spanish: "Hola, gracias…",
  French: "Bonjour, merci…",
  German: "Hallo, danke…",
  Italian: "Ciao, grazie…",
  Portuguese: "Olá, obrigado…",
  Japanese: "こんにちは, ありがとう…",
  Korean: "안녕하세요, 감사합니다…",
  Chinese: "你好, 谢谢…",
  English: "Hi, thanks…",
};

// Badges use the friendly level names (never raw CEFR codes like "A0").
// `key` stays the internal value used to map the self-assessment to a level.
const LEVEL_OPTIONS: LevelOption[] = [
  { key: "Brand new", badge: "Beginner", title: "Brand new", hint: "Never studied it" },
  {
    key: "A few words",
    badge: "Elementary",
    title: "A few words",
    hint: (language) =>
      (language && FEW_WORDS_BY_LANGUAGE[language]) || "Just a handful of phrases",
  },
  { key: "Some", badge: "Intermediate+", title: "I have some", hint: "I can hold a chat" },
];

function levelHintFor(option: LevelOption, language: string | null): string {
  return typeof option.hint === "function" ? option.hint(language) : option.hint;
}

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

function formatHour(hour: number, minute: number = 0): string {
  const hh = hour.toString().padStart(2, "0");
  const mm = minute.toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function OnboardingFlow({
  userName,
  testMode,
  comingSoonLanguages,
  unavailableVariants,
  onComplete,
  onCancel,
  trackEvent,
}: Props) {
  // 4-step flow:
  //   1. Languages
  //   2. Why / motivations
  //   3. Daily goal + reminders
  //   4. Level (with optional level test for accuracy) — last step so
  //      the test result, when taken, lands right before submit.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  // We track selection by option *key*, not language name, so the two
  // English rows (English|us / English|uk) can coexist in the catalog
  // without collapsing to the same selection bucket.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const selectedOptions = useMemo(
    () =>
      selectedKeys
        .map((key) => LANGUAGE_OPTIONS.find((option) => option.key === key))
        .filter((option): option is LanguageOption => Boolean(option)),
    [selectedKeys]
  );
  // Convenience shortcut for places that only care about the
  // first/active language (greeting examples, summary copy, etc.).
  const language = selectedOptions[0]?.name ?? null;
  const [whys, setWhys] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState<OnboardingLevel | null>(null);
  // CEFR level produced by the level test, if the user took it. null
  // means they skipped the test (we'll persist the self-reported
  // `level` mapped to a coarse CEFR equivalent).
  const [testedLevel, setTestedLevel] = useState<CEFRLevel | null>(null);
  // Whether the level test runner is currently overlaid on top of
  // the onboarding flow. The runner is full-screen and self-handles
  // its lifecycle; we just gate it with this flag.
  const [levelTestOpen, setLevelTestOpen] = useState(false);
  const [dailyMinutes, setDailyMinutes] = useState<5 | 10 | 15 | 30 | null>(15);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderHour, setReminderHour] = useState<number | null>(19);
  const [reminderMinute, setReminderMinute] = useState<number | null>(0);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fire onboarding_started exactly once per mount. The ref guard
  // protects against StrictMode double-invokes and re-renders.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent?.("onboarding_started", { testMode: Boolean(testMode) });
  }, [trackEvent, testMode]);

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
    if (step === 1) return selectedKeys.length > 0;
    if (step === 2) return whys.size > 0;
    if (step === 3) return dailyMinutes !== null;
    // Step 4 (level): need a level pick OR a test result.
    return level !== null || testedLevel !== null;
  }, [step, selectedKeys, whys, level, testedLevel, dailyMinutes]);

  async function handleContinue() {
    if (!canContinue) return;
    // When the user opts into the daily reminder on step 3, surface
    // the iOS notification permission popup right after they tap
    // Continue. iOS only shows the system prompt the FIRST time we
    // ask, so we couple it to the explicit toggle-on action where
    // the user has already signaled intent — that gives the best
    // grant rate. We don't gate navigation on the result; if the
    // user denies, the toggle stays as their stated preference and
    // they can re-enable from Settings later. The lazy require
    // mirrors `notifications/registerPush.ts` so a missing native
    // module never breaks the onboarding flow.
    if (step === 3 && remindersEnabled) {
      try {
        const Notifications = require("expo-notifications") as
          | typeof import("expo-notifications")
          | undefined;
        if (Notifications) {
          const current = await Notifications.getPermissionsAsync();
          // Only call request when the system hasn't already
          // resolved — re-requesting after a deny is a no-op on iOS
          // (returns the same denied status without re-prompting),
          // but skipping the call avoids an unnecessary bridge hop.
          if (current.status === "undetermined" || current.canAskAgain) {
            await Notifications.requestPermissionsAsync();
          }
        }
      } catch (err) {
        console.warn(
          "[onboarding] notification permission request failed",
          err
        );
      }
    }
    // Record the step the user just completed before navigating. We
    // emit this for steps 1-3; step 4 is implicit in onboarding_finished.
    if (step < 4) {
      trackEvent?.("onboarding_step_completed", {
        step,
        selectionsCount: selectedKeys.length,
        whysCount: whys.size,
        dailyMinutes,
        remindersEnabled,
      });
      setStep(((step + 1) as 1 | 2 | 3 | 4));
      return;
    }
    void submit();
  }

  function handleBack() {
    if (step === 1) {
      trackEvent?.("onboarding_abandoned", { step });
      onCancel?.();
      return;
    }
    setStep(((step - 1) as 1 | 2 | 3 | 4));
  }

  // Single source of truth for committing the onboarding payload. The level
  // test result path passes `testedLevelOverride` (because setTestedLevel is
  // async and the new value isn't in state yet) + a softer `levelFallback`.
  // Keeping ONE submit() avoids the two copies drifting (they previously did:
  // one dropped reminderMinute, the other defaulted the level differently).
  async function submit(opts?: {
    testedLevelOverride?: CEFRLevel | null;
    levelFallback?: OnboardingLevel;
  }) {
    const effectiveTested =
      opts && "testedLevelOverride" in opts ? opts.testedLevelOverride ?? null : testedLevel;
    if (selectedOptions.length === 0 || !dailyMinutes) return;
    if (!level && !effectiveTested) return;
    setSubmitting(true);
    try {
      await onComplete({
        selections: selectedOptions.map((option) => ({
          language: option.name,
          variant: option.variantCode ?? null,
        })),
        languages: Array.from(new Set(selectedOptions.map((option) => option.name))),
        primaryVariant: selectedOptions[0]?.variantCode ?? null,
        whys: Array.from(whys),
        // If the user skipped the test but didn't pick a level either
        // (shouldn't happen due to canContinue, but defensive), fall
        // back to the caller's hint or "Brand new".
        level: level ?? opts?.levelFallback ?? "Brand new",
        testedLevel: effectiveTested,
        dailyMinutes,
        remindersEnabled,
        reminderHour: remindersEnabled ? reminderHour : null,
        reminderMinute: remindersEnabled ? reminderMinute ?? 0 : null,
      });
      trackEvent?.("onboarding_finished", {
        languages: Array.from(new Set(selectedOptions.map((option) => option.name))),
        primaryLanguage: selectedOptions[0]?.name ?? null,
        primaryVariant: selectedOptions[0]?.variantCode ?? null,
        languagesCount: selectedOptions.length,
        whysCount: whys.size,
        selfReportedLevel: level,
        testedLevel: effectiveTested,
        tookLevelTest: effectiveTested !== null,
        dailyMinutes,
        remindersEnabled,
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
          {[1, 2, 3, 4].map((segment) => (
            <View
              key={segment}
              style={[
                styles.progressSegment,
                segment <= step ? styles.progressSegmentDone : null,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressLabel}>{step}/4</Text>
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
            <Text style={styles.eyebrow}>STEP 1 · LANGUAGES</Text>
            <Text style={styles.title}>What do you want to learn?</Text>
            <Text style={styles.subtitle}>
              Pick one or more. The first you pick becomes your starting journey
              — the rest will be ready in your language switcher.
            </Text>
            <View style={styles.languageList}>
              {LANGUAGE_OPTIONS.map((option) => {
                const selectedIndex = selectedKeys.indexOf(option.key);
                const selected = selectedIndex >= 0;
                const order = selected ? selectedIndex + 1 : null;
                const variantUnavailable = option.variantCode
                  ? unavailableVariants?.has(
                      `${option.name.toLowerCase()}:${regionFamily(option.variantCode)}`
                    ) ?? false
                  : false;
                const comingSoon =
                  (comingSoonLanguages?.has(option.name) ?? false) || variantUnavailable;
                return (
                  <Pressable
                    key={option.key}
                    disabled={comingSoon}
                    onPress={() => {
                      // Plain toggle — picking a Spanish-LATAM row
                      // does NOT deselect Spanish-ES, and the same
                      // for any other language with multiple
                      // variants (Portuguese BR/PT, English US/UK).
                      // Each variant is its own journey on the user's
                      // account.
                      setSelectedKeys((prev) =>
                        prev.includes(option.key)
                          ? prev.filter((k) => k !== option.key)
                          : [...prev, option.key]
                      );
                    }}
                    style={[
                      styles.languageRow,
                      selected ? styles.languageRowSelected : null,
                      comingSoon ? styles.languageRowDisabled : null,
                    ]}
                  >
                    <LanguageFlag
                      language={option.name}
                      variant={option.variantCode}
                      size={36}
                    />
                    <View style={styles.languageMeta}>
                      <View style={styles.languageHeading}>
                        <Text style={styles.languageName}>{option.name}</Text>
                        {option.variantLabel ? (
                          <View style={styles.variantPill}>
                            <Text style={styles.variantPillText}>{option.variantLabel}</Text>
                          </View>
                        ) : null}
                        {comingSoon ? (
                          <View style={styles.comingSoonPill}>
                            <Text style={styles.comingSoonPillText}>COMING SOON</Text>
                          </View>
                        ) : null}
                        {!comingSoon && order === 1 && selectedKeys.length > 1 ? (
                          <View style={styles.primaryPill}>
                            <Text style={styles.primaryPillText}>PRIMARY</Text>
                          </View>
                        ) : null}
                      </View>
                      {option.learners ? (
                        <Text style={styles.languageHint}>{option.learners}</Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        selected ? styles.checkboxSelected : null,
                        comingSoon ? styles.checkboxComingSoon : null,
                      ]}
                    >
                      {selected ? (
                        order && selectedKeys.length > 1 ? (
                          <Text style={styles.checkboxOrder}>{order}</Text>
                        ) : (
                          <Feather name="check" size={14} color={tokenBg[1]} />
                        )
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
            <Text style={styles.eyebrow}>STEP 2 · MOTIVATION</Text>
            <Text style={styles.title}>
              Why {language ?? "this language"}?
            </Text>
            <Text style={styles.subtitle}>
              Pick one or more. We&apos;ll tilt your journey toward stories
              that match what&apos;s pulling you in.
            </Text>
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
          </ScrollView>
        ) : null}

        {step === 3 ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>STEP 3 · COMMIT</Text>
            <Text style={styles.title}>Daily practice goal</Text>

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
                  <Pressable
                    onPress={() => setTimePickerOpen(true)}
                    style={[styles.hourChip, styles.hourChipSelected]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.hourText, styles.hourTextSelected]}>
                      {reminderHour !== null
                        ? formatHour(reminderHour, reminderMinute ?? 0)
                        : "Choose time"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

          </ScrollView>
        ) : null}

        {step === 4 ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>STEP 4 · LEVEL</Text>
            <Text style={styles.title}>
              Where are you starting with {language ?? "this language"}?
            </Text>
            <Text style={styles.subtitle}>
              Pick the closest match. Or take a 1-minute level test for a more
              accurate placement.
            </Text>

            <View style={styles.levelList}>
              {LEVEL_OPTIONS.map((option) => {
                const selected = level === option.key && !testedLevel;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setLevel(option.key);
                      // Picking a self-reported level after taking the
                      // test means the user wants the self-pick — clear
                      // the test result so submit uses the picked level.
                      setTestedLevel(null);
                    }}
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
                        numberOfLines={1}
                        adjustsFontSizeToFit
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
                      <Text style={styles.levelHint}>{levelHintFor(option, language)}</Text>
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

            {/* Level test offer — only shown for languages where we
                have authored test content (Spanish, German). The test
                runner is a full-screen modal that overlays this flow. */}
            {language && hasLevelTest(language) ? (
              <Pressable
                onPress={() => {
                  trackEvent?.("onboarding_level_test_started", {
                    language,
                    variant: selectedOptions[0]?.variantCode ?? null,
                  });
                  setLevelTestOpen(true);
                }}
                style={styles.levelTestCta}
              >
                <View style={styles.levelTestCtaIcon}>
                  <Feather name="zap" size={16} color={tokenColor.gold} />
                </View>
                <View style={styles.levelTestCtaText}>
                  <Text style={styles.levelTestCtaTitle}>
                    {testedLevel
                      ? `Tested level: ${testedLevel}`
                      : "Take the level test"}
                  </Text>
                  <Text style={styles.levelTestCtaHint}>
                    {testedLevel
                      ? "Tap to retake the test"
                      : "10 quick questions · ~1 minute"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.55)" />
              </Pressable>
            ) : null}

            {testedLevel ? (
              <View style={styles.testedLevelCard}>
                <Feather name="check-circle" size={14} color={tokenColor.xp} />
                <Text style={styles.testedLevelText}>
                  We&apos;ll start your journey at {testedLevel}.
                </Text>
              </View>
            ) : null}
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
            {submitting ? "Saving…" : step < 4 ? "Continue" : "Start journey"}
          </Text>
          <Feather name="chevron-right" size={18} color={tokenBg[1]} />
        </Pressable>
      </View>

      {/* Level test runner — full-screen overlay launched from step 4
          when the user taps "Take the level test". Self-contained;
          calls back with a CEFR level which we store as `testedLevel`
          and surface as the placement when the user submits. */}
      {language ? (
        <LevelTestRunner
          open={levelTestOpen}
          language={language}
          variant={selectedOptions[0]?.variantCode ?? null}
          source="onboarding"
          onComplete={async (result) => {
            // The user tapped "Start journey" in the test result —
            // the expectation is the journey actually starts. Bake the
            // tested level in and commit through the SAME submit() the
            // skip-test path uses (single source of truth), passing the
            // result directly since setTestedLevel hasn't flushed yet.
            setTestedLevel(result.level);
            setLevelTestOpen(false);
            trackEvent?.("onboarding_level_test_completed", {
              language,
              cefrLevel: result.level,
            });
            await submit({ testedLevelOverride: result.level, levelFallback: "Some" });
          }}
          onCancel={() => setLevelTestOpen(false)}
        />
      ) : null}

      <TimePickerSheet
        open={timePickerOpen}
        initialHour={reminderHour ?? 18}
        initialMinute={reminderMinute ?? 0}
        onClose={() => setTimePickerOpen(false)}
        onConfirm={(hour, minute) => {
          setReminderHour(hour);
          setReminderMinute(minute);
          setTimePickerOpen(false);
        }}
      />
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
    borderColor: "rgba(252, 211, 77, 0.5)",
    backgroundColor: "rgba(252, 211, 77, 0.08)",
  },
  languageMeta: {
    flex: 1,
    minWidth: 0,
  },
  languageHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    rowGap: 4,
    flexWrap: "wrap",
  },
  languageName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    flexShrink: 1,
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
  // Multi-select checkbox: rounded square, fills with the selection
  // order so the user can see which language they picked first
  // (= the starting journey).
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: tokenColor.xp,
    borderColor: tokenColor.xp,
  },
  checkboxOrder: {
    color: tokenBg[1],
    fontSize: 13,
    fontWeight: "900",
  },
  primaryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: tokenColor.xp,
  },
  primaryPillText: {
    color: tokenBg[1],
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  languageRowDisabled: {
    opacity: 0.45,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  comingSoonPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  comingSoonPillText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  checkboxComingSoon: {
    borderColor: "rgba(255,255,255,0.08)",
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
    backgroundColor: "rgba(252, 211, 77, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.4)",
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
    borderColor: "rgba(252, 211, 77, 0.5)",
    backgroundColor: "rgba(252, 211, 77, 0.08)",
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
    borderColor: "rgba(252, 211, 77, 0.5)",
    backgroundColor: "rgba(252, 211, 77, 0.08)",
  },
  levelBadge: {
    width: 92,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
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
    borderColor: "rgba(252, 211, 77, 0.55)",
    backgroundColor: "rgba(252, 211, 77, 0.10)",
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
    backgroundColor: "rgba(252, 211, 77, 0.16)",
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
  // ─── Step 4: level test offer card ───────────────────────────────
  levelTestCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(252, 211, 77, 0.35)",
    backgroundColor: "rgba(252, 211, 77, 0.06)",
    marginTop: 14,
  },
  levelTestCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(252, 211, 77, 0.14)",
  },
  levelTestCtaText: {
    flex: 1,
    minWidth: 0,
  },
  levelTestCtaTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  levelTestCtaHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 2,
  },
  testedLevelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(252, 211, 77, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.3)",
    marginTop: 10,
  },
  testedLevelText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "700",
  },
});
