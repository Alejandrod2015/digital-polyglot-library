import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

/**
 * PracticeExitSheet
 *
 * Popup centered (estilo del end-of-story prompt) que aparece cuando el
 * usuario tapea el botón de salir mid-sesión. La sesión se PAUSA al
 * abrirse el sheet (timer y auto-advance se congelan), así no hay
 * tiempo corriendo en background mientras el usuario decide.
 *
 * Jerarquía intencionalmente sesgada hacia "no salir":
 *   - Botón primary GRANDE: "Continue practicing" (cierra el sheet,
 *     despausa, vuelve al ejercicio).
 *   - Botón secondary chico: "Exit and lose progress" (cierra la
 *     sesión, vuelve al origen). Copy explícito sobre lo que se pierde
 *     para que el usuario decida con información, no por accidente.
 *
 * Headers reactivos al SCORE (no solo a la cantidad de ejercicios). Si
 * todos los intentos fueron timeout/wrong, "Nice work" es falso -
 * mostramos un copy honesto que invite a no rendirse.
 */

export type PracticeExitSheetProps = {
  accent: string;
  exercisesDone: number;
  exercisesTotal: number;
  /**
   * Cantidad de ejercicios respondidos correctamente. Se usa para
   * elegir el header: si es 0 con done > 0, mostramos "Don't give
   * up" en lugar de un copy genérico.
   */
  exercisesCorrect: number;
  /**
   * "Continue practicing": cierra el sheet y reanuda la sesión donde
   * estaba. PRIMARY action; el sheet empuja al usuario a quedarse.
   */
  onContinuePracticing: () => void;
  /**
   * "Exit anyway": cierra la sesión y manda al usuario al journey
   * (Home tab). Secondary action, link discreto debajo del primary.
   */
  onExitAnyway: () => void;
};

type Phase = "empty" | "no-correct" | "partial" | "almost-done";

function pickPhase(done: number, correct: number, total: number): Phase {
  if (done <= 0) return "empty";
  if (total > 0 && total - done <= 2) return "almost-done";
  if (correct <= 0) return "no-correct";
  return "partial";
}

export function PracticeExitSheet({
  accent,
  exercisesDone,
  exercisesTotal,
  exercisesCorrect,
  onContinuePracticing,
  onExitAnyway,
}: PracticeExitSheetProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(40)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslate, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, cardOpacity, cardTranslate, cardScale]);

  const phase = pickPhase(exercisesDone, exercisesCorrect, exercisesTotal);

  const headerTitle = useMemo(() => {
    switch (phase) {
      case "empty":
        return "Already leaving?";
      case "no-correct":
        return "Don't give up";
      case "almost-done":
        return "So close";
      case "partial":
      default:
        return "Keep going";
    }
  }, [phase]);

  const headerBody = useMemo(() => {
    switch (phase) {
      case "empty":
        return "You haven't started this round yet.";
      case "no-correct":
        return `${exercisesDone} of ${exercisesTotal} attempted, none correct yet. The next one might be the one.`;
      case "almost-done": {
        const remaining = Math.max(0, exercisesTotal - exercisesDone);
        return remaining === 1
          ? "Just 1 exercise left. Finish strong."
          : `Just ${remaining} exercises left. Finish strong.`;
      }
      case "partial":
      default:
        return `${exercisesCorrect} correct out of ${exercisesDone} so far. Stay sharp.`;
    }
  }, [phase, exercisesDone, exercisesCorrect, exercisesTotal]);

  // Copy amigable sobre lo que pasa si sale. Antes era una advertencia
  // tipo "Exit now and..." que sonaba amenazadora; ahora simplemente
  // informa que el progreso de la ronda no se guarda, sin reproches.
  const lossWarning = useMemo(() => {
    if (phase === "empty") return null;
    return "This round's progress won't carry over.";
  }, [phase]);

  return (
    <View
      style={styles.container}
      pointerEvents="box-none"
      accessibilityViewIsModal
      accessibilityLabel="qa-practice-exit-sheet"
      testID="qa-practice-exit-sheet"
    >
      <Animated.View
        pointerEvents="auto"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        {/* Tap fuera del card = continuar. Coherente con la jerarquía:
            la opción "default" cuando el usuario duda es seguir
            practicando, no salir. */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onContinuePracticing} />
      </Animated.View>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslate }, { scale: cardScale }],
          },
        ]}
      >
        {/* Close X arriba a la derecha. Mismo comportamiento que
            "Continue practicing": cierra el sheet y reanuda. Coincide
            con el endOfStoryDialogClose del reader. */}
        <Pressable
          onPress={onContinuePracticing}
          style={styles.closeButton}
          hitSlop={12}
          accessibilityLabel="qa-practice-exit-close"
        >
          <Feather name="x" size={18} color="#aebcd3" />
        </Pressable>

        {/* Trophy ring amarillo idéntico al del endOfStory; cambiamos
            sólo el icon: pausa porque la sesión está pausada. */}
        <View style={styles.iconRing}>
          <View style={styles.iconRingInner}>
            <Feather name="pause" size={28} color="#0e1727" />
          </View>
        </View>
        <Text style={styles.eyebrow}>Take a break</Text>
        <Text style={styles.title}>{headerTitle}</Text>
        <Text style={styles.body}>{headerBody}</Text>
        {lossWarning ? <Text style={styles.lossWarning}>{lossWarning}</Text> : null}

        <Pressable
          onPress={onContinuePracticing}
          style={styles.primaryButton}
          accessibilityRole="button"
          accessibilityLabel="qa-practice-exit-continue"
          testID="qa-practice-exit-continue"
        >
          <Feather name="play" size={16} color="#0e1727" />
          <Text style={styles.primaryButtonText}>Continue practicing</Text>
        </Pressable>

        <Pressable
          onPress={onExitAnyway}
          style={styles.exitLink}
          accessibilityRole="button"
          accessibilityLabel="qa-practice-exit-anyway"
          testID="qa-practice-exit-anyway"
        >
          <Text style={styles.exitLinkText}>Exit anyway</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Tokens alineados al endOfStory popup del reader (ReaderScreen.tsx
// `endOfStory*` styles): mismo background `#152844`, borde `#2d476b`,
// radio 26, primary pill dorado-ish (en este caso el accent del modo
// practice activo), secondary text-only color `#9cb0c9`. Cualquier
// rediseño futuro debería actualizar AMBOS lados al mismo tiempo
// (probablemente extrayendo a tokens del theme).
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 9, 17, 0.78)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#2d476b",
    backgroundColor: "#152844",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
    gap: 8,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 6,
    zIndex: 2,
  },
  eyebrow: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  // Ring + círculo interno amarillo. Tokens copiados literalmente del
  // `endOfStoryTrophyRing` + `endOfStoryTrophy` del ReaderScreen para
  // que ambos popups sean visualmente idénticos.
  iconRing: {
    width: 86,
    height: 86,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248, 193, 92, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(248, 193, 92, 0.28)",
    marginBottom: 4,
  },
  iconRingInner: {
    width: 62,
    height: 62,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8c15c",
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
    textAlign: "center",
  },
  body: {
    color: "#cfdbec",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 4,
  },
  lossWarning: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 4,
  },
  // Primary pill (radio 999) igual al endOfStoryButton del reader.
  primaryButton: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#f8c15c",
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#0e1727",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  exitLink: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  exitLinkText: {
    color: "#9cb0c9",
    fontSize: 13,
    fontWeight: "700",
  },
});
