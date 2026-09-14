import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio, InterruptionModeIOS } from "expo-av";
import {
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";


/**
 * El reconocimiento de voz del ejercicio hablado, sin nada de pantalla.
 *
 * Quien transcribe es EL SISTEMA (SFSpeechRecognizer en iOS, SpeechRecognizer
 * en Android). Ni grabamos un fichero, ni lo subimos, ni lo guardamos: lo
 * unico que sale de aqui es el texto final, en memoria, para compararlo con la
 * palabra. La version anterior mandaba el audio en base64 a Whisper; el
 * usuario la rechazo entera, y el trabajo que hacia ya lo hace el telefono.
 *
 * Lo que aporta este hook sobre el modulo pelado:
 *   - En iOS pide reconocimiento EN EL DISPOSITIVO cuando el sistema lo
 *     ofrece; si no, el del propio sistema. Nunca un servicio nuestro.
 *   - Tope de 15 s con parada automatica. El ejercicio pide la FRASE entera, y
 *     una de doce palabras dicha despacio pasa de doce segundos; sin tope, un
 *     micro olvidado abierto se queda escuchando.
 *   - Escucha CONTINUA y un solo texto al final. Con `continuous: false` el
 *     reconocedor cierra en la primera pausa, y una frase entera lleva pausas;
 *     asi que escucha hasta el tope o hasta que el usuario para, y lo que
 *     entrega es la union de los finales que haya mandado el sistema.
 *   - DEVUELVE la sesion de audio de iOS al modo de reproduccion en cuanto
 *     termina. Ver `restaurarModoDeReproduccion`.
 */

/**
 * Devuelve la sesion de audio de iOS a reproduccion.
 *
 * LA CAUSA, en dos frases: expo-av no fija el MODE de la AVAudioSession (solo
 * la categoria) y ademas cachea la ultima categoria que puso, asi que tras el
 * reconocimiento se saltaba la llamada y dejaba el modo `measurement`, que
 * apaga el procesado de salida. Por eso la restauracion la hace el modulo de
 * RECONOCIMIENTO con `setCategoryIOS`, que toca la sesion directamente,
 * categoria y modo, y el `setAudioModeAsync` de expo-av va detras solo para
 * dejarlo en sincronia con las otras nueve rutas de sonido de la app.
 *
 * La prueba esta en `expo-av/ios/EXAV/EXAudioSessionManager.m`: solo llama a
 * `setCategory:withOptions:`, no hay un `setMode` en todo su codigo de iOS, y
 * el guard `if (!_activeCategory || ![category isEqualToString:_activeCategory]
 * ...)` es el que se saltaba la llamada. Sin esto, la restauracion del commit
 * 8734c3bb era literalmente una funcion vacia.
 */
async function restaurarModoDeReproduccion(): Promise<void> {
  try {
    ExpoSpeechRecognitionModule.setCategoryIOS({
      category: AVAudioSessionCategory.playback,
      categoryOptions: [],
      mode: AVAudioSessionMode.default,
    });
  } catch {
    // En Android no existe; en iOS, si la sesion no estaba tocada, no hay nada
    // que devolver. En ninguno de los dos casos es un error.
  }
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  });
}

const MAX_LISTENING_MS = 15000;

/**
 * Los sistemas no se ponen de acuerdo en como mandan los finales: unos reenvian
 * la frase ENTERA cada vez, cada vez mas larga, y otros mandan un trozo nuevo
 * por cada pausa. Concatenar a ciegas duplicaria en el primer caso y quedarse
 * con el ultimo perderia texto en el segundo, asi que se cubren los dos: un
 * final que ya esta contenido se ignora, y uno que contiene a otro lo sustituye.
 */
function mergeFinalTranscripts(parts: string[]): string {
  const out: string[] = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    if (out.some((prev) => prev.includes(part))) continue;
    const index = out.findIndex((prev) => part.includes(prev));
    if (index >= 0) out[index] = part;
    else out.push(part);
  }
  return out.join(" ").trim();
}

/**
 * Idioma del favorito a locale BCP-47. La variante de la historia no viaja en
 * el favorito, asi que cada idioma cae en su locale mas comun; para una sola
 * palabra la diferencia entre variantes no cambia el reconocimiento.
 */
const LOCALE_BY_LANGUAGE: Record<string, string> = {
  spanish: "es-ES",
  english: "en-US",
  french: "fr-FR",
  german: "de-DE",
  italian: "it-IT",
  portuguese: "pt-BR",
  japanese: "ja-JP",
  korean: "ko-KR",
  chinese: "zh-CN",
};

export function localeForSpeaking(language?: string | null): string {
  const key = (language ?? "").trim().toLowerCase();
  return LOCALE_BY_LANGUAGE[key] ?? "en-US";
}

export type SpeakingStartResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable" | "failed" };

type Handlers = {
  onFinal: (transcript: string) => void;
  /** Se llama con el codigo del modulo cuando el turno muere sin resultado. */
  onFailure: (code: string) => void;
};

export function useSpeakingRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const handlersRef = useRef<Handlers | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  /** Evita entregar dos veces el mismo turno (result final y luego end). */
  const settledRef = useRef(true);
  /** Finales recibidos en el turno en curso, antes de unirlos. */
  const finalsRef = useRef<string[]>([]);
  /** La restauracion del modo de audio en curso, para poder esperarla. */
  const restauracionRef = useRef<Promise<void> | null>(null);

  const clearAutoStop = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clearAutoStop();
    settledRef.current = true;
    handlersRef.current = null;
    finalsRef.current = [];
    if (mountedRef.current) setIsRecording(false);
    // SIEMPRE, y antes de que suene nada: el turno acaba devolviendo la salida
    // al altavoz. Sin esto, la frase del ejercicio siguiente sale por el
    // auricular.
    restauracionRef.current = restaurarModoDeReproduccion().catch(() => {});
  }, [clearAutoStop]);

  useSpeechRecognitionEvent("result", (event) => {
    // Solo los FINALES: con `interimResults: false` no deberian llegar
    // parciales, pero el guard evita mezclar medio dictado si alguna
    // plataforma los manda igual. En escucha continua pueden llegar varios, y
    // aqui solo se acumulan: el turno no se cierra hasta `end`.
    if (!event.isFinal) return;
    if (settledRef.current) return;
    const transcript = (event.results?.[0]?.transcript ?? "").trim();
    if (transcript) finalsRef.current.push(transcript);
  });

  const settleWithWhatWeHave = useCallback(
    (fallbackCode: string) => {
      const heard = mergeFinalTranscripts(finalsRef.current);
      const handlers = handlersRef.current;
      finish();
      // Calificar suena: el acierto o el fallo, y luego la frase de la
      // revelacion. Se espera a que el modo este restaurado o esos dos salen
      // por el auricular, que es el mismo fallo por otra puerta.
      const seguir = () => {
        if (heard) handlers?.onFinal(heard);
        else handlers?.onFailure(fallbackCode);
      };
      const pendiente = restauracionRef.current;
      if (pendiente) void pendiente.then(seguir, seguir);
      else seguir();
    },
    [finish]
  );

  useSpeechRecognitionEvent("error", (event) => {
    // TEMPORAL (diagnostico Android): en Android el modulo NO devuelve el
    // fallo por el valor de `start`, lo manda por aqui, asi que el motivo real
    // de un turno que salta solo se ve en esta linea.
    console.log("[speaking-error]", {
      platform: Platform.OS,
      error: event.error,
      message: event.message,
      settled: settledRef.current,
    });
    if (settledRef.current) return;
    // Un error tras haber oido algo no tira lo oido: en escucha continua, el
    // "no-speech" del final de una pausa es corriente.
    settleWithWhatWeHave(event.error ?? "unknown");
  });

  useSpeechRecognitionEvent("end", () => {
    // Fin del turno: por el tope, por `TAP TO SEND` o porque el sistema cerro.
    // Aqui es donde se entrega lo dicho, unido.
    if (settledRef.current) return;
    settleWithWhatWeHave("no-speech");
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAutoStop();
      handlersRef.current = null;
      settledRef.current = true;
      finalsRef.current = [];
      // Si el usuario sale a mitad del turno, se corta en seco y sin resultado.
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // El modulo no estaba escuchando; no hay nada que abortar.
      }
      void restaurarModoDeReproduccion().catch(() => {});
    };
  }, [clearAutoStop]);

  /**
   * Arranca el reconocimiento para un idioma. Devuelve por que NO pudo cuando
   * no puede: `denied` (permiso), `unavailable` (el dispositivo no reconoce
   * ese idioma) o `failed`. La pantalla decide que hacer con cada uno; el spec
   * los separa porque el primero salta el ejercicio y el segundo lo convierte
   * en uno de contexto.
   */
  const start = useCallback(
    async (language: string | null | undefined, handlers: Handlers): Promise<SpeakingStartResult> => {
      // TEMPORAL (diagnostico Android): se quita cuando el bug este cerrado.
      let available: boolean | null = null;
      let supportsOnDevice: boolean | null = null;
      let permissionStatus: string | null = null;
      try {
        available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        supportsOnDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
        if (!available) {
          // TEMPORAL (diagnostico Android)
          console.log("[speaking-start]", {
            paso: "unavailable",
            platform: Platform.OS,
            available,
            supportsOnDevice,
            permission: permissionStatus,
          });
          return { ok: false, reason: "unavailable" };
        }
        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        permissionStatus = `${permission.status}/granted:${permission.granted}`;
        if (!permission.granted) {
          // TEMPORAL (diagnostico Android)
          console.log("[speaking-start]", {
            paso: "denied",
            platform: Platform.OS,
            available,
            supportsOnDevice,
            permission: permissionStatus,
          });
          return { ok: false, reason: "denied" };
        }
        // TEMPORAL (diagnostico Android): el camino bueno tambien deja rastro,
        // porque en Android los fallos de `start` NO vuelven por aqui: llegan
        // despues como evento `error`.
        console.log("[speaking-start]", {
          paso: "ok",
          platform: Platform.OS,
          available,
          supportsOnDevice,
          permission: permissionStatus,
          lang: localeForSpeaking(language),
        });

        handlersRef.current = handlers;
        settledRef.current = false;
        finalsRef.current = [];
        ExpoSpeechRecognitionModule.start({
          lang: localeForSpeaking(language),
          // Sin parciales: lo que se califica es lo que el usuario acabo
          // diciendo, no el texto a medias que el reconocedor va corrigiendo.
          interimResults: false,
          // CONTINUA a proposito: el ejercicio pide la frase entera y una
          // frase lleva pausas. Con `false`, el reconocedor cierra en la
          // primera y se queda con las dos primeras palabras.
          continuous: true,
          maxAlternatives: 1,
          // SOLO en iOS: alli `supportsOnDeviceRecognition()` responde por el
          // reconocedor del idioma que se va a usar, y si dice que no, el
          // sistema reconoce por red sin que se note.
          //
          // En ANDROID la misma llamada es `SpeechRecognizer
          // .isOnDeviceRecognitionAvailable(context)`, que solo mira si EXISTE
          // un servicio de reconocimiento en el dispositivo, no si el modelo
          // del idioma esta descargado. Pedirlo obliga a
          // `createOnDeviceSpeechRecognizer` con `EXTRA_PREFER_OFFLINE`, y sin
          // el modelo de ese idioma el turno muere al instante con
          // ERROR_LANGUAGE_UNAVAILABLE ("supported, but not yet downloaded").
          // Por red, el reconocedor de Google cubre los nueve idiomas.
          requiresOnDeviceRecognition:
            Platform.OS === "ios" ? ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() : false,
          // iOS enruta `playAndRecord` al AURICULAR por defecto; `defaultToSpeaker`
          // la manda al altavoz, que es por donde el usuario espera oir la app.
          //
          // El modo es `default` y NO `measurement`, aunque `measurement` sea el
          // que recomiendan para reconocer: desactiva el procesado de SALIDA, y
          // si un turno se queda a medias (una excepcion, el usuario saliendo de
          // la pantalla) ese modo se hereda y todo lo que suene despues sale
          // bajo y apagado. Un reconocimiento un pelo peor es mejor que una app
          // que se queda muda a la primera.
          iosCategory: {
            category: AVAudioSessionCategory.playAndRecord,
            categoryOptions: [
              AVAudioSessionCategoryOptions.defaultToSpeaker,
              AVAudioSessionCategoryOptions.allowBluetooth,
            ],
            mode: AVAudioSessionMode.default,
          },
        });
        if (mountedRef.current) setIsRecording(true);

        clearAutoStop();
        autoStopRef.current = setTimeout(() => {
          autoStopRef.current = null;
          // `stop` pide el resultado final; el evento `result` cierra el turno.
          try {
            ExpoSpeechRecognitionModule.stop();
          } catch {
            // Ya habia parado solo.
          }
        }, MAX_LISTENING_MS);

        return { ok: true };
      } catch (error) {
        // TEMPORAL (diagnostico Android)
        console.log("[speaking-start]", {
          paso: "failed",
          platform: Platform.OS,
          available,
          supportsOnDevice,
          permission: permissionStatus,
          error: String(error),
        });
        handlersRef.current = null;
        settledRef.current = true;
        if (mountedRef.current) setIsRecording(false);
        restauracionRef.current = restaurarModoDeReproduccion().catch(() => {});
        return { ok: false, reason: "failed" };
      }
    },
    [clearAutoStop]
  );

  /** Para y pide el resultado final; llega por `onFinal` o por `onFailure`. */
  const stop = useCallback(() => {
    clearAutoStop();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // No estaba escuchando.
    }
  }, [clearAutoStop]);

  /** Corta el turno sin resultado (salir del ejercicio, pausar). */
  const cancel = useCallback(() => {
    clearAutoStop();
    settledRef.current = true;
    handlersRef.current = null;
    finalsRef.current = [];
    if (mountedRef.current) setIsRecording(false);
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // No estaba escuchando.
    }
    // Salir del ejercicio o pausar tampoco puede dejar la sesion en modo
    // grabacion: el siguiente sonido de la app sonaria por el auricular.
    restauracionRef.current = restaurarModoDeReproduccion().catch(() => {});
  }, [clearAutoStop]);

  // Memoizado: el objeto entra en las dependencias de effects de la pantalla,
  // y devolverlo nuevo en cada render los haria correr en cada render.
  return useMemo(
    () => ({ isRecording, start, stop, cancel, maxListeningMs: MAX_LISTENING_MS }),
    [isRecording, start, stop, cancel]
  );
}
