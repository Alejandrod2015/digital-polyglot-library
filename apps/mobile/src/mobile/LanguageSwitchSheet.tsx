import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LanguageFlag } from "./LanguageFlag";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";

/**
 * Native bottom sheet that mirrors the web LanguageSwitcher (variant
 * B). Triggered from the journey top-strip flag tap and replaces the
 * old "My Languages" full-screen hub.
 *
 * Visual parity notes vs. the web version:
 *   - Per-language progress is rendered as a solid color ring around
 *     the flag (lime when active, sky when inactive) instead of an
 *     SVG arc segment — react-native-svg isn't installed here and
 *     adding it would force a rebuild fingerprint change. The flag
 *     itself uses the in-house <LanguageFlag/> coin component.
 *   - Drag-to-dismiss and Escape are implemented via PanResponder
 *     (no swipe gesture lib needed) and a hardware-back equivalent
 *     isn't relevant on iOS-first.
 *
 * The sheet is dumb: it receives the language list + per-language
 * stats from the shell and just calls `onSelect` / `onAdd` /
 * `onSeeAll`. All Clerk metadata writes happen in the shell.
 */

export type LanguageSwitchEntry = {
  name: string;
  variant: string | null;
  variantLabel: string | null;
  level: string | null;
  active: boolean;
  streak: number;
  xpTotal: number;
  /** 0–100 — currently rendered as ring color only; future SVG arc. */
  progress: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  languages: LanguageSwitchEntry[];
  onSelect: (name: string) => void | Promise<void>;
  onAddLanguage: () => void;
  onSeeAll: () => void;
};

export function LanguageSwitchSheet({
  open,
  onClose,
  languages,
  onSelect,
  onAddLanguage,
  onSeeAll,
}: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  // Sync mount: keep the tree alive during the exit animation so the
  // slide-down has time to play before unmount.
  useEffect(() => {
    if (open) {
      setMounted(true);
      dragY.setValue(0);
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
  }, [open, mounted, backdrop, translateY, dragY]);

  // Reset translate to off-screen on first mount so the entry spring
  // has a starting point.
  useEffect(() => {
    if (mounted) translateY.setValue(SHEET_TRAVEL);
  }, [mounted, translateY]);

  // Drag-to-dismiss. We only respond on downward drag — upward drag
  // just elastics back. Release > 80 pt or velocity > 800 closes.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80 || gesture.vy > 0.8) {
            onClose();
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              damping: 22,
              stiffness: 220,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, {
            toValue: 0,
            damping: 22,
            stiffness: 220,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dragY, onClose]
  );

  if (!mounted) return null;

  async function handleSelect(name: string) {
    if (switchingTo) return;
    const target = languages.find((l) => l.name === name);
    if (target?.active) {
      onClose();
      return;
    }
    setSwitchingTo(name);
    try {
      await onSelect(name);
    } finally {
      setSwitchingTo(null);
    }
  }

  const headerCount = languages.length;
  const headerTitle =
    headerCount <= 1
      ? "Your journey"
      : `${headerCount} journeys in progress`;

  return (
    <View style={styles.fill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdrop }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onClose()} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [
              { translateY: Animated.add(translateY, dragY) },
            ],
          },
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.grabberArea}>
          <View style={styles.grabber} />
        </View>

        <View style={styles.headerBlock}>
          <Text style={styles.headerEyebrow}>SWITCH LANGUAGE</Text>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {languages.map((lang) => {
            const isSwitching = switchingTo === lang.name;
            const disabled = Boolean(switchingTo) && !isSwitching;
            return (
              <Pressable
                key={lang.name}
                disabled={disabled || isSwitching}
                onPress={() => void handleSelect(lang.name)}
                style={[
                  styles.row,
                  lang.active ? styles.rowActive : styles.rowInactive,
                  disabled ? styles.rowDisabled : null,
                ]}
              >
                <View
                  style={[
                    styles.flagRing,
                    {
                      borderColor: lang.active
                        ? "rgba(190, 242, 100, 0.85)"
                        : "rgba(125, 211, 252, 0.55)",
                    },
                  ]}
                >
                  <LanguageFlag language={lang.name} size={36} />
                </View>

                <View style={styles.rowMeta}>
                  <View style={styles.rowTitleLine}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {lang.name}
                    </Text>
                    {lang.variantLabel ? (
                      <Text style={styles.rowVariant} numberOfLines={1}>
                        · {lang.variantLabel}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.rowStats}>
                    <View style={styles.rowStat}>
                      <Feather
                        name="zap"
                        size={11}
                        color={lang.streak > 0 ? tokenColor.streak : "rgba(255,255,255,0.45)"}
                      />
                      <Text
                        style={[
                          styles.rowStatText,
                          {
                            color:
                              lang.streak > 0 ? tokenColor.streak : "rgba(255,255,255,0.45)",
                          },
                        ]}
                      >
                        {lang.streak}
                      </Text>
                    </View>
                    <View style={styles.rowStat}>
                      <Feather name="star" size={11} color={tokenColor.xp} />
                      <Text style={[styles.rowStatText, { color: tokenColor.xp }]}>
                        {lang.xpTotal >= 1000
                          ? `${(lang.xpTotal / 1000).toFixed(1)}k`
                          : lang.xpTotal}
                      </Text>
                    </View>
                    {lang.level ? (
                      <View style={styles.rowLevelPill}>
                        <Text style={styles.rowLevelPillText}>{lang.level}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {isSwitching ? (
                  <View style={styles.rowSpinner}>
                    <Feather name="loader" size={16} color="rgba(255,255,255,0.7)" />
                  </View>
                ) : lang.active ? (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                ) : (
                  <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.45)" />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              if (switchingTo) return;
              onSeeAll();
            }}
            style={[styles.footerButton, styles.footerButtonNeutral]}
          >
            <Feather name="settings" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.footerButtonText}>See all</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (switchingTo) return;
              onAddLanguage();
            }}
            style={[styles.footerButton, styles.footerButtonAccent]}
          >
            <Feather name="plus" size={13} color={tokenColor.cyan} />
            <Text style={[styles.footerButtonText, { color: tokenColor.cyan }]}>
              Add language
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// How far below the screen the sheet starts. Generous enough that
// the spring entry feels like a proper slide-up on tall devices.
const SHEET_TRAVEL = 720;

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 24, 52, 0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "85%",
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
  grabberArea: {
    paddingVertical: 10,
    alignItems: "center",
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  headerBlock: {
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 4,
  },
  headerEyebrow: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 2.3,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  rowActive: {
    backgroundColor: "rgba(190, 242, 100, 0.10)",
    borderColor: "rgba(190, 242, 100, 0.4)",
    borderWidth: 1.5,
  },
  rowInactive: {
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  rowDisabled: {
    opacity: 0.4,
  },
  flagRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  rowName: {
    color: "#ffffff",
    fontSize: 15.5,
    fontWeight: "900",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  rowVariant: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "700",
  },
  rowStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  rowStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  rowStatText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  rowLevelPill: {
    backgroundColor: "rgba(125, 211, 252, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rowLevelPillText: {
    color: tokenColor.cyan,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  activePill: {
    backgroundColor: tokenColor.xp,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activePillText: {
    color: "#0a2b56",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  rowSpinner: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingTop: 12,
    marginTop: 4,
  },
  footerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  footerButtonNeutral: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  footerButtonAccent: {
    backgroundColor: "rgba(125, 211, 252, 0.08)",
    borderColor: "rgba(125, 211, 252, 0.28)",
  },
  footerButtonText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12.5,
    fontWeight: "800",
  },
});
