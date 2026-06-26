import Svg, { Circle, Path } from "react-native-svg";

/**
 * Custom "journey" tab icon: a start dot, a dashed winding route, and a
 * destination pin. Drawn as SVG (not an icon-font glyph) so it matches the
 * intended route/path look exactly across platforms.
 */
export function JourneyIcon({ size = 22, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={19} r={2.2} stroke={color} strokeWidth={1.8} />
      <Path
        d="M6 19 C6 13 18 14 18 8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeDasharray="2 2.6"
        fill="none"
      />
      <Path
        d="M18 2.5 C15.5 2.5 14 4.3 14 6.2 C14 8.8 18 11 18 11 C18 11 22 8.8 22 6.2 C22 4.3 20.5 2.5 18 2.5 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={18} cy={6.2} r={1.25} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}
