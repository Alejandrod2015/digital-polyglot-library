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
  // Outer ring: dark navy with a thin white edge so the flag looks
  // like a coin / avatar instead of a bare clipped circle. The actual
  // flag artwork lives inside, smaller, so the bands aren't bleeding
  // off the circumference. ~80% of the diameter for the artwork keeps
  // the bands readable while leaving a clean rim.
  const inner = Math.round(size * 0.84);
  const ringStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: "#0c1626",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  const innerCircleStyle = {
    width: inner,
    height: inner,
    borderRadius: inner / 2,
    overflow: "hidden" as const,
    backgroundColor: "#314e7a",
  };

  function wrap(content: React.ReactNode) {
    return (
      <View style={ringStyle}>
        <View style={innerCircleStyle}>{content}</View>
      </View>
    );
  }

  if (!spec) {
    return wrap(null);
  }

  if (spec.kind === "vBands") {
    return wrap(
      <View style={[StyleSheet.absoluteFill, styles.row]}>
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
    return wrap(
      <View style={StyleSheet.absoluteFill}>
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
    return wrap(
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "#FFFFFF" }]}>
        <View
          style={{
            width: inner * 0.55,
            height: inner * 0.55,
            borderRadius: (inner * 0.55) / 2,
            backgroundColor: "#BC002D",
          }}
        />
      </View>
    );
  }

  if (spec.kind === "china") {
    // Simplified: red field with a single yellow disc (the real flag has
    // 5 stars, not feasible without SVG and probably overkill at 28pt).
    return wrap(
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "#DE2910" }]}>
        <View
          style={{
            width: inner * 0.32,
            height: inner * 0.32,
            borderRadius: (inner * 0.32) / 2,
            backgroundColor: "#FFDE00",
          }}
        />
      </View>
    );
  }

  if (spec.kind === "korea") {
    // Half-blue / half-red disc on white — a stylized nod to Taegukgi
    // without trying to draw the trigrams.
    return wrap(
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "#FFFFFF" }]}>
        <View
          style={{
            width: inner * 0.6,
            height: inner * 0.6,
            borderRadius: (inner * 0.6) / 2,
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
    return wrap(
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, backgroundColor: "#B22234" }} />
        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />
        <View style={{ flex: 1, backgroundColor: "#3C3B6E" }} />
      </View>
    );
  }

  return wrap(null);
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  center: { alignItems: "center", justifyContent: "center" },
});
