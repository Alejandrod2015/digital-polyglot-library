import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

/**
 * Programmatic confetti burst rendered on top of the "session complete"
 * panel when the user nails a perfect score. Pure RN Animated — no new
 * native deps. ~28 particles fall + rotate + fade so the moment feels
 * like a small celebration without being noisy.
 *
 * The panel itself stays interactive; this component is pointer-events
 * none so taps fall through to the CTAs underneath.
 */

const PALETTE = ["#bef264", "#7dd3fc", "#fcd34d", "#f0abfc", "#fb923c"];
const PARTICLE_COUNT = 28;

type Particle = {
  startX: number;
  endY: number;
  delay: number;
  duration: number;
  rotateTo: number;
  color: string;
  size: number;
  driftX: number;
};

function buildParticles(width: number, height: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const dir = i % 2 === 0 ? -1 : 1;
    return {
      startX: Math.random() * width,
      // Fall most of the screen height; randomize so they don't all
      // land in a perfect line.
      endY: height * (0.55 + Math.random() * 0.4),
      delay: Math.random() * 250,
      duration: 1200 + Math.random() * 900,
      rotateTo: dir * (180 + Math.random() * 360),
      color: PALETTE[i % PALETTE.length] ?? "#bef264",
      size: 6 + Math.random() * 6,
      driftX: dir * (30 + Math.random() * 60),
    };
  });
}

export function PracticeCelebration({ active }: { active: boolean }) {
  const dims = Dimensions.get("window");
  const particles = useMemo(() => buildParticles(dims.width, dims.height), [dims.width, dims.height]);
  // One progress value per particle, all driven in parallel from
  // `active` flipping to true. We keep the refs across renders so a
  // re-mount of the parent with `active` already true still animates.
  const progressValues = useRef(particles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) return;
    progressValues.forEach((value, index) => {
      const particle = particles[index]!;
      value.setValue(0);
      Animated.timing(value, {
        toValue: 1,
        delay: particle.delay,
        duration: particle.duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [active, particles, progressValues]);

  if (!active) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle, index) => {
        const progress = progressValues[index]!;
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-30, particle.endY],
        });
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, particle.driftX],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${particle.rotateTo}deg`],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.1, 0.85, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                left: particle.startX,
                width: particle.size,
                height: particle.size * 1.6,
                backgroundColor: particle.color,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    top: 0,
    borderRadius: 2,
  },
});
