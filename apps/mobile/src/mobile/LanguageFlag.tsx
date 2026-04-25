import { StyleSheet, View } from "react-native";

/**
 * Mini flag rendered with native Views — no SVG, no emoji, no images.
 * The look is a circular crop with a subtle border + drop shadow,
 * matching the language indicator in the design handoff.
 *
 * Each language is described as either:
 *   - a set of bands (vertical or horizontal) with optional weights, or
 *   - a "complex" flag we draw with an inset shape (Japan / China / KR).
 *
 * Anything we don't recognize falls back to a neutral dark circle.
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
  // Spanish flag uses a wider yellow center band (the real flag is 1:2:1).
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#314e7a",
  };

  if (!spec) {
    return <View style={containerStyle} />;
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
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: (size * 0.6) / 2,
            backgroundColor: "#BC002D",
          }}
        />
      </View>
    );
  }

  if (spec.kind === "china") {
    // Simplified: red field with a single yellow disc (the real flag has
    // 5 stars, not feasible without SVG and probably overkill at 28pt).
    return (
      <View style={[containerStyle, styles.center, { backgroundColor: "#DE2910" }]}>
        <View
          style={{
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: (size * 0.36) / 2,
            backgroundColor: "#FFDE00",
          }}
        />
      </View>
    );
  }

  if (spec.kind === "korea") {
    // Half-blue / half-red disc on white — a stylized nod to Taegukgi
    // without trying to draw the trigrams.
    return (
      <View style={[containerStyle, styles.center, { backgroundColor: "#FFFFFF" }]}>
        <View
          style={{
            width: size * 0.66,
            height: size * 0.66,
            borderRadius: (size * 0.66) / 2,
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
    // Three solid bands in red/white/blue. Doesn't try to draw the canton
    // or 13 stripes — at this size a clean tricolor reads better.
    return (
      <View style={containerStyle}>
        <View style={{ flex: 1, backgroundColor: "#B22234" }} />
        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />
        <View style={{ flex: 1, backgroundColor: "#3C3B6E" }} />
      </View>
    );
  }

  return <View style={containerStyle} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  center: { alignItems: "center", justifyContent: "center" },
});
