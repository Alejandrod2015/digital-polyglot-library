import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

/**
 * Placeholder shown on Home while remote data hydrates. Shapes match the
 * real content (Continue listening + New releases carousels) so the layout
 * doesn't shift when the real cards arrive — and so the user has something
 * to look at instead of a blank screen.
 */
export function HomeSkeleton() {
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

  // Single shared opacity so all skeleton blocks breathe together.
  const animatedStyle = { opacity: pulse };

  return (
    <>
      {/* Continue listening — single full-width card (matches
          BookHomeCard with fullWidth prop). */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Animated.View style={[styles.eyebrow, animatedStyle]} />
          <Animated.View style={[styles.title, animatedStyle]} />
        </View>
        <Animated.View style={[styles.bookHomeCard, animatedStyle]}>
          <View style={styles.bookHomeCardImage} />
          <View style={styles.bookHomeCardBody}>
            <View style={styles.bookHomeCardTitle} />
            <View style={styles.bookHomeCardSubtitle} />
            <View style={styles.bookHomeCardMeta} />
          </View>
        </Animated.View>
      </View>

      {/* New releases — horizontal carousel with a BookWebCard (book
          cover on the left, text on the right). */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Animated.View style={[styles.eyebrow, animatedStyle]} />
          <Animated.View style={[styles.title, animatedStyle]} />
        </View>
        <View style={styles.carousel}>
          {[0, 1].map((i) => (
            <Animated.View key={i} style={[styles.bookWebCard, animatedStyle]}>
              <View style={styles.bookWebCover} />
              <View style={styles.bookWebBody}>
                <View style={styles.bookWebTitle} />
                <View style={styles.bookWebLineShort} />
                <View style={styles.bookWebLine} />
                <View style={styles.bookWebLine} />
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
    </>
  );
}

const BLOCK = "rgba(255, 255, 255, 0.08)";

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  headerRow: {
    gap: 6,
  },
  eyebrow: {
    width: 60,
    height: 10,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  title: {
    width: 180,
    height: 22,
    borderRadius: 6,
    backgroundColor: BLOCK,
  },
  // Matches BookHomeCard fullWidth
  bookHomeCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(20, 36, 59, 0.6)",
    overflow: "hidden",
  },
  bookHomeCardImage: {
    width: "100%",
    height: 180,
    backgroundColor: BLOCK,
  },
  bookHomeCardBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  bookHomeCardTitle: {
    width: "75%",
    height: 20,
    borderRadius: 6,
    backgroundColor: BLOCK,
  },
  bookHomeCardSubtitle: {
    width: "55%",
    height: 14,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  bookHomeCardMeta: {
    width: "40%",
    height: 12,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  // Horizontal carousel row with BookWebCard-shaped placeholders.
  carousel: {
    flexDirection: "row",
    gap: 12,
  },
  bookWebCard: {
    width: 324,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(20, 36, 59, 0.6)",
    flexDirection: "row",
    padding: 12,
    gap: 12,
  },
  bookWebCover: {
    width: 86,
    aspectRatio: 0.72,
    borderRadius: 14,
    backgroundColor: BLOCK,
  },
  bookWebBody: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },
  bookWebTitle: {
    width: "85%",
    height: 18,
    borderRadius: 5,
    backgroundColor: BLOCK,
  },
  bookWebLineShort: {
    width: "40%",
    height: 12,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  bookWebLine: {
    width: "60%",
    height: 12,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
});
