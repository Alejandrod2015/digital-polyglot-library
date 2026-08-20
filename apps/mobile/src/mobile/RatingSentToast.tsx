import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

/**
 * Acuse de "comentario enviado" que entra, se queda a leerse y se DESVANECE.
 *
 * Antes esto era un bloque normal escondido tras un `setTimeout`: a los 2,5
 * segundos desaparecía de golpe, y un aviso que se corta seco se lee como un
 * fallo de pintado, no como una confirmación. La diferencia entre desaparecer
 * y desvanecerse es justo lo que hace que parezca deliberado.
 *
 * El componente se apaga solo y avisa al padre con `onDone` DESPUÉS del fade,
 * para que el desmontaje no se coma la animación.
 */
export function RatingSentToast({
  onDone,
  label = "Sent. Thank you",
}: {
  onDone?: () => void;
  label?: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(1900),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.box, { opacity }]} pointerEvents="none">
      <View style={styles.iconWrap}>
        <Feather name="check" size={13} color="#9ce5c1" />
      </View>
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(156, 229, 193, 0.35)",
    backgroundColor: "rgba(156, 229, 193, 0.12)",
    borderRadius: 999,
    paddingVertical: 11,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(156, 229, 193, 0.22)",
  },
  text: {
    color: "#9ce5c1",
    fontSize: 13,
    fontWeight: "700",
  },
});
