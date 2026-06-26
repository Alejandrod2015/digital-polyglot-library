import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

// Logo dimensions are pinned to the EXACT same pt width as the
// `expo-splash-screen` plugin's `imageWidth` in app.config.js (270).
// Earlier this was `Math.min(SCREEN_WIDTH * 0.7, 320)`; a percentage
// of screen width; which rendered ~273pt on an iPhone 14, ~301pt on
// a Pro Max, ~262pt on an SE: NEVER 270. During iOS's automatic
// ~150-200ms fade-out of the native splash, the in-flow ExtendedSplash
// is already mounted underneath, so a different-sized logo briefly
// peeks behind the fading native logo and the user perceives it as
// "static logo for a fraction of a second, then animated logo".
// Pinning to 270 makes the handoff visually invisible.
//
// Source aspect ratio: 904 × 437 ≈ 2.07.
const LOGO_WIDTH = 270;
const LOGO_HEIGHT = LOGO_WIDTH * (437 / 904);

/**
 * Extended in-app splash. Renders the same logo + dark background as
 * the native splash so the transition from native to React-rendered
 * is seamless, then keeps the splash visible while the shell hydrates
 * its remote data. When the parent flips `visible` to false (i.e.
 * content is ready), the component plays a celebratory exit
 * animation; a soft glow ring expanding out from behind the logo
 * combined with a logo zoom; and then unmounts.
 *
 * The skeleton state inside the shell is still rendered conditionally
 * on `!didFirstHydrate`, but in normal cases the user goes straight
 * from this splash to the fully-loaded content because the splash
 * stays up until didFirstHydrate flips. The skeleton becomes a
 * fallback for very slow hydrates where the splash already faded.
 */

type Props = {
  /** True while the shell is still loading. When this flips to
   *  false the exit animation plays and the splash unmounts. */
  visible: boolean;
};

export function ExtendedSplash({ visible }: Props) {
  // Mount lifecycle: keep rendered through the exit animation.
  const [mounted, setMounted] = useState(visible);

  // Hide the native splash as soon as the React-rendered splash is
  // mounted. App.tsx calls preventAutoHideAsync() at module load so
  // the native splash stays up until this fires, preventing the
  // brief flash the user reported between the native logo and the
  // React-rendered one. Safe to call multiple times; only the
  // first call matters.
  useEffect(() => {
    if (mounted) {
      SplashScreen.hideAsync().catch(() => {
        // Already hidden / not configured; ignore.
      });
    }
  }, [mounted]);

  // Animations driving the exit sequence. We split logo scale, glow
  // opacity+scale, and overlay opacity into separate Animated.Values
  // so the timings can overlap with different easings.
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // Subtle "breathing" loop while we're waiting on the data; gives
  // the user a clear signal that the app hasn't frozen on the splash.
  useEffect(() => {
    if (!visible || !mounted) return;
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.04,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    breathing.start();
    return () => {
      breathing.stop();
    };
  }, [visible, mounted, logoScale]);

  // Mount + exit logic. When `visible` flips false we run the
  // glow-burst + zoom-fade exit, then setMounted(false) so the
  // component unmounts and stops blocking touches.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      overlayOpacity.setValue(1);
      glowScale.setValue(0.6);
      glowOpacity.setValue(0);
      // Don't reset logoScale here; the breathing loop owns it.
      return;
    }
    if (!mounted) return;
    Animated.sequence([
      // Phase 1: glow expands from behind the logo + logo bumps up.
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0.85,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.6,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.18,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Phase 2: glow fades while logo zooms further + the whole
      // overlay fades away to reveal the now-loaded content.
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 2.4,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.45,
          duration: 380,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 380,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, mounted, overlayOpacity, logoScale, glowScale, glowOpacity]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.fill, { opacity: overlayOpacity }]}
    >
      {/* Glow ring; sits behind the logo and expands during the
          exit. We use a translucent blue ring to read as a "burst"
          of brand color rather than a flat highlight. */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <Animated.Image
        source={require("../../assets/splash-logo-white.png")}
        style={[styles.logo, { transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    // Background matched to the native splash (configured in
    // app.config.js) AND the App.tsx font-loading splash so the
    // user never sees a background-color shift between the three.
    backgroundColor: "#0c1626",
    alignItems: "center",
    justifyContent: "center",
    // Above all other shell content (sheets sit higher via their
    // own zIndex, but the splash should cover the regular ScrollView
    // until it's fully ready).
    zIndex: 200,
  },
  logo: {
    // Pinned to the same pt width (270) the native splash plugin
    // uses, so the handoff between the two splashes is visually
    // identical. Earlier this was a `% of screen width` formula
    // that drifted from the native value on every device.
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  // Glow ring rendered behind the logo. A translucent disc with a
  // soft cyan tint; the in-flight tokens are dark navy, so a cyan
  // glow stands out without clashing.
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(125, 211, 252, 0.45)",
  },
});
