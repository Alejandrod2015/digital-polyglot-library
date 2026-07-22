import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Alto de la barra inferior del sistema en Android (gestos o 3 botones).
 *
 * Desde Expo SDK 54 el edge-to-edge está activo por defecto
 * (`edgeToEdgeEnabled` solo se apaga poniéndolo en `false`, y no lo hacemos),
 * así que la app dibuja DEBAJO de esa barra: todo lo anclado abajo queda medio
 * tapado. Así empezó el bug del botón de play del reader, que en Android no se
 * podía tocar.
 *
 * En iOS devuelve 0 a propósito: ahí el `SafeAreaView` del core ya aplica el
 * inset y sumarlo otra vez duplicaría el margen. Con una excepción importante:
 * un `<Modal>` de React Native se renderiza en SU PROPIA ventana, fuera del
 * `SafeAreaView` raíz, así que el padding de la raíz no llega a su contenido y
 * cada modal anclado abajo tiene que aplicar este inset por su cuenta.
 */
export function useAndroidBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "android" ? insets.bottom : 0;
}
