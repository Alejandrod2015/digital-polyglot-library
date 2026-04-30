import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";

/**
 * Bottom sheet that consolidates the five legal links (Impressum,
 * Privacy, Cookies, Terms, Data deletion) under a single "Legal"
 * entry in the side menu. Replaces the inline list that used to
 * sit at the bottom of the menu and ate ~5 rows of vertical space.
 *
 * Same animation pattern as `LanguageSwitchSheet` — slide up from
 * the bottom, backdrop fade-in, dismiss via backdrop tap or the
 * close button. Drag-to-dismiss is intentionally omitted: the link
 * list is short and a tap-to-close model is enough.
 */

export type LegalLink = {
  /** Stable key for keying + identifying the row internally. */
  key: string;
  /** User-facing label. */
  label: string;
  /** Web path opened via the shell's `openWebPath` helper. */
  path: string;
};

export const LEGAL_LINKS: LegalLink[] = [
  { key: "impressum", label: "Impressum", path: "/impressum" },
  { key: "privacy", label: "Privacy", path: "/privacy" },
  { key: "cookies", label: "Cookies", path: "/cookies" },
  { key: "terms", label: "Terms", path: "/terms" },
  { key: "data-deletion", label: "Data deletion", path: "/data-deletion" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (link: LegalLink) => void | Promise<void>;
};

// How far below the screen the sheet starts. Hoisted so we can use
// it as the initial value for the Animated.Value (same race-fix
// pattern as LanguageSwitchSheet).
const SHEET_TRAVEL = 480;

export function LegalSheet({ open, onClose, onSelect }: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SHEET_TRAVEL)).current;
  const [mounted, setMounted] = useState(open);

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
        style={[
          styles.sheet,
          { transform: [{ translateY }] },
        ]}
      >
        <View style={styles.headerBlock}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerEyebrow}>LEGAL</Text>
            <Text style={styles.headerTitle}>Policies & disclosures</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
            <Feather name="x" size={18} color="#dbe9ff" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {LEGAL_LINKS.map((link) => (
            <Pressable
              key={link.key}
              onPress={() => void onSelect(link)}
              style={({ pressed }) => [
                styles.row,
                pressed ? styles.rowPressed : null,
              ]}
              accessibilityRole="link"
              accessibilityLabel={`Open ${link.label}`}
            >
              <View style={styles.iconWrap}>
                <Feather name="shield" size={15} color={tokenColor.cyan} />
              </View>
              <Text style={styles.rowLabel}>{link.label}</Text>
              <Feather name="external-link" size={14} color="rgba(255,255,255,0.45)" />
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 85,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokenBg[1],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 14,
  },
  headerBlock: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 10,
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 2.3,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  rowPressed: {
    backgroundColor: "rgba(125, 211, 252, 0.1)",
    borderColor: "rgba(125, 211, 252, 0.3)",
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(125, 211, 252, 0.12)",
  },
  rowLabel: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
