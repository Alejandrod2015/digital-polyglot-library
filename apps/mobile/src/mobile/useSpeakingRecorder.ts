import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Audio, InterruptionModeIOS } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

/**
 * El microfono del ejercicio de speaking, sin nada de pantalla.
 *
 * Sale de `PracticeSpeaking.tsx`, la pantalla suelta del prototipo, para que
 * el turno hablado pueda vivir dentro de la sesion de practica como un
 * ejercicio mas. Lo que hace y por que:
 *
 *   - `allowsRecordingIOS` de IDA Y VUELTA. Grabar lo exige en true, pero
 *     dejarlo asi deja la ruta de audio sesgada a grabacion y el siguiente
 *     ejercicio suena bajito. Se vuelve a false en cuanto se para.
 *   - Tope de 12 s con auto-stop. Una respuesta de un turno no dura mas, y
 *     sin tope un micro olvidado abierto sube un clip largo a Whisper.
 *   - El clip sale en base64 porque `apiFetch` solo manda JSON.
 */

const MAX_RECORDING_MS = 12000;

export type SpeakingRecorderClip = { base64: string; mimeType: string };

export type SpeakingRecorderStartResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "failed" };

async function setRecordingAudioMode(recording: boolean): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: recording,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  });
}

export function useSpeakingRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearAutoStop = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAutoStop();
      // Teardown best-effort si el usuario sale a mitad de la grabacion.
      const rec = recordingRef.current;
      if (rec) {
        recordingRef.current = null;
        rec.stopAndUnloadAsync().catch(() => {});
        setRecordingAudioMode(false).catch(() => {});
      }
    };
  }, [clearAutoStop]);

  /** Para el micro y devuelve el clip en base64, o null si no habia nada. */
  const stop = useCallback(async (): Promise<SpeakingRecorderClip | null> => {
    clearAutoStop();
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (mountedRef.current) setIsRecording(false);
    if (!recording) return null;

    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // Ya estaba parada; seguimos para recuperar el fichero si lo hay.
    }
    await setRecordingAudioMode(false).catch(() => {});

    const uri = recording.getURI();
    if (!uri) return null;
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      if (!base64) return null;
      return { base64, mimeType: "audio/m4a" };
    } catch {
      return null;
    }
  }, [clearAutoStop]);

  /**
   * Arranca el micro. `onMaxDuration` se dispara cuando salta el auto-stop de
   * los 12 s, para que la pantalla envie el clip sin que el usuario toque nada.
   */
  const start = useCallback(
    async (onMaxDuration?: () => void): Promise<SpeakingRecorderStartResult> => {
      try {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) return { ok: false, reason: "denied" };
        await setRecordingAudioMode(true);
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        if (mountedRef.current) setIsRecording(true);
        clearAutoStop();
        autoStopRef.current = setTimeout(() => {
          autoStopRef.current = null;
          onMaxDuration?.();
        }, MAX_RECORDING_MS);
        return { ok: true };
      } catch {
        await setRecordingAudioMode(false).catch(() => {});
        if (mountedRef.current) setIsRecording(false);
        return { ok: false, reason: "failed" };
      }
    },
    [clearAutoStop]
  );

  /** Tira la grabacion sin devolver nada (salir del ejercicio, pausar). */
  const cancel = useCallback(async (): Promise<void> => {
    clearAutoStop();
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (mountedRef.current) setIsRecording(false);
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // nada que recuperar
    }
    await setRecordingAudioMode(false).catch(() => {});
    const uri = recording.getURI();
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }, [clearAutoStop]);

  // Memoizado: el objeto entra en las dependencias de effects de la pantalla,
  // y devolverlo nuevo en cada render los haria correr en cada render.
  return useMemo(
    () => ({ isRecording, start, stop, cancel, maxRecordingMs: MAX_RECORDING_MS }),
    [isRecording, start, stop, cancel]
  );
}
