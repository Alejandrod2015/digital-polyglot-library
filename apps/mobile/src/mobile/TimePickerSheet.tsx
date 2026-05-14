import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { bg as tokenBg } from "../theme/tokens";

/**
 * Wheel-style time picker sheet (JS-only, no native dep). Two scrollable
 * columns: hours 0-23 and minutes in 15-minute steps (00, 15, 30, 45).
 * The selected row sits at the center under an accent band. iOS-clock
 * style.
 *
 * NOT using `@react-native-community/datetimepicker` because installing
 * a new native dep here would require `pod install`, which is blocked
 * by a Ruby encoding bug in this machine's CocoaPods setup.
 */

type Props = {
  open: boolean;
  initialHour: number;
  initialMinute: number;
  onClose: () => void;
  onConfirm: (hour: number, minute: number) => void;
};

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const COLUMN_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const SHEET_TRAVEL = 520;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function TimePickerSheet({
  open,
  initialHour,
  initialMinute,
  onClose,
  onConfirm,
}: Props) {
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SHEET_TRAVEL)).current;
  const [mounted, setMounted] = useState(open);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (open) {
      setHour(initialHour);
      setMinute(initialMinute);
    }
  }, [open, initialHour, initialMinute]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 26,
          stiffness: 240,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SHEET_TRAVEL,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, mounted, backdrop, translateY]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const hourIdx = HOURS.indexOf(hour);
      const minIdx = MINUTES.indexOf(Math.round(minute / 15) * 15);
      hourScrollRef.current?.scrollTo({
        y: Math.max(0, hourIdx) * ROW_HEIGHT,
        animated: false,
      });
      minuteScrollRef.current?.scrollTo({
        y: Math.max(0, minIdx) * ROW_HEIGHT,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function makeOnMomentumEnd(
    setter: (value: number) => void,
    values: number[]
  ) {
    return (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ROW_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      setter(values[clamped]);
    };
  }

  const wheel = useMemo(
    () =>
      function Wheel({
        values,
        selected,
        scrollRef,
        onMomentumEnd,
      }: {
        values: number[];
        selected: number;
        scrollRef: React.RefObject<ScrollView | null>;
        onMomentumEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
      }) {
        return (
          <ScrollView
            ref={scrollRef}
            style={styles.wheel}
            showsVerticalScrollIndicator={false}
            snapToInterval={ROW_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={onMomentumEnd}
            contentContainerStyle={{ paddingVertical: ROW_HEIGHT * 2 }}
          >
            {values.map((value) => {
              const isSelected = value === selected;
              return (
                <View key={value} style={styles.wheelRow}>
                  <Text
                    style={[
                      styles.wheelLabel,
                      isSelected ? styles.wheelLabelActive : null,
                    ]}
                  >
                    {pad(value)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        );
      },
    []
  );

  if (!mounted) return null;

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdrop }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        <View style={styles.grabberArea}>
          <View style={styles.grabber} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Daily reminder time</Text>
          <Text style={styles.subtitle}>
            {pad(hour)}:{pad(minute)}
          </Text>
        </View>

        <View style={styles.wheels}>
          <View style={styles.wheelHighlight} pointerEvents="none" />
          {wheel({
            values: HOURS,
            selected: hour,
            scrollRef: hourScrollRef,
            onMomentumEnd: makeOnMomentumEnd(setHour, HOURS),
          })}
          <Text style={styles.colon}>:</Text>
          {wheel({
            values: MINUTES,
            selected: minute,
            scrollRef: minuteScrollRef,
            onMomentumEnd: makeOnMomentumEnd(setMinute, MINUTES),
          })}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={[styles.btn, styles.btnGhost]}
            accessibilityRole="button"
          >
            <Text style={styles.btnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(hour, minute)}
            style={[styles.btn, styles.btnPrimary]}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryText}>Confirm</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 90 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 24, 52, 0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokenBg[1],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 14,
  },
  grabberArea: { paddingVertical: 10, alignItems: "center" },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  header: { paddingHorizontal: 22, paddingBottom: 12, alignItems: "center", gap: 4 },
  title: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  subtitle: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  wheels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: COLUMN_HEIGHT,
    paddingHorizontal: 24,
    position: "relative",
  },
  wheelHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: COLUMN_HEIGHT / 2 - ROW_HEIGHT / 2,
    height: ROW_HEIGHT,
    backgroundColor: "rgba(125, 211, 252, 0.10)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.28)",
  },
  wheel: { width: 80, height: COLUMN_HEIGHT },
  wheelRow: {
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  wheelLabelActive: { color: "#ffffff", fontWeight: "900" },
  colon: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    marginHorizontal: 6,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnGhost: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  btnGhostText: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "800" },
  btnPrimary: {
    backgroundColor: "rgba(125, 211, 252, 0.12)",
    borderColor: "rgba(125, 211, 252, 0.36)",
  },
  btnPrimaryText: { color: "#7dd3fc", fontSize: 14, fontWeight: "900" },
});
