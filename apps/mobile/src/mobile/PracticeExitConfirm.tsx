import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Confirmation overlay shown when the user taps the back arrow mid-practice.
 * Uses the same spring-in entrance the end-of-story prompt uses so the two
 * panels feel like siblings: backdrop fades in, card slides up from below
 * and lands with a small overshoot.
 */
export function PracticeExitConfirm({
  accent,
  onKeepGoing,
  onExit,
}: {
  accent: string;
  onKeepGoing: () => void;
  onExit: () => void;
}) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(40)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslate, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, cardOpacity, cardTranslate, cardScale]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        pointerEvents="auto"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onKeepGoing} />
      </Animated.View>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslate }, { scale: cardScale }],
            borderColor: `${accent}44`,
          },
        ]}
        accessibilityLabel="qa-practice-exit-confirm"
        testID="qa-practice-exit-confirm"
      >
        <Text style={styles.title}>Exit without finishing?</Text>
        <Text style={styles.body}>
          Your streak and score for this round won't be saved.
        </Text>
        <Pressable
          onPress={onKeepGoing}
          style={[styles.primaryButton, { backgroundColor: accent }]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Keep practicing</Text>
        </Pressable>
        <Pressable onPress={onExit} style={styles.secondaryButton} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>Exit anyway</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 12, 24, 0.72)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: "#132033",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
    gap: 12,
  },
  title: {
    color: "#f5f7fb",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  body: {
    color: "#aebcd3",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#0e1727",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#8fa3c2",
    fontSize: 14,
    fontWeight: "600",
  },
});
