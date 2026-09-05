import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { color as tokenColor } from "../theme/tokens";

/**
 * Full-screen curtain shown between the last onboarding step (level)
 * and the ready Journey screen.
 *
 * Committing the onboarding payload is not one write: preferences are
 * saved, the journey list is rebuilt client-side, a second save
 * persists it, and the journey payload is fetched. Without this
 * curtain the user watched every one of those land: the level step
 * fading out, an empty Home, a journey path with no stories, then the
 * real path popping in. The curtain stays up until the primary
 * language's journey is actually loaded, so the user goes from
 * "Start journey" straight to a finished screen.
 *
 * The three rows are NOT decoration on a timer: `step` is driven by
 * the shell as each of those writes actually resolves. A row is only
 * ticked when its work is done.
 */

/** One row per real milestone in `commitOnboarding`, in order. */
const ROWS = [
  "Saving your answers",
  "Building your journey",
  "Picking your first stories",
] as const;

/** Floor for how long a row stays lit before the next one takes over.
 *  Without it a cached commit ticks all three in the same frame and
 *  the list reads as a flicker instead of as progress. */
const MIN_ROW_MS = 650;

const LOGO_WIDTH = 156;
const LOGO_HEIGHT = LOGO_WIDTH * (437 / 904);

type Props = {
  /** Milestones completed so far: 0 = none (first row working),
   *  1 = preferences saved, 2 = journeys persisted, 3 = journey
   *  loaded. Owned by the shell so it survives the remount when the
   *  survey gate flips underneath the curtain. */
  step: 0 | 1 | 2 | 3;
  /** Everything behind the curtain is ready. Plays the exit sequence
   *  and then calls `onHidden`. */
  done: boolean;
  /** Called once the exit animation has finished, so the shell can
   *  unmount the curtain and reveal the journey. */
  onHidden: () => void;
};

export function OnboardingHandoff({ step, done, onHidden }: Props) {
  // Rows actually shown as complete. Chases `step` but never faster
  // than MIN_ROW_MS per row. Seeded from `step` so a remount picks up
  // where the previous mount was instead of replaying from zero.
  const [shownStep, setShownStep] = useState(step);
  const lastAdvanceRef = useRef(Date.now());

  const enterFade = useRef(new Animated.Value(step === 0 ? 0 : 1)).current;
  const exitFade = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const titleFade = useRef(new Animated.Value(1)).current;
  const rowOpacity = useRef(ROWS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.32))).current;
  const checkScale = useRef(ROWS.map(() => new Animated.Value(0))).current;

  const [titleText, setTitleText] = useState("Setting up your journey");

  // Fade the curtain in fast; it has to cover the level step before
  // the first state change lands underneath it.
  useEffect(() => {
    Animated.timing(enterFade, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [enterFade]);

  // Ring on the working row.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  // Advance one row at a time, respecting the floor.
  useEffect(() => {
    if (shownStep >= step) return;
    const wait = Math.max(0, MIN_ROW_MS - (Date.now() - lastAdvanceRef.current));
    const timer = setTimeout(() => {
      lastAdvanceRef.current = Date.now();
      setShownStep((current) => (current + 1) as 0 | 1 | 2 | 3);
    }, wait);
    return () => clearTimeout(timer);
  }, [step, shownStep]);

  // Paint the rows for the current position: everything before the
  // cursor ticked, the cursor lit, the rest dimmed.
  useEffect(() => {
    ROWS.forEach((_, i) => {
      const target = i < shownStep ? 0.62 : i === shownStep ? 1 : 0.32;
      Animated.timing(rowOpacity[i], {
        toValue: target,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      if (i < shownStep) {
        // Tick pops in with a slight overshoot; the one gesture in
        // the screen that says "that part is finished".
        Animated.spring(checkScale[i], {
          toValue: 1,
          friction: 5,
          tension: 160,
          useNativeDriver: true,
        }).start();
      }
    });
    Animated.timing(progress, {
      toValue: shownStep / ROWS.length,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shownStep, rowOpacity, checkScale, progress]);

  // Exit sequence. Only once the last row has actually been ticked,
  // so the user never sees the curtain leave mid-list.
  useEffect(() => {
    if (!done || shownStep < ROWS.length) return;
    const timer = setTimeout(() => {
      Animated.sequence([
        // Bar closes the last stretch and the title swaps.
        Animated.parallel([
          Animated.timing(progress, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(titleFade, {
              toValue: 0,
              duration: 140,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(titleFade, {
              toValue: 1,
              duration: 200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.delay(240),
        // Curtain lifts: fades out while easing forward, so the
        // journey behind it reads as arriving rather than as a cut.
        Animated.parallel([
          Animated.timing(exitFade, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(exitScale, {
            toValue: 1.06,
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) onHidden();
      });
      setTimeout(() => setTitleText("Your journey is ready"), 140);
    }, 120);
    return () => clearTimeout(timer);
  }, [done, shownStep, progress, titleFade, exitFade, exitScale, onHidden]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      testID="qa-onboarding-handoff"
      style={[
        styles.fill,
        {
          opacity: Animated.multiply(enterFade, exitFade),
          transform: [{ scale: exitScale }],
        },
      ]}
    >
      <Image
        source={require("../../assets/splash-logo-white.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Animated.Text style={[styles.title, { opacity: titleFade }]}>{titleText}</Animated.Text>

      <View style={styles.list}>
        {ROWS.map((label, i) => {
          const isDone = i < shownStep;
          const isActive = i === shownStep;
          return (
            <Animated.View
              key={label}
              style={[
                styles.row,
                isActive ? styles.rowActive : null,
                { opacity: rowOpacity[i] },
              ]}
            >
              <View style={styles.dotWrap}>
                {isDone ? (
                  <Animated.View style={[styles.dotDone, { transform: [{ scale: checkScale[i] }] }]}>
                    <Feather name="check" size={13} color="#0c1626" />
                  </Animated.View>
                ) : isActive ? (
                  <Animated.View style={[styles.dotActive, { transform: [{ rotate }] }]} />
                ) : (
                  <View style={styles.dotPending} />
                )}
              </View>
              <Text style={[styles.rowLabel, isActive ? styles.rowLabelActive : null]}>{label}</Text>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    // Same canvas as the native splash and the onboarding flow, so the
    // curtain never reads as a different screen.
    backgroundColor: "#0c1626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    // Above the onboarding flow it covers, and above the shell's own
    // sheets while the journey loads underneath.
    zIndex: 300,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    marginBottom: 26,
    opacity: 0.9,
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  list: {
    marginTop: 22,
    width: "100%",
    maxWidth: 270,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
  },
  rowActive: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  dotWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  dotPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.14)",
  },
  dotActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(252,211,77,0.25)",
    // One lit segment turns the static circle into a spinner.
    borderTopColor: tokenColor.xp,
  },
  dotDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokenColor.xp,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "700",
  },
  rowLabelActive: {
    fontWeight: "800",
  },
  progressTrack: {
    marginTop: 24,
    width: "100%",
    maxWidth: 260,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: tokenColor.xp,
  },
});
