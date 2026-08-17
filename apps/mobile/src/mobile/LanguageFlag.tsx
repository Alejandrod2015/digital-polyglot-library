import { Feather } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

// Real Mexican coat of arms (public-domain govt emblem), overlaid on the
// tricolor's white band so Mexico reads faithfully at coin scale.
const MX_COAT = require("../../assets/flags/mx-coat.png");

/**
 * Mini flag rendered with native Views; no SVG, no emoji, no images.
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
  | { kind: "us" }
  | { kind: "uk" }
  | { kind: "brazil" }
  | { kind: "mexico" }
  | { kind: "all" };

// "Todos los idiomas" no es un país, así que no tiene bandera. Antes cada
// superficie improvisaba: el sheet metía un icono de Feather en el aro de
// banderas y el chip de Explore fingía Spanish + latam (o sea, decía
// "ES · Colombia" mientras el filtro real era TODOS). Este spec es el token
// único para ese estado: mismo cuadrado redondeado y mismo borde que las
// banderas, con un globo dibujado para que se lea como una pieza de la misma
// familia y no como un placeholder.
export const ALL_LANGUAGES = "__all__";

// Mapamundi en un espacio de diseño 100x100, vista Atlántico: América a la
// izquierda, Eurasia y África a la derecha. Silueta simplificada a propósito;
// a 28 pt lo que se lee es la masa, no la costa.
const OCEAN = "#12508f";
const LAND = "#9be8b4";
const WORLD_PATHS = [
  // Norteamérica
  "M2,12 q16,-8 32,-4 q10,3 7,10 q-3,7 -12,8 q-3,7 -10,7 q-6,0 -6,-7 q-13,-4 -11,-14 z",
  // Centroamérica
  "M27,38 q8,2 10,7 q1,4 -4,3 q-7,-1 -9,-6 q-1,-4 3,-4 z",
  // Sudamérica
  "M33,50 q13,-3 16,9 q3,13 -5,24 q-5,7 -9,2 q-4,-6 -3,-17 q0,-9 -5,-12 q-3,-4 6,-6 z",
  // Eurasia
  "M55,8 q22,-7 40,2 q6,3 3,9 q-4,7 -16,7 q-9,0 -14,-4 q-8,3 -14,-2 q-5,-5 1,-12 z",
  // África
  "M57,30 q15,-5 21,5 q5,10 -2,19 q-6,9 -11,15 q-5,4 -7,-4 q-2,-10 -1,-19 q0,-10 0,-16 z",
  // India
  "M82,30 q8,-2 9,5 q1,6 -5,9 q-5,2 -7,-3 q-2,-7 3,-11 z",
  // Australia
  "M85,68 q11,-4 14,4 q2,7 -5,10 q-8,3 -12,-3 q-3,-7 3,-11 z",
];

// Colombia flag spec, used as the LATAM variant for Spanish. We use
// a dedicated weighted hBands kind because the Colombian flag has a
// 2:1:1 ratio (yellow takes the top half, blue and red split the
// bottom half); distinct from any other flag in our set.
const COLOMBIA_SPEC: FlagSpec = {
  kind: "hBands",
  colors: ["#FCD116", "#003893", "#CE1126"],
  weights: [2, 1, 1],
};

// Country-specific LATAM flags. Journeys set in one country (Mexico, Colombia,
// Argentina) show THEIR flag instead of the generic Colombia=LATAM signal, so a
// "Traveler · Mexico" reads distinct from a pan-regional "Traveler · LATAM".
// Mexico = green/white/red vertical bands PLUS a center emblem, so it doesn't
// read as Italy (identical tricolor without the emblem). We can't draw the
// eagle at coin scale, so the emblem is a small dark-red disc in the middle.
const MEXICO_SPEC: FlagSpec = { kind: "mexico" };
const ARGENTINA_SPEC: FlagSpec = {
  kind: "hBands",
  colors: ["#74ACDF", "#FFFFFF", "#74ACDF"],
  weights: [1, 1, 1],
};

const SPECS: Record<string, FlagSpec> = {
  Italian: { kind: "vBands", colors: ["#008C45", "#F4F5F0", "#CD212A"] },
  German: { kind: "hBands", colors: ["#000000", "#DD0000", "#FFCE00"] },
  French: { kind: "vBands", colors: ["#0055A4", "#FFFFFF", "#EF4135"] },
  // Spanish in SPECS holds the Spain (ES) flag; red, gold, red
  // horizontal bands, weights 1:2:1. The LATAM variant uses the
  // Colombian flag (COLOMBIA_SPEC, hBands yellow/blue/red 2:1:1) and
  // is selected by `pickSpec("Spanish", "latam")`.
  Spanish: { kind: "hBands", colors: ["#AA151B", "#F1BF00", "#AA151B"], weights: [1, 2, 1] },
  Portuguese: { kind: "vBands", colors: ["#006600", "#FF0000"], weights: [2, 3] },
  English: { kind: "us" },
  Japanese: { kind: "japan" },
  Korean: { kind: "korea" },
  Chinese: { kind: "china" },
};


/**
 * Resolve the flag spec for a (language, variant) pair. Languages
 * with regional variants choose a different rendering based on the
 * variant code:
 *   - English → "us" (default) or "uk"
 *   - Portuguese → "br" (default; most learners) or "pt"
 *   - Spanish → "es" (default; Spain flag) or "latam" (Colombia
 *     flag, picked as a distinctive LATAM signal that's visually
 *     unrelated to Italy/Mexico/etc.)
 *
 * Both language + variant are normalized case-insensitively. We
 * also accept several aliases per region so a journey persisted with
 * "LATAM", "es-LA", a country code like "MX" / "CO", or even a
 * Studio Journey cuid stored alongside a separate region field still
 * resolves to the right flag.
 */
const LATAM_REGION_CODES = new Set<string>([
  "latam", "es-la", "es-419",
  // Country codes (lowercase) that imply LATAM Spanish.
  "mx", "co", "ar", "pe", "cl", "ec", "ve", "uy", "py", "bo", "cr", "pa", "do", "cu", "gt", "hn", "sv", "ni", "pr",
  // Spanish country names spelled out (some legacy data does this).
  "mexico", "colombia", "argentina", "peru", "chile", "ecuador", "venezuela", "uruguay", "paraguay", "bolivia",
]);
const SPAIN_REGION_CODES = new Set<string>(["es", "spain", "españa", "espana"]);
const UK_REGION_CODES = new Set<string>(["uk", "gb", "england", "britain", "united-kingdom"]);
const PORTUGAL_REGION_CODES = new Set<string>(["pt", "portugal"]);
// Brasil faltaba, y era el único hueco: el selector ofrece la variante como
// "br" y Studio la persiste como "brazil". Sin familia que los pliegue, el
// filtro por variante descartaba el journey y el paso 2 decía "No journeys
// available for Portuguese (BRAZIL) yet." con el journey publicado y servido.
// Portugal no lo sufría porque su familia ya casaba "pt" con "portugal".
const BRAZIL_REGION_CODES = new Set<string>(["br", "brazil", "brasil"]);
// Country-specific LATAM codes that get their OWN flag in pickSpec. NOTE: these
// stay inside LATAM_REGION_CODES so `regionFamily` still folds them into the
// "latam" family for variant MATCHING; only the flag rendering distinguishes them.
const MEXICO_CODES = new Set<string>(["mexico", "mx"]);
const COLOMBIA_CODES = new Set<string>(["colombia", "co"]);
const ARGENTINA_CODES = new Set<string>(["argentina", "ar"]);

/**
 * Canonical region family for a variant/region code, so equivalents like
 * "es"/"spain" or "mx"/"latam" compare equal. Used to match a picked
 * language variant against a journey's stored variant (a Spain pick must not
 * surface LATAM journeys). Returns the lowercased input when it doesn't
 * belong to a known family (e.g. "us" matches itself).
 *
 * Toda variante que el selector ofrezca con un código corto tiene que tener
 * aquí su familia: el selector usa códigos de dos letras y Studio persiste el
 * nombre del país, así que sin familia NUNCA casan y el journey desaparece en
 * silencio, sin error ni aviso. Es lo que le pasó a Brasil.
 */
export function regionFamily(code: string | null | undefined): string {
  const v = (code ?? "").trim().toLowerCase();
  if (!v) return "";
  if (LATAM_REGION_CODES.has(v)) return "latam";
  if (SPAIN_REGION_CODES.has(v)) return "spain";
  if (UK_REGION_CODES.has(v)) return "uk";
  if (PORTUGAL_REGION_CODES.has(v)) return "pt";
  if (BRAZIL_REGION_CODES.has(v)) return "brazil";
  return v;
}

function normLang(language: string | null | undefined): string | undefined {
  if (!language) return undefined;
  const trimmed = language.trim();
  if (!trimmed) return undefined;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function pickSpec(language: string | null | undefined, variant?: string | null): FlagSpec | undefined {
  const raw = (language ?? "").trim().toLowerCase();
  if (raw === ALL_LANGUAGES || raw === "all") return { kind: "all" };
  const lang = normLang(language);
  if (!lang) return undefined;
  const v = variant?.trim().toLowerCase() ?? "";
  if (lang === "English") {
    return UK_REGION_CODES.has(v) ? { kind: "uk" } : { kind: "us" };
  }
  if (lang === "Portuguese") {
    return PORTUGAL_REGION_CODES.has(v) ? SPECS.Portuguese : { kind: "brazil" };
  }
  if (lang === "Spanish") {
    // Country-specific journeys get THEIR own flag; checked BEFORE the LATAM
    // catch-all (which contains these same codes). The pan-regional "latam"
    // journey keeps the Colombia flag as its LATAM signal. Spain wins on
    // explicit "es"/"spain". Anything unrecognized (e.g. a Studio cuid) falls
    // back to Spain, the previous safe default.
    if (MEXICO_CODES.has(v)) return MEXICO_SPEC;
    if (COLOMBIA_CODES.has(v)) return COLOMBIA_SPEC;
    if (ARGENTINA_CODES.has(v)) return ARGENTINA_SPEC;
    if (LATAM_REGION_CODES.has(v)) return COLOMBIA_SPEC;
    if (SPAIN_REGION_CODES.has(v)) return SPECS.Spanish;
    return SPECS.Spanish;
  }
  return SPECS[lang];
}

export function LanguageFlag({
  language,
  size = 28,
  variant,
}: {
  language: string | null | undefined;
  size?: number;
  variant?: string | null;
}) {
  const spec = pickSpec(language, variant);
  // Rounded square (Duolingo-style) instead of full circle. Real
  // flags are rectangular, so a circular coin clipped the corners of
  // banded flags (Germany, Italy, France, Mexico, Spain). The 22%
  // radius keeps the rounded look while preserving full bands.
  // Radial flags (Japan, China, Brazil) still render correctly
  // because their composition is centered.
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size * 0.22,
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

  if (spec.kind === "all") {
    // La Tierra LLENA el círculo, como una bandera llena su cuadro. Un globo
    // pequeño dentro del recuadro no sirve: a 28 pt el disco queda tan chico
    // que los continentes desaparecen y solo se ve un punto azul (probado en
    // device). Redonda a propósito: es la única pieza no cuadrada del set, así
    // que se lee de un vistazo como "esto no es un país".
    return (
      <View
        style={[
          containerStyle,
          { borderRadius: size / 2, backgroundColor: OCEAN },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {WORLD_PATHS.map((d, i) => (
            <Path key={i} d={d} fill={LAND} />
          ))}
        </Svg>
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

  if (spec.kind === "mexico") {
    return (
      <View style={[containerStyle, styles.row]}>
        <View style={{ flex: 1, backgroundColor: "#006847" }} />
        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />
        <View style={{ flex: 1, backgroundColor: "#CE1126" }} />
        {/* Real coat of arms, centered EXACTLY on the white band. Overlay a
            row of 3 equal cells matching the tricolor and center the emblem in
            the MIDDLE cell; this tracks the white band precisely at any size,
            unlike pixel `left` math which the container border pushed ~1.5px
            right into the red band. */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, flexDirection: "row" }}
        >
          <View style={{ flex: 1 }} />
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Image
              source={MX_COAT}
              resizeMode="contain"
              style={{ width: size * 0.3, height: size * 0.3 }}
            />
          </View>
          <View style={{ flex: 1 }} />
        </View>
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

  if (spec.kind === "brazil") {
    // Brazilian flag approximation: green field + yellow rhombus
    // (a 45°-rotated square inscribed inside the round coin) +
    // a small blue circle at the center. Skipping the celestial
    // sphere stars + "Ordem e Progresso" banner because Views
    // can't reasonably draw those at coin scale; the green/
    // yellow/blue palette is the recognizable signal.
    const greenBg = "#009C3B";
    const yellow = "#FFDF00";
    const blue = "#002776";
    // Square side chosen so its diagonal ≈ 95% of the inner coin
    // diameter. Diagonal = side * √2 → side = diameter * 0.95 / √2.
    const inner = size - 3; // minus the 1.5pt border each side
    const rhombusSide = (inner * 0.95) / Math.SQRT2;
    const blueCircleSize = size * 0.32;
    return (
      <View style={[containerStyle, styles.center, { backgroundColor: greenBg }]}>
        <View
          style={{
            position: "absolute",
            width: rhombusSide,
            height: rhombusSide,
            backgroundColor: yellow,
            transform: [{ rotate: "45deg" }],
          }}
        />
        <View
          style={{
            position: "absolute",
            width: blueCircleSize,
            height: blueCircleSize,
            borderRadius: blueCircleSize / 2,
            backgroundColor: blue,
          }}
        />
      </View>
    );
  }

  if (spec.kind === "uk") {
    // Union Jack approximation. We can't render diagonal lines with
    // plain Views, so we fake the saltires (white + red X) with two
    // long thin Views rotated 45°/-45° and overlay the upright
    // white-and-red cross on top. It's a stylized read but clearly
    // distinct from the US flag, which is the whole point of having
    // a separate UK variant.
    const blue = "#012169";
    const white = "#FFFFFF";
    const red = "#C8102E";
    // Diagonal bar length must reach corner-to-corner of the square,
    // so it's the diagonal of the box: size * sqrt(2). We pad a bit
    // to make sure it bleeds past the rounded edge before clipping.
    const diag = size * 1.45;
    return (
      <View style={[containerStyle, styles.center, { backgroundColor: blue }]}>
        {/* White saltire (X); two crossed bars */}
        <View
          style={{
            position: "absolute",
            width: diag,
            height: size * 0.22,
            backgroundColor: white,
            transform: [{ rotate: "45deg" }],
          }}
        />
        <View
          style={{
            position: "absolute",
            width: diag,
            height: size * 0.22,
            backgroundColor: white,
            transform: [{ rotate: "-45deg" }],
          }}
        />
        {/* Red saltire on top of white, slightly thinner */}
        <View
          style={{
            position: "absolute",
            width: diag,
            height: size * 0.1,
            backgroundColor: red,
            transform: [{ rotate: "45deg" }],
          }}
        />
        <View
          style={{
            position: "absolute",
            width: diag,
            height: size * 0.1,
            backgroundColor: red,
            transform: [{ rotate: "-45deg" }],
          }}
        />
        {/* White upright cross; horizontal + vertical bars */}
        <View
          style={{
            position: "absolute",
            width: size,
            height: size * 0.32,
            backgroundColor: white,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: size * 0.32,
            height: size,
            backgroundColor: white,
          }}
        />
        {/* Red upright cross on top of white, thinner */}
        <View
          style={{
            position: "absolute",
            width: size,
            height: size * 0.18,
            backgroundColor: red,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: size * 0.18,
            height: size,
            backgroundColor: red,
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
