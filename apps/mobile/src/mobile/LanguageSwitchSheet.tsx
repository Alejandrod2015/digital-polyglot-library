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
 * Native bottom sheet showing the user's *journeys* (one row per
 * (language, focus) tuple). Triggered from the journey top-strip
 * flag tap. Tapping a row swaps the active journey; tapping the
 * single footer CTA opens the full-screen "Your journeys" panel
 * which is where new journeys are created.
 *
 * Visual parity notes vs. the web concept:
 *   - The flag is the language coin; a small focus icon overlays it
 *     so two journeys for the same language are visually distinct.
 *   - Drag-to-dismiss is implemented via PanResponder (no swipe
 *     gesture lib needed).
 *
 * The sheet is dumb: it receives the journey list + per-journey
 * stats from the shell and just calls `onSelect` / `onAdd`. All
 * persistence happens in the shell.
 */

export type LanguageSwitchEntry = {
  /** Stable journey id from `journeys.ts`. The shell resolves taps
   *  back to the full Journey via this. */
  id: string;
  /** Canonical language name — drives the flag coin. */
  language: string;
  /** Variant code (us/uk for English) so the flag picks the right
   *  regional rendering. null when the language has one flag. */
  variant: string | null;
  /** Pretty variant label shown next to the language name (LATAM,
   *  US, UK, BRAZIL, …). null when variant is null. */
  variantLabel: string | null;
  /** Pre-formatted display name: "Spanish · Travelers" /
   *  "English · Everyday" / etc. Computed in the shell so the sheet
   *  doesn't have to care about the focus → label mapping. */
  displayName: string;
  /** Coarse level shown after the streak/XP block (e.g. "B1"). */
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
  /** All journeys the user has, ordered as the shell wants them
   *  rendered (today: active first, then by recency). */
  journeys: LanguageSwitchEntry[];
  /** Activate a journey by its id. */
  onSelect: (id: string) => void | Promise<void>;
  /** Open the full-screen "Your journeys" panel where the user can
   *  add a new (language, focus) combination. */
  onAddJourney: () => void;
  /** When true, prepends an "All languages" row (used by Explore to
   *  disable the language filter while keeping cross-language
   *  browsing). The row is highlighted when `allActive` is true. */
  showAllOption?: boolean;
  /** Whether the "All" row should render as active. Ignored when
   *  `showAllOption` is false. */
  allActive?: boolean;
  /** Called when the user picks the "All languages" row. */
  onSelectAll?: () => void;
  /** Override the header eyebrow / title. Useful for Explore where
   *  "Switch journey" doesn't match the user's intent (they're picking
   *  a filter, not changing journeys). */
  headerEyebrow?: string;
  headerTitle?: string;
  /** Hide the "Add journey" footer (Explore doesn't need it). */
  hideFooter?: boolean;
};

// How far below the screen the sheet starts. Generous enough that
// the spring entry feels like a proper slide-up on tall devices.
// Hoisted above the component so we can use it as the initial value
// for the translateY Animated.Value (see "3-tap bug" note below).
const SHEET_TRAVEL = 720;

export function LanguageSwitchSheet({
  open,
  onClose,
  journeys,
  onSelect,
  onAddJourney,
  showAllOption = false,
  allActive = false,
  onSelectAll,
  headerEyebrow,
  headerTitle: headerTitleProp,
  hideFooter = false,
}: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  // IMPORTANT: initial value MUST be SHEET_TRAVEL (off-screen), not 0.
  // Earlier this was `new Animated.Value(0)` paired with a separate
  // useEffect that called `translateY.setValue(SHEET_TRAVEL)` on mount.
  // Effect ordering meant the reset effect ran *after* the open-
  // animation effect when `mounted` flipped to true — it cancelled the
  // spring mid-flight, leaving the sheet at 720 (off-screen) even
  // though `open === true` and the backdrop had faded in. The user
  // saw a dim backdrop and no sheet, tapped the backdrop (=close),
  // tapped the flag again, and only the *third* tap looked like it
  // worked. Initializing the value off-screen removes the need for
  // the reset effect entirely and the open animation runs cleanly on
  // the first tap.
  const translateY = useRef(new Animated.Value(SHEET_TRAVEL)).current;
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

  async function handleSelect(id: string) {
    if (switchingTo) return;
    const target = journeys.find((j) => j.id === id);
    if (target?.active) {
      onClose();
      return;
    }
    setSwitchingTo(id);
    try {
      await onSelect(id);
    } finally {
      setSwitchingTo(null);
    }
  }

  const headerCount = journeys.length;
  const defaultHeaderTitle =
    headerCount <= 1
      ? "Your journey"
      : `${headerCount} journeys in progress`;
  const finalHeaderTitle = headerTitleProp ?? defaultHeaderTitle;
  const finalHeaderEyebrow = headerEyebrow ?? "SWITCH JOURNEY";

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
          <Text style={styles.headerEyebrow}>{finalHeaderEyebrow}</Text>
          <Text style={styles.headerTitle}>{finalHeaderTitle}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {showAllOption ? (
            <Pressable
              key="__all__"
              onPress={() => {
                if (switchingTo) return;
                onSelectAll?.();
              }}
              style={[
                styles.row,
                allActive ? styles.rowActive : styles.rowInactive,
                switchingTo ? styles.rowDisabled : null,
              ]}
            >
              <View
                style={[
                  styles.flagRing,
                  {
                    borderColor: allActive
                      ? "rgba(252, 211, 77, 0.85)"
                      : "rgba(125, 211, 252, 0.55)",
                    backgroundColor: "rgba(125, 211, 252, 0.10)",
                  },
                ]}
              >
                <Feather name="globe" size={22} color="#dbe9ff" />
              </View>

              <View style={styles.rowMeta}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    All languages
                  </Text>
                </View>
                <View style={styles.rowStats}>
                  <Text style={styles.rowAllSubtitle} numberOfLines={1}>
                    Browse stories across every journey
                  </Text>
                </View>
              </View>

              {allActive ? (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
              ) : (
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.45)" />
              )}
            </Pressable>
          ) : null}
          {journeys.map((journey) => {
            const isSwitching = switchingTo === journey.id;
            const disabled = Boolean(switchingTo) && !isSwitching;
            return (
              <Pressable
                key={journey.id}
                disabled={disabled || isSwitching}
                onPress={() => void handleSelect(journey.id)}
                style={[
                  styles.row,
                  journey.active ? styles.rowActive : styles.rowInactive,
                  disabled ? styles.rowDisabled : null,
                ]}
              >
                <View
                  style={[
                    styles.flagRing,
                    {
                      borderColor: journey.active
                        ? "rgba(252, 211, 77, 0.85)"
                        : "rgba(125, 211, 252, 0.55)",
                    },
                  ]}
                >
                  <LanguageFlag language={journey.language} variant={journey.variant} size={36} />
                </View>

                <View style={styles.rowMeta}>
                  <View style={styles.rowTitleLine}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {journey.displayName}
                    </Text>
                    {journey.variantLabel ? (
                      <Text style={styles.rowVariant} numberOfLines={1}>
                        · {journey.variantLabel}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.rowStats}>
                    <View style={styles.rowStat}>
                      <Feather
                        name="zap"
                        size={11}
                        color={journey.streak > 0 ? tokenColor.streak : "rgba(255,255,255,0.45)"}
                      />
                      <Text
                        style={[
                          styles.rowStatText,
                          {
                            color:
                              journey.streak > 0 ? tokenColor.streak : "rgba(255,255,255,0.45)",
                          },
                        ]}
                      >
                        {journey.streak}
                      </Text>
                    </View>
                    <View style={styles.rowStat}>
                      <Feather name="star" size={11} color={tokenColor.xp} />
                      <Text style={[styles.rowStatText, { color: tokenColor.xp }]}>
                        {journey.xpTotal >= 1000
                          ? `${(journey.xpTotal / 1000).toFixed(1)}k`
                          : journey.xpTotal}
                      </Text>
                    </View>
                    {journey.level ? (
                      <View style={styles.rowLevelPill}>
                        <Text style={styles.rowLevelPillText}>{journey.level}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {isSwitching ? (
                  <View style={styles.rowSpinner}>
                    <Feather name="loader" size={16} color="rgba(255,255,255,0.7)" />
                  </View>
                ) : journey.active ? (
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

        {hideFooter ? null : (
          <View style={styles.footer}>
            {/* Single CTA — opens the full-screen "Your journeys"
                panel where the user manages all journeys + creates new
                ones. The sheet's "See all" button is gone because the
                panel itself is the see-all view. */}
            <Pressable
              onPress={() => {
                if (switchingTo) return;
                onAddJourney();
              }}
              style={[styles.footerButton, styles.footerButtonAccent, styles.footerButtonFull]}
            >
              <Feather name="plus" size={13} color={tokenColor.cyan} />
              <Text style={[styles.footerButtonText, { color: tokenColor.cyan }]}>
                Add journey
              </Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

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
    backgroundColor: "rgba(252, 211, 77, 0.10)",
    borderColor: "rgba(252, 211, 77, 0.4)",
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
    // Rounded square (≈22% of size) to match the LanguageFlag coin
    // shape change. A circular ring around a square flag would look
    // mismatched after the Duolingo-style update.
    borderRadius: 11,
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
  rowAllSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: -0.1,
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
  // Wider CTA when it's the only footer button (post-merge of "See
  // all" + "Add"). Gives the touch target more presence at the bottom
  // of the sheet without redesigning the whole footer chrome.
  footerButtonFull: {
    paddingVertical: 14,
  },
  footerButtonText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12.5,
    fontWeight: "800",
  },
});
