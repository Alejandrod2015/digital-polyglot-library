import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
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
  /**
   * @deprecated Up Next card was removed para que la pantalla entre
   * sin scroll. La prop sigue en el type para no romper call-sites
   * en transición; cualquier valor se ignora.
   */
  upNextWords?: Array<{ word: string; translation: string }>;
  /**
   * @deprecated Ver `upNextWords`.
   */
  upNextRemainingCount?: number;
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

// Ring un poco más chico que la versión inicial (240 → 210) para
// que con el grid 2x2 de skill cards quepa todo el contenido sin
// scroll en iPhone 12 (~720pt usables tras tab bar). Stroke 24 mantiene
// la presencia visual pese al diámetro reducido.
const RING_SIZE = 210;
const RING_STROKE = 24;
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
  breakdown: Record<PracticeModeKey, number>
): RingSegment[] {
  // Cada segmento ocupa una porción del ring proporcional a su count.
  // Dejamos un gap pequeño entre segmentos para que se lean separados.
  // El "total" del anillo se deriva del breakdown mismo (suma) en vez
  // de venir como prop externa — así el `count/total` siempre cuadra
  // independiente de la semántica del breakdown (palabras vs ejercicios).
  const total = MODE_ORDER.reduce((sum, mode) => sum + (breakdown[mode] ?? 0), 0);
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

/**
 * Hook que cuenta de 0 a `target` con un easing cubic-out en
 * `durationMs`. Usado para "rollup" videogame de los números (DUE
 * central + counts de cada skill card). El render se hace cada frame
 * con setState; para 4-5 contadores simultáneos a 60fps no es
 * problema. Cuando cambia el target arranca una nueva animación.
 */
function useRollup(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = Date.now();
    function tick() {
      const start = startRef.current ?? Date.now();
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(fromRef.current + (target - fromRef.current) * eased);
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick) as unknown as number;
    }
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick) as unknown as number;
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

const SkillCard = memo(function SkillCard({
  mode,
  count,
  onPress,
}: {
  mode: PracticeModeKey;
  count: number;
  onPress: () => void;
}) {
  // Card de "skill drill" con look videogame: bg tinteado del color
  // del modo (bajo alpha), borde del mismo color a alpha medio, e
  // icono en chip lleno. Hace match visual con el segmento del anillo
  // de arriba — yellow card = yellow segment, pink card = pink
  // segment, etc. Counts hacen rollup de 0 → N al montar.
  const color = MODE_COLORS[mode];
  const animatedCount = useRollup(count, 700);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`qa-practice-skill-${mode}`}
      testID={`qa-practice-skill-${mode}`}
      style={({ pressed }) => [
        styles.skillCard,
        {
          backgroundColor: `${color}1F`,
          borderColor: `${color}66`,
          shadowColor: color,
        },
        pressed ? styles.skillCardPressed : null,
      ]}
    >
      <View style={styles.skillCardHeader}>
        <View style={[styles.skillIconChip, { backgroundColor: `${color}40` }]}>
          <Feather name={MODE_ICONS[mode]} size={18} color={color} />
        </View>
        <Text style={styles.skillCount}>{animatedCount}</Text>
      </View>
      <Text style={styles.skillCardLabel}>{MODE_LABELS[mode].toUpperCase()}</Text>
    </Pressable>
  );
});

export function PracticeOrbit({
  topicLabel,
  totalDue,
  xpReward,
  modeBreakdown,
  streakDays,
  dailyGoalPercent,
  onStart,
  onPickSkill,
  emptyState,
}: PracticeOrbitProps) {
  const segments = useMemo(
    () => buildRingSegments(modeBreakdown),
    [modeBreakdown]
  );

  // Animaciones del anillo + orbe central (look "videogame"):
  //   - mountProgress: fade + scale-in del anillo entero al primer
  //     paint. One-shot; no reinicia.
  //   - orbPulse: loop continuo 0↔1 que mueve scale del orbe entre
  //     1.0 y 1.05 — efecto de "respiración" para hacer obvio que
  //     ese círculo es el CTA principal. useNativeDriver=true así no
  //     molesta al hilo de JS mientras el usuario mira.
  //   - rolledDue / rolledCounts: animan los números 0 → N en mount
  //     (videogame stat reveal). Implementado con `useRollup`.
  const mountProgress = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(mountProgress, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [mountProgress, orbPulse]);

  const ringOpacity = mountProgress;
  const ringScale = mountProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });
  const orbScale = orbPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const rolledDue = useRollup(totalDue, 800);

  if (emptyState) {
    return (
      <View style={styles.shell}>
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
      {/* Streak + daily-goal chips moved here from the old header row;
          the PRACTICE eyebrow was redundant with the shell-level
          flag+title block, so the row is now just the chips. */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }} />
        <HeaderChips streakDays={streakDays} dailyGoalPercent={dailyGoalPercent} />
      </View>

      {topicLabel ? (
        <Text style={styles.topicLine}>
          From <Text style={styles.topicLineEm}>{topicLabel}</Text>
        </Text>
      ) : null}

      <Animated.View
        style={[
          styles.ringWrap,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      >
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
          Orbe central. Navy `#152844` (mismo card de los popups
          end-of-story / practice-exit) con play+START en una pill
          amarilla `#f8c15c` — mismo lenguaje que los CTA primarios
          del resto de la app. Adentro: número grande con rollup
          0 → N + caption `DUE` arriba del play, así el contador
          queda centralizado en el CTA en vez de flotando.

          La Animated.View externa aplica un pulse continuo de scale
          1 ↔ 1.05 para que el orbe respire — call-to-action visual.
        */}
        <Animated.View style={[styles.centerOrbWrap, { transform: [{ scale: orbScale }] }]}>
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
              <Text style={styles.centerOrbCount}>{rolledDue}</Text>
              <Text style={styles.centerOrbCountLabel}>DUE</Text>
              <View style={styles.centerOrbDivider} />
              <View style={styles.centerOrbCta}>
                <Feather name="play" size={18} color="#0e1727" />
                <Text style={styles.centerOrbStart}>START</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>

      {/* Tagline de sesión bajo el anillo: minutos estimados + skills
          activos. Sustituye a la leyenda separada (que ahora vive
          implícita en los skill cards de abajo, mismo color que el
          segmento del anillo). */}
      <Text style={styles.sessionMeta}>
        ~{estimateSessionMinutes(totalDue)} min
        {" · "}
        {MODE_ORDER.filter((m) => modeBreakdown[m] > 0).length} skills
        {" · +"}{xpReward} XP
      </Text>

      {/* Grid 2x2 de skill cards. Cada card tintada con el color de
          su segmento del anillo arriba: el usuario reconoce de un
          vistazo que la card amarilla corresponde al arco amarillo,
          la verde al verde, etc. Reemplaza al row horizontal de
          tarjetitas chiquitas que se cortaba bajo la tab bar. */}
      <View style={styles.skillGrid}>
        {MODE_ORDER.map((mode) => (
          <SkillCard
            key={mode}
            mode={mode}
            count={modeBreakdown[mode] ?? 0}
            onPress={() => onPickSkill(mode)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: 20,
    paddingTop: 6,
    // Padding inferior suficiente para clearing de la tab bar
    // flotante. El parent `container` aporta 56 pt; con 24 acá
    // quedamos en 80 pt totales — la screen entra sin scroll.
    paddingBottom: 24,
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
  // Wrapper externo del orbe: aplica el pulse continuo (scale loop)
  // sin tener que bindear el `useNativeDriver:true` a un Pressable.
  // Solo Animated.View soporta el driver nativo en transform.
  centerOrbWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  // Orbe interior: navy `#152844` (mismo card de popups) en lugar del
  // verde menta que chocaba con el segmento Context. Bordeamos con un
  // navy levemente más claro para que tenga relieve sobre el bg.
  centerOrb: {
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
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0.4,
    lineHeight: 38,
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
    marginTop: 14,
    color: "#cdd9ec",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  // Skill grid 2x2 con cards "videogame": tinte del color del modo,
  // borde mismo color a alpha medio, sombra coloreada para que tenga
  // glow tonal. La proporción del color en el screen hace que la card
  // amarilla sea reconocible como "el modo amarillo del anillo".
  skillGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  skillCard: {
    width: "48%",
    minHeight: 92,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    justifyContent: "space-between",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  skillCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  skillCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skillIconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  skillCount: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  skillCardLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 6,
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
