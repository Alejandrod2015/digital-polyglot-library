import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

/**
 * Full-screen skeleton shown while a journey / explore story is being
 * fetched on tap. Mirrors the real reader: a tall cover area + a few
 * paragraph blocks so the page doesn't pop the moment text arrives.
 *
 * Uses a single shared opacity loop so all blocks breathe in unison —
 * cheaper than per-block animations and visually calmer than chasing
 * staggered pulses.
 */
export function ReaderSkeleton() {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.75,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const animated = { opacity: pulse };

  return (
    <View style={styles.container} accessibilityLabel="qa-reader-skeleton" testID="qa-reader-skeleton">
      {/* Top bar — back button + bookmark icons, just shapes */}
      <View style={styles.topBar}>
        <Animated.View style={[styles.topBarButton, animated]} />
        <View style={styles.topBarRight}>
          <Animated.View style={[styles.topBarButton, animated]} />
          <Animated.View style={[styles.topBarButton, animated]} />
        </View>
      </View>

      {/* Title + meta pills */}
      <View style={styles.titleBlock}>
        <Animated.View style={[styles.eyebrow, animated]} />
        <Animated.View style={[styles.title, animated]} />
        <View style={styles.pillRow}>
          <Animated.View style={[styles.pill, animated]} />
          <Animated.View style={[styles.pill, animated]} />
          <Animated.View style={[styles.pill, animated]} />
        </View>
      </View>

      {/* Cover */}
      <Animated.View style={[styles.cover, animated]} />

      {/* Paragraphs */}
      <View style={styles.paragraphs}>
        {[0.95, 0.88, 0.92, 0.7, 0.96, 0.82, 0.6].map((width, i) => (
          <Animated.View
            key={i}
            style={[styles.line, animated, { width: `${Math.round(width * 100)}%` }]}
          />
        ))}
      </View>
    </View>
  );
}

const BLOCK = "rgba(255, 255, 255, 0.08)";

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0c1626",
    paddingTop: 64,
    paddingHorizontal: 24,
    gap: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarRight: {
    flexDirection: "row",
    gap: 8,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BLOCK,
  },
  titleBlock: {
    gap: 8,
    marginTop: 8,
  },
  eyebrow: {
    width: 120,
    height: 11,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  title: {
    width: "70%",
    height: 28,
    borderRadius: 6,
    backgroundColor: BLOCK,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  pill: {
    width: 56,
    height: 22,
    borderRadius: 11,
    backgroundColor: BLOCK,
  },
  cover: {
    height: 180,
    borderRadius: 24,
    backgroundColor: BLOCK,
  },
  paragraphs: {
    gap: 10,
    marginTop: 4,
  },
  line: {
    height: 14,
    borderRadius: 5,
    backgroundColor: BLOCK,
  },
});
