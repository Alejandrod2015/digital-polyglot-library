import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle, type StyleProp } from "react-native";

type Props = {
  active: boolean;
  borderRadius?: number;
  /** Inset (in px) of the outer glow from the wrapped child. Negative = outside. */
  inset?: number;
  color?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps any view with a soft pulsing amber ring to flag "this is the next
 * logical action" — the story or topic the user is expected to tap next.
 *
 * The animation runs as long as `active` is true and uses the native driver
 * (opacity only) so it stays smooth even on slower devices. Two concentric
 * rings pulse in opposite phase for a halo-like effect without needing a
 * platform-specific shadow/blur.
 */
export function NextActionGlow({
  active,
  borderRadius = 20,
  inset = -4,
  color = "#f8c15c",
  children,
  style,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active) {
    return <View style={style}>{children}</View>;
  }

  const innerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] });
  const outerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.4] });
  const outerScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <View style={style}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            top: inset - 6,
            left: inset - 6,
            right: inset - 6,
            bottom: inset - 6,
            borderRadius: borderRadius + 6,
            borderWidth: 2,
            borderColor: color,
            opacity: outerOpacity,
            transform: [{ scale: outerScale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            top: inset,
            left: inset,
            right: inset,
            bottom: inset,
            borderRadius: borderRadius + 2,
            borderWidth: 2,
            borderColor: color,
            opacity: innerOpacity,
          },
        ]}
      />
      {children}
    </View>
  );
}
