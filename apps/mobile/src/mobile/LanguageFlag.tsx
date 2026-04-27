import { Feather } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

/**
 * Mini flag rendered with native Views — no SVG, no emoji, no images.
 *
 * Single container (border + clip) with the flag artwork placed
 * directly inside. Earlier revisions used a nested outer-ring +
 * inner-circle structure with `StyleSheet.absoluteFill` children;
 * that combo intermittently misclipped on iOS (overflow:hidden +
 * borderRadius + absolute children) and produced a near-invisible
 * coin against the dark page background. This flat structure is
 * the reliable shape: one View with the flag bands as direct flex
 * children, no absolute positioning.
 *
 * Languages we don't have a recipe for fall back to a globe icon
 * so the chip always renders as obviously a flag, never an empty
 * dark dot.
 */

type FlagSpec =
  | { kind: "vBands"; colors: string[]; weights?: number[] }
  | { kind: "hBands"; colors: string[]; weights?: number[] }
  | { kind: "japan" }
  | { kind: "china" }
  | { kind: "korea" }
  | { kind: "us" };

const SPECS: Record<string, FlagSpec> = {
  Italian: { kind: "vBands", colors: ["#008C45", "#F4F5F0", "#CD212A"] },
  German: { kind: "hBands", colors: ["#000000", "#DD0000", "#FFCE00"] },
  French: { kind: "vBands", colors: ["#0055A4", "#FFFFFF", "#EF4135"] },
  Spanish: { kind: "hBands", colors: ["#AA151B", "#F1BF00", "#AA151B"], weights: [1, 2, 1] },
  Portuguese: { kind: "vBands", colors: ["#006600", "#FF0000"], weights: [2, 3] },
  English: { kind: "us" },
  Japanese: { kind: "japan" },
  Korean: { kind: "korea" },
  Chinese: { kind: "china" },
};

export function LanguageFlag({
  language,
  size = 28,
}: {
  language: string | null | undefined;
  size?: number;
}) {
  const spec = language ? SPECS[language] : undefined;
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: "hidden" as const,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "#1d437a",
  };

  // Unknown / null language → globe glyph centered. Visible against
  // any background; never a dim dot.
  if (!spec) {
    return (
      <View style={[containerStyle, styles.center]}>
        <Feather name="globe" size={Math.max(12, size * 0.55)} color="#cdd9ec" />
      </View>
    );
  }

  if (spec.kind === "vBands") {
    return (
      <View style={[containerStyle, styles.row]}>
        {spec.colors.map((color, i) => (
          <View
            key={`${color}-${i}`}
            style={{ flex: spec.weights?.[i] ?? 1, backgroundColor: color }}
          />
        ))}
      </View>
    );
  }

  if (spec.kind === "hBands") {
    return (
      <View style={containerStyle}>
        {spec.colors.map((color, i) => (
          <View
            key={`${color}-${i}`}
            style={{ flex: spec.weights?.[i] ?? 1, backgroundColor: color }}
          />
        ))}
      </View>
    );
  }

  if (spec.kind === "japan") {
    return (
      <View style={[containerStyle, styles.center, { backgroundColor: "#FFFFFF" }]}>
        <View
          style={{
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: (size * 0.5) / 2,
            backgroundColor: "#BC002D",
          }}
        />
      </View>
    );
  }

  if (spec.kind === "china") {
    return (
      <View style={[containerStyle, styles.center, { backgroundColor: "#DE2910" }]}>
        <View
          style={{
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: (size * 0.3) / 2,
            backgroundColor: "#FFDE00",
          }}
        />
      </View>
    );
  }

  if (spec.kind === "korea") {
    return (
      <View style={[containerStyle, styles.center, { backgroundColor: "#FFFFFF" }]}>
        <View
          style={{
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: (size * 0.55) / 2,
            overflow: "hidden",
            flexDirection: "row",
          }}
        >
          <View style={{ flex: 1, backgroundColor: "#003478" }} />
          <View style={{ flex: 1, backgroundColor: "#C60C30" }} />
        </View>
      </View>
    );
  }

  if (spec.kind === "us") {
    // Stars-and-stripes approximation: 7 alternating red/white
    // stripes + a blue canton in the top-left. Without this the
    // tricolor red/white/blue read identically to the Dutch flag.
    return (
      <View style={containerStyle}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: i % 2 === 0 ? "#B22234" : "#FFFFFF",
            }}
          />
        ))}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "44%",
            height: "54%",
            backgroundColor: "#3C3B6E",
          }}
        />
      </View>
    );
  }

  return (
    <View style={[containerStyle, styles.center]}>
      <Feather name="globe" size={Math.max(12, size * 0.55)} color="#cdd9ec" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  center: { alignItems: "center", justifyContent: "center" },
});
