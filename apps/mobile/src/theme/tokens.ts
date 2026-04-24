/**
 * Mobile design tokens — mirrors the web tokens in src/app/globals.css so
 * the two surfaces stay visually consistent. Source of truth for the
 * palette and type scale is the handoff in .claude/handoff/.
 *
 * Import usage in StyleSheet.create:
 *   import { bg, color, font, fontSize } from "../theme/tokens";
 *   ...
 *   backgroundColor: bg[2],
 *   color: color.xp,
 *   fontFamily: font.title,
 */

/**
 * Background elevation scale. bg[0] is the darkest base canvas;
 * bg[4] is the lightest elevated surface. Use them for stacked
 * panels (dialog over card over page, etc.).
 */
export const bg = {
  0: "#051834",
  1: "#08264d",
  2: "#0a2b56",
  3: "#13315e",
  4: "#1d437a",
} as const;

/**
 * Semantic accents — named by product meaning (streak, xp, gems)
 * rather than hue so a future palette swap ripples through all usages
 * without a grep-and-replace.
 */
export const color = {
  cyan: "#7dd3fc", // links, sky CTAs
  xp: "#bef264", // XP, completion, ACTIVE pills
  streak: "#fb923c", // streak, day counters
  gems: "#c4b5fd", // gems, premium hints
  gold: "#fcd34d", // rewards, achievements
  energy: "#f0abfc", // energy, boosts
} as const;

/**
 * Font family names exposed by @expo-google-fonts/nunito. In React
 * Native, `fontWeight` alone is NOT enough with a custom font — the
 * engine needs the exact PostScript family. Use these strings directly
 * in StyleSheet styles; the Text render patch in App.tsx also maps
 * `fontWeight` to these for legacy styles that predate tokens.
 */
export const font = {
  regular: "Nunito_400Regular",
  body: "Nunito_700Bold",
  title: "Nunito_900Black",
  display: "Nunito_900Black",
  overline: "Nunito_800ExtraBold",
} as const;

/** Type scale from the handoff: Display 32/900, Title 20/900, Body 14/700, Overline 11/800. */
export const fontSize = {
  display: 32,
  title: 20,
  body: 14,
  overline: 11,
} as const;

/**
 * Maps an RN `fontWeight` string/number to the matching Nunito family.
 * Used by the global Text render patch (App.tsx) so existing components
 * that specify only `fontWeight: "900"` still get the correct font file.
 */
export function nunitoFamilyForWeight(weight: string | number | undefined): string {
  const numeric =
    typeof weight === "number"
      ? weight
      : weight === "bold"
        ? 700
        : weight === "normal" || weight === undefined
          ? 400
          : Number(weight) || 400;
  if (numeric >= 900) return font.display;
  if (numeric >= 800) return font.overline;
  if (numeric >= 700) return font.body;
  return font.regular;
}
