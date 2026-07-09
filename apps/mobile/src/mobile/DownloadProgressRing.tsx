import Svg, { Circle } from "react-native-svg";

/**
 * Anillo de progreso de descarga que se LLENA (0..1), estilo apps.
 * Reemplaza la rueda indeterminada. Se dibuja desde arriba en sentido horario.
 */
export function DownloadProgressRing({
  progress,
  size = 22,
  stroke = 2.5,
  color = "#9fe8ff",
  trackColor = "rgba(255,255,255,0.18)",
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={trackColor}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
