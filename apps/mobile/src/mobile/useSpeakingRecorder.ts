import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
 */

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
      if (heard) handlers?.onFinal(heard);
      else handlers?.onFailure(fallbackCode);
    },
    [finish]
  );

  useSpeechRecognitionEvent("error", (event) => {
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
      try {
        if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
          return { ok: false, reason: "unavailable" };
        }
        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!permission.granted) return { ok: false, reason: "denied" };

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
          // En el dispositivo cuando el sistema lo ofrece para ese idioma; si
          // no, el reconocimiento del propio sistema. En ningun caso algo
          // nuestro.
          requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
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
      } catch {
        handlersRef.current = null;
        settledRef.current = true;
        if (mountedRef.current) setIsRecording(false);
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
  }, [clearAutoStop]);

  // Memoizado: el objeto entra en las dependencias de effects de la pantalla,
  // y devolverlo nuevo en cada render los haria correr en cada render.
  return useMemo(
    () => ({ isRecording, start, stop, cancel, maxListeningMs: MAX_LISTENING_MS }),
    [isRecording, start, stop, cancel]
  );
}
