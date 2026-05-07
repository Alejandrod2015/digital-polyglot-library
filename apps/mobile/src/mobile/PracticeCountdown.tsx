import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

/**
 * PracticeCountdown
 *
 * Overlay full-screen que muestra "3 · 2 · 1 · GO" antes del primer
 * ejercicio. Dura 3 segundos en total y dispara `onComplete` al terminar.
 *
 * Razones de diseño:
 *   - Da tiempo al usuario a "entrar en modo de juego" antes de que el
 *     primer ejercicio aparezca y arranque el timer + el autoplay del
 *     audio. Sin este buffer el primer ejercicio aparece de golpe y el
 *     usuario llega tarde a leer.
 *   - Crea expectativa, hace que la sesión se sienta competitiva (estilo
 *     Duolingo / Quizlet timed mode).
 *   - Bloquea cualquier interacción durante 3 seg para que ningún tap
 *     accidental (en el botón de salir, en la pantalla anterior) afecte
 *     a la sesión nueva.
 *
 * Cada número entra con un spring + scale 0.4 → 1.1 → 1, fade-out al
 * pasar al siguiente. El último frame ("GO") usa un color distinto y
 * un poco más de tiempo para que sea memorable.
 */

const STEP_MS = 700;

export function PracticeCountdown({
  accent,
  onComplete,
}: {
  accent: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    function play(currentStep: number) {
      if (cancelled) return;
      scale.setValue(0.4);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
          tension: 80,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      // Fade out poco antes del próximo step.
      const fadeTimer = setTimeout(() => {
        if (cancelled) return;
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start();
      }, STEP_MS - 200);

      const stepTimer = setTimeout(() => {
        if (cancelled) return;
        if (currentStep < 3) {
          setStep(currentStep + 1);
          play(currentStep + 1);
        } else {
          onComplete();
        }
      }, STEP_MS);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(stepTimer);
      };
    }

    play(0);

    return () => {
      cancelled = true;
    };
    // onComplete intencionalmente fuera de deps: queremos que el
    // countdown corra una sola vez por mount, no que se reinicie si
    // el padre redeclara el callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // step: 0 → "3", 1 → "2", 2 → "1", 3 → "GO".
  const labels = ["3", "2", "1", "GO"];
  const isGo = step === 3;
  const text = labels[step] ?? "";

  return (
    <View style={styles.container} pointerEvents="auto">
      <View style={styles.backdrop} />
      <Animated.Text
        style={[
          styles.label,
          isGo ? styles.labelGo : null,
          {
            // El "GO" se muestra en amarillo `#f8c15c` (mismo de los
            // popups, endOfStory y todos los acentos de practice). NO
            // usamos `accent` porque modos como Context heredan
            // `tokenColor.streak` (naranja) y choca con el azul.
            color: isGo ? "#f8c15c" : "#f5f7fb",
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 12, 24, 0.85)",
  },
  label: {
    fontSize: 132,
    fontWeight: "900",
    letterSpacing: -2,
  },
  labelGo: {
    fontSize: 96,
    letterSpacing: 2,
  },
});
