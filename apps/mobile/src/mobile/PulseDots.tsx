import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

type Props = {
  /** Accent color of the dots. Defaults to the brand amber. */
  color?: string;
  /** Size of each dot in px. */
  size?: number;
  /** Optional caption rendered under the dots. */
  label?: string | null;
};

/**
 * Three dots that pulse in sequence (opacity + scale). Used as a simple,
 * friendly loading indicator in places where a static skeleton doesn't add
 * value — e.g. the journey language switch.
 */
export function PulseDots({ color = "#f8c15c", size = 10, label }: Props) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 420,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(180),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                opacity: dot,
                transform: [
                  {
                    scale: dot.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.7, 1.1],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 48,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dot: {},
  label: {
    color: "#9cb0c9",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
