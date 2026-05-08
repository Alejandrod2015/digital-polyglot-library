import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, G } from "react-native-svg";

/**
 * PracticeOrbit — pantalla "Practice" rediseñada.
 *
 * Idea: invertir el flujo previo (4 cards, usuario elige modo). Ahora el
 * algoritmo decide y el usuario solo presiona START. Los 4 modos siguen
 * disponibles como atajo secundario para entrenar una habilidad puntual.
 *
 * Recompensas visibles ANTES del CTA:
 *   - Streak chip (ya cuenta hacer Practice como actividad del día).
 *   - XP% del daily goal (XP que va a sumar la sesión, ya calculado en
 *     gamification.ts).
 *   - "10 DUE" + topic dominante: el usuario ve QUÉ va a practicar
 *     antes de empezar.
 *
 * Diseño visual: anillo segmentado en 4 colores (uno por modo) con
 * ancho proporcional a las palabras en cada modo, orbe verde central
 * con play. Versión Duolingo-like del Daily Goal ring.
 */

export type PracticeModeKey = "meaning" | "context" | "listening" | "match";

export type PracticeOrbitProps = {
  topicLabel: string | null;
  totalDue: number;
  xpReward: number;
  modeBreakdown: Record<PracticeModeKey, number>;
  streakDays: number;
  dailyGoalPercent: number;
  upNextWords: Array<{ word: string; translation: string }>;
  upNextRemainingCount: number;
  onStart: () => void;
  onPickSkill: (mode: PracticeModeKey) => void;
  emptyState?: boolean;
};

const MODE_COLORS: Record<PracticeModeKey, string> = {
  meaning: "#facc15", // amarillo
  context: "#86efac", // verde menta
  listening: "#f0abfc", // rosa
  match: "#7dd3fc", // cyan
};

const MODE_ICONS: Record<PracticeModeKey, "zap" | "message-circle" | "headphones" | "link"> = {
  meaning: "zap",
  context: "message-circle",
  listening: "headphones",
  match: "link",
};

const MODE_LABELS: Record<PracticeModeKey, string> = {
  meaning: "Meaning",
  context: "Context",
  listening: "Listening",
  match: "Match",
};

const MODE_ORDER: PracticeModeKey[] = ["meaning", "context", "listening", "match"];

const RING_SIZE = 240;
const RING_STROKE = 28;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Estimación grosera de duración: el timer por ejercicio es ~10s, así
// que 6 ejercicios ≈ 1 min. Redondeamos hacia arriba con piso de 1
// para que no diga "0 min" cuando solo hay 1-2 dues.
function estimateSessionMinutes(totalDue: number): number {
  if (totalDue <= 0) return 0;
  return Math.max(1, Math.round((totalDue * 10) / 60));
}

type RingSegment = {
  mode: PracticeModeKey;
  count: number;
  color: string;
  dashLength: number;
  dashOffset: number;
};

function buildRingSegments(
  breakdown: Record<PracticeModeKey, number>,
  total: number
): RingSegment[] {
  // Cada segmento ocupa una porción del ring proporcional a su count.
  // Dejamos un gap pequeño entre segmentos para que se lean separados.
  const GAP_DEG = 4;
  const totalGapDeg = GAP_DEG * MODE_ORDER.filter((m) => breakdown[m] > 0).length;
  const usableDeg = 360 - totalGapDeg;
  const segments: RingSegment[] = [];
  let cursorDeg = -90; // arrancar arriba (12 en punto)
  for (const mode of MODE_ORDER) {
    const count = breakdown[mode];
    if (count <= 0) continue;
    const fraction = total > 0 ? count / total : 0;
    const arcDeg = usableDeg * fraction;
    const dashLength = (arcDeg / 360) * RING_CIRCUMFERENCE;
    // strokeDashoffset rota el patrón. Por la rotación de Svg de -90deg
    // el offset 0 = arriba.
    const startFromTopDeg = cursorDeg + 90; // grados desde "arriba"
    const dashOffset = -((startFromTopDeg / 360) * RING_CIRCUMFERENCE);
    segments.push({
      mode,
      count,
      color: MODE_COLORS[mode],
      dashLength,
      dashOffset,
    });
    cursorDeg += arcDeg + GAP_DEG;
  }
  return segments;
}

const HeaderChips = memo(function HeaderChips({
  streakDays,
  dailyGoalPercent,
}: {
  streakDays: number;
  dailyGoalPercent: number;
}) {
  // Cada chip lleva un label microscópico (`STREAK`, `GOAL`) para que
  // el número no quede ambiguo. Sin label el usuario no sabía si "1"
  // era racha de días, sesiones del día o ítems en cola.
  return (
    <View style={styles.headerChipsRow}>
      <View style={styles.headerChip}>
        <Feather name="zap" size={12} color="#fb923c" />
        <Text style={styles.headerChipText}>{streakDays}</Text>
        <Text style={styles.headerChipLabel}>STREAK</Text>
      </View>
      <View style={styles.headerChip}>
        <Feather name="trending-up" size={12} color="#7dd3fc" />
        <Text style={styles.headerChipText}>{Math.min(100, Math.round(dailyGoalPercent))}%</Text>
        <Text style={styles.headerChipLabel}>GOAL</Text>
      </View>
    </View>
  );
});

const Legend = memo(function Legend({
  breakdown,
}: {
  breakdown: Record<PracticeModeKey, number>;
}) {
  // 2x2 grid en lugar de wrap libre. Antes los 4 modos caían 3+1 con
  // "Match" colgando solo abajo, asimetría rara. El grid garantiza
  // que el bloque se vea cuadrado siempre.
  const visible = MODE_ORDER.filter((mode) => breakdown[mode] > 0);
  const rows: PracticeModeKey[][] = [];
  for (let i = 0; i < visible.length; i += 2) {
    rows.push(visible.slice(i, i + 2));
  }
  return (
    <View style={styles.legendGrid}>
      {rows.map((row, idx) => (
        <View key={idx} style={styles.legendRow}>
          {row.map((mode) => (
            <View key={mode} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: MODE_COLORS[mode] }]} />
              <Text style={styles.legendLabel}>{MODE_LABELS[mode]}</Text>
              <Text style={styles.legendCount}>{breakdown[mode]}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

const UpNextCard = memo(function UpNextCard({
  words,
  remaining,
}: {
  words: Array<{ word: string; translation: string }>;
  remaining: number;
}) {
  if (words.length === 0) return null;
  return (
    <View style={styles.upNextCard}>
      <View style={styles.upNextHeader}>
        <Text style={styles.upNextEyebrow}>UP NEXT</Text>
        {remaining > 0 ? (
          <Text style={styles.upNextRemaining}>+{remaining} more</Text>
        ) : null}
      </View>
      {words.map((entry) => (
        // Layout en columna: la palabra arriba y la definición abajo.
        // Antes estaban en la misma fila y el ancho fijo de la palabra
        // empujaba la def fuera de pantalla, cortándola a mitad de
        // palabra ("excite", "in o", "journey adventure."). Con
        // numberOfLines=2 + ellipsis garantizamos un corte limpio.
        <View key={entry.word} style={styles.upNextRow}>
          <Text style={styles.upNextWord}>{entry.word}</Text>
          <Text style={styles.upNextTranslation} numberOfLines={2} ellipsizeMode="tail">
            {entry.translation}
          </Text>
        </View>
      ))}
    </View>
  );
});

export function PracticeOrbit({
  topicLabel,
  totalDue,
  xpReward,
  modeBreakdown,
  streakDays,
  dailyGoalPercent,
  upNextWords,
  upNextRemainingCount,
  onStart,
  onPickSkill,
  emptyState,
}: PracticeOrbitProps) {
  const segments = useMemo(
    () => buildRingSegments(modeBreakdown, totalDue),
    [modeBreakdown, totalDue]
  );

  if (emptyState) {
    return (
      <View style={styles.shell}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>PRACTICE</Text>
        </View>
        <View style={styles.emptyCard}>
          <Feather name="bookmark" size={28} color="#cdd9ec" />
          <Text style={styles.emptyTitle}>No words to review yet</Text>
          <Text style={styles.emptyBody}>
            Save words while reading and they will show up here as practice exercises.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>PRACTICE</Text>
        <HeaderChips streakDays={streakDays} dailyGoalPercent={dailyGoalPercent} />
      </View>

      {topicLabel ? (
        <Text style={styles.topicLine}>
          From <Text style={styles.topicLineEm}>{topicLabel}</Text>
        </Text>
      ) : null}

      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <G rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
            {/* Track de fondo */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={RING_STROKE}
              fill="transparent"
            />
            {segments.map((seg) => (
              <Circle
                key={seg.mode}
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={seg.color}
                strokeWidth={RING_STROKE}
                strokeLinecap="butt"
                fill="transparent"
                strokeDasharray={`${seg.dashLength} ${RING_CIRCUMFERENCE - seg.dashLength}`}
                strokeDashoffset={seg.dashOffset}
              />
            ))}
          </G>
        </Svg>
        {/*
          Orbe central. Antes era verde menta `#86efac` — el MISMO verde
          que el segmento "Context" del anillo, así que visualmente
          parecía que el segmento se metía dentro del botón. Ahora va
          en navy `#152844` (mismo card de los popups end-of-story /
          practice-exit) con play+START en el amarillo brand
          `#f8c15c`. Mismo lenguaje que los CTA primarios del resto
          de la app.

          Adentro: número grande `34` + caption `DUE` arriba del play
          para que el contador esté centralizado, no flotando suelto
          encima del anillo como antes.
        */}
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="Start practice session"
          testID="qa-practice-start"
          style={({ pressed }) => [
            styles.centerOrb,
            pressed ? styles.centerOrbPressed : null,
          ]}
        >
          <View style={styles.centerOrbInner}>
            <Text style={styles.centerOrbCount}>{totalDue}</Text>
            <Text style={styles.centerOrbCountLabel}>DUE</Text>
            <View style={styles.centerOrbDivider} />
            <View style={styles.centerOrbCta}>
              <Feather name="play" size={18} color="#0e1727" />
              <Text style={styles.centerOrbStart}>START</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Tagline de sesión: minutos estimados + cantidad de skills.
          Reemplaza al chip flotante "34 DUE" que antes vivía sobre el
          anillo. Ahora el conteo va dentro del orbe y aquí solo
          comunicamos qué tipo de sesión vas a hacer. */}
      <Text style={styles.sessionMeta}>
        ~{estimateSessionMinutes(totalDue)} min
        {" · "}
        {MODE_ORDER.filter((m) => modeBreakdown[m] > 0).length} skills
      </Text>

      <Legend breakdown={modeBreakdown} />

      <UpNextCard words={upNextWords} remaining={upNextRemainingCount} />

      <View style={styles.skillSection}>
        <Text style={styles.skillSectionEyebrow}>OR PICK A SKILL</Text>
        <Text style={styles.skillSectionTitle}>Single-skill drills</Text>
        <View style={styles.skillRow}>
          {MODE_ORDER.map((mode) => (
            <Pressable
              key={mode}
              onPress={() => onPickSkill(mode)}
              accessibilityRole="button"
              accessibilityLabel={`qa-practice-skill-${mode}`}
              testID={`qa-practice-skill-${mode}`}
              style={({ pressed }) => [
                styles.skillCard,
                pressed ? styles.skillCardPressed : null,
              ]}
            >
              <View style={[styles.skillIconWrap, { backgroundColor: `${MODE_COLORS[mode]}33` }]}>
                <Feather name={MODE_ICONS[mode]} size={16} color={MODE_COLORS[mode]} />
              </View>
              <Text style={styles.skillLabel}>{MODE_LABELS[mode]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.xpFootnote}>+{xpReward} XP available</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: 20,
    paddingTop: 6,
    // Padding inferior holgado para que las skill cards de
    // "Single-skill drills" no queden ocultas detrás de la tab bar
    // flotante (~58 pt + safe area). El parent `container` ya aporta
    // 56 pt; con 80 acá quedamos en 136 pt totales, suficiente.
    paddingBottom: 80,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  eyebrow: {
    color: "#7d8aa5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  headerChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  headerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerChipText: {
    color: "#f5f7fb",
    fontSize: 13,
    fontWeight: "800",
  },
  headerChipLabel: {
    color: "#9cb0c9",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  topicLine: {
    color: "#cdd9ec",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  topicLineEm: {
    color: "#ffffff",
    fontWeight: "900",
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  // Orbe interior: navy `#152844` (mismo card de popups) en lugar del
  // verde menta que chocaba con el segmento Context. Bordeamos con un
  // navy levemente más claro para que tenga relieve sobre el bg.
  centerOrb: {
    position: "absolute",
    width: RING_SIZE - RING_STROKE * 2 - 10,
    height: RING_SIZE - RING_STROKE * 2 - 10,
    borderRadius: 999,
    backgroundColor: "#152844",
    borderWidth: 1,
    borderColor: "#2d476b",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  centerOrbPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  centerOrbInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  centerOrbCount: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 0.4,
    lineHeight: 42,
  },
  centerOrbCountLabel: {
    color: "#9cb0c9",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: -2,
  },
  centerOrbDivider: {
    width: 28,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 8,
  },
  centerOrbCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f8c15c",
  },
  centerOrbStart: {
    color: "#0e1727",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  sessionMeta: {
    marginTop: 12,
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  legendGrid: {
    marginTop: 14,
    alignSelf: "center",
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 110,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendLabel: {
    color: "#cdd9ec",
    fontSize: 12,
    fontWeight: "700",
  },
  legendCount: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  upNextCard: {
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  upNextHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  upNextEyebrow: {
    color: "#7d8aa5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  upNextRemaining: {
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: "800",
  },
  upNextRow: {
    flexDirection: "column",
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  upNextWord: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  upNextTranslation: {
    color: "#cdd9ec",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  skillSection: {
    marginTop: 22,
  },
  skillSectionEyebrow: {
    color: "#7d8aa5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  skillSectionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 10,
  },
  skillRow: {
    flexDirection: "row",
    gap: 10,
  },
  skillCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  skillCardPressed: {
    opacity: 0.7,
  },
  skillIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  skillLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  xpFootnote: {
    marginTop: 16,
    color: "#cdd9ec",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyCard: {
    marginTop: 30,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 6,
  },
  emptyBody: {
    color: "#cdd9ec",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
});
