import { Audio, InterruptionModeIOS, type AVPlaybackStatus } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

type Props = {
  src?: string | null;
  onProgressChange?: (snapshot: PlaybackSnapshot) => void;
  /** Called when the underlying audio load or playback fails. Lets the
   * parent fall back to a different URL (e.g. remote when local is bad). */
  onLoadError?: (details: { src: string; reason: string }) => void;
  variant?: "inline" | "sticky";
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
};

type PlaybackSnapshot = {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
  didJustFinish: boolean;
};

const SEEK_STEP_MS = 10_000;
const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
// Dimensiones del sheet del picker de velocidad. Hardcoded para que
// `measureInWindow` pueda computar el `top`/`left` exacto al que el
// sheet debe abrirse desde el botón. 4 opciones × ~32 px + padding
// = ~152 px. El ancho cabe holgadamente "1.50x" + check icon.
const SPEED_SHEET_WIDTH = 124;
const SPEED_SHEET_HEIGHT = 152;

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function toSnapshot(status: AVPlaybackStatus): PlaybackSnapshot {
  if (!status.isLoaded) {
    return {
      isLoaded: false,
      isPlaying: false,
      positionMillis: 0,
      durationMillis: 0,
      rate: 1,
      didJustFinish: false,
    };
  }

  return {
    isLoaded: true,
    isPlaying: status.isPlaying,
    positionMillis: status.positionMillis ?? 0,
    durationMillis: status.durationMillis ?? 0,
    rate: status.rate ?? 1,
    didJustFinish: status.didJustFinish ?? false,
  };
}

export function NativeAudioPlayer({
  src,
  onProgressChange,
  onLoadError,
  variant = "inline",
  canGoPrevious = false,
  canGoNext = false,
  onPrevious,
  onNext,
}: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playback, setPlayback] = useState<PlaybackSnapshot>({
    isLoaded: false,
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
    rate: 1,
    didJustFinish: false,
  });
  const [error, setError] = useState<string | null>(null);
  // Estilo Spotify: si el usuario toca play antes de que el audio
  // termine de cargar, recordamos la intención. Cuando el sound queda
  // cargado, autoreproducimos. Así un solo tap arranca el playback -
  // antes el primer tap se ignoraba con un early return.
  const pendingPlayRef = useRef(false);
  const [pendingPlay, setPendingPlay] = useState(false);

  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  const hasAudio = normalizedSrc.length > 0;
  const progressRatio = useMemo(() => {
    if (!playback.durationMillis) return 0;
    return Math.min(1, playback.positionMillis / playback.durationMillis);
  }, [playback.durationMillis, playback.positionMillis]);

  // Scrubbing: while the user is dragging on the progress track we
  // freeze the visible position to whatever ratio their finger is at,
  // and only commit a real seek (setPositionAsync) when they let go.
  // Without this, every progressUpdate from expo-av would yank the
  // bar back to the playhead while the user is still dragging.
  const trackWidthRef = useRef(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);
  const durationRef = useRef(0);
  durationRef.current = playback.durationMillis;
  const ratioFromX = (x: number): number => {
    const width = trackWidthRef.current;
    if (width <= 0) return 0;
    return Math.max(0, Math.min(1, x / width));
  };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Capture both tap and drag.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setIsScrubbing(true);
          setScrubRatio(ratioFromX(event.nativeEvent.locationX));
        },
        onPanResponderMove: (event) => {
          setScrubRatio(ratioFromX(event.nativeEvent.locationX));
        },
        onPanResponderRelease: (event) => {
          const finalRatio = ratioFromX(event.nativeEvent.locationX);
          setScrubRatio(finalRatio);
          const sound = soundRef.current;
          const duration = durationRef.current;
          if (sound && duration > 0) {
            void sound
              .setPositionAsync(Math.round(finalRatio * duration))
              .catch(() => undefined)
              .finally(() => setIsScrubbing(false));
          } else {
            setIsScrubbing(false);
          }
        },
        onPanResponderTerminate: () => {
          // Cancelled by another gesture (rare on iOS): drop the
          // scrub state without committing a seek.
          setIsScrubbing(false);
        },
      }),
    []
  );
  const displayRatio = isScrubbing ? scrubRatio : progressRatio;
  const displayPositionMs = isScrubbing
    ? Math.round(scrubRatio * playback.durationMillis)
    : playback.positionMillis;
  const handleTrackLayout = (event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width;
  };

  useEffect(() => {
    onProgressChange?.(playback);
  }, [onProgressChange, playback]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => undefined);
        soundRef.current = null;
      }

      setError(null);
      // Limpiamos la intención de play heredada del src previo: si el
      // user había tocado play en la historia anterior y aún estaba
      // cargando, no lo arrastramos al nuevo audio.
      pendingPlayRef.current = false;
      setPendingPlay(false);
      setPlayback({
        isLoaded: false,
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 0,
        rate: 1,
        didJustFinish: false,
      });

      if (!hasAudio) return;

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: normalizedSrc },
          { shouldPlay: false, progressUpdateIntervalMillis: 500 },
          (status) => {
            if (cancelled) return;
            if (!status.isLoaded && "error" in status && status.error) {
              console.error("[audio] playback status error", {
                error: status.error,
                url: normalizedSrc,
              });
              // Let the parent decide whether to retry with a different URL
              // (e.g. fall back to the remote file when a local `file://`
              // cached copy turns out to be corrupt).
              onLoadError?.({
                src: normalizedSrc,
                reason: typeof status.error === "string" ? status.error : "unknown",
              });
            }
            setPlayback(toSnapshot(status));
          }
        );

        if (cancelled) {
          await sound.unloadAsync().catch(() => undefined);
          return;
        }

        soundRef.current = sound;

        // Aquí (tras el await) el sound ya está cargado y soundRef
        // asignado. Si el usuario tocó play durante la carga, lo
        // disparamos ahora; ÚNICA manera confiable de no perder el
        // tap. El check anterior dentro del status callback fallaba
        // porque el callback puede dispararse con `isLoaded: true`
        // ANTES de que await resuelva y soundRef se asigne, y luego
        // no vuelve a fire si no estamos reproduciendo.
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          setPendingPlay(false);
          void sound.playAsync().catch(() => undefined);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("[audio] load failed", {
            error: loadError,
            url: normalizedSrc,
          });
          const message = loadError instanceof Error ? loadError.message : "Unable to load audio.";
          // For local file:// sources we let the parent decide whether to
          // fall back to a remote URL before surfacing any error text -
          // seeing "Audio unavailable" flash for 400 ms and then the
          // player recovering is worse UX than a silent swap.
          const isLocalFile = normalizedSrc.startsWith("file://");
          if (!isLocalFile) {
            // Mensajes user-facing: NUNCA exponer texto técnico
            // (códigos NSURLError, paths file://, "AVPlayer instance
            // has failed"). El detalle ya quedó en `console.error`
            // arriba; al usuario le mostramos algo accionable.
            const isOffline =
              /-1009|NotConnectedToInternet|NSURLErrorDomain.*-1009/.test(message) ||
              /-1001|TimedOut/.test(message);
            const friendly = isOffline
              ? "You're offline. Download this story to listen without an internet connection."
              : "Audio isn't available right now. Try again in a moment.";
            setError(friendly);
          }
          onLoadError?.({ src: normalizedSrc, reason: message });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => undefined);
        soundRef.current = null;
      }
    };
  }, [hasAudio, normalizedSrc]);

  // Mantener la pantalla encendida mientras el audio esté sonando. El lock se
  // libera al pausar/terminar y en el unmount para que nunca quede colgado.
  useEffect(() => {
    const tag = "dpl-audio-player";
    if (playback.isPlaying) {
      void activateKeepAwakeAsync(tag).catch(() => undefined);
    } else {
      void deactivateKeepAwake(tag).catch(() => undefined);
    }
    return () => {
      void deactivateKeepAwake(tag).catch(() => undefined);
    };
  }, [playback.isPlaying]);

  async function togglePlayback() {
    const sound = soundRef.current;
    // Audio aún cargando: marcamos la intención y mostramos spinner.
    // Cuando el callback de status confirme isLoaded, autoreproducimos.
    // Si el user vuelve a tocar mientras carga, cancelamos el pending.
    if (!sound || !playback.isLoaded) {
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        setPendingPlay(false);
      } else {
        pendingPlayRef.current = true;
        setPendingPlay(true);
      }
      return;
    }

    if (playback.isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  }

  async function seekBy(deltaMs: number) {
    const sound = soundRef.current;
    if (!sound || !playback.isLoaded) return;

    const nextPosition = Math.max(
      0,
      Math.min(playback.durationMillis || Number.MAX_SAFE_INTEGER, playback.positionMillis + deltaMs)
    );

    await sound.setPositionAsync(nextPosition);
  }

  // Picker para la velocidad. El menú se ancla al botón que lo
  // disparó (midiendo `measureInWindow`) y se despliega hacia
  // arriba. El backdrop full-screen captura taps fuera para cerrar.
  const speedHeaderButtonRef = useRef<View | null>(null);
  const speedInlineButtonRef = useRef<View | null>(null);
  const [speedPickerAnchor, setSpeedPickerAnchor] = useState<{ top: number; left: number } | null>(null);
  const speedPickerOpen = speedPickerAnchor !== null;

  function toggleSpeedPicker(buttonRef: React.MutableRefObject<View | null>) {
    // Toggle: si está abierto, cerrar; si no, abrir.
    if (speedPickerAnchor !== null) {
      setSpeedPickerAnchor(null);
      return;
    }
    // Apertura inmediata con anchor de fallback (esquina
    // inferior-derecha de la pantalla) para que el picker SIEMPRE
    // aparezca al primer tap, incluso si `measureInWindow` se
    // demora o no resuelve. Después la medida real refina la
    // posición exacta justo arriba del botón.
    const window = Dimensions.get("window");
    const fallback = {
      top: Math.max(20, window.height - SPEED_SHEET_HEIGHT - 120),
      left: Math.max(8, window.width - SPEED_SHEET_WIDTH - 16),
    };
    setSpeedPickerAnchor(fallback);
    const node = buttonRef.current;
    if (!node) return;
    node.measureInWindow((x, y, width) => {
      // Sheet alineado por la derecha al borde derecho del botón;
      // su esquina inferior queda 6 px arriba del borde superior
      // del botón (despliegue hacia arriba estilo dropdown).
      const left = Math.max(8, x + width - SPEED_SHEET_WIDTH);
      const top = Math.max(20, y - SPEED_SHEET_HEIGHT - 6);
      setSpeedPickerAnchor({ top, left });
    });
  }

  async function applySpeed(rate: number) {
    const sound = soundRef.current;
    setSpeedPickerAnchor(null);
    if (!sound || !playback.isLoaded) return;
    await sound.setRateAsync(rate, true);
  }

  if (!hasAudio) {
    return (
      <View style={[styles.disabledCard, variant === "sticky" ? styles.stickyCard : null]}>
        <Text style={styles.disabledTitle}>Audio coming next</Text>
        <Text style={styles.disabledBody}>
          This story still has reading support only. Native playback is ready for stories with audio.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, variant === "sticky" ? styles.stickyCard : null]}>
      <View style={styles.topTrackRow}>
        <Text style={styles.timeText}>{formatClock(displayPositionMs)}</Text>
        {/* trackWrapper hosts the gesture; padding around the visible
            bar gives a fat hit area so the user can grab it without
            having to land exactly on the 4-pt-tall pill. */}
        <View
          style={styles.trackWrapper}
          onLayout={handleTrackLayout}
          {...panResponder.panHandlers}
        >
          <View style={[styles.progressTrack, isScrubbing ? styles.progressTrackActive : null]}>
            <View
              style={[
                styles.progressFill,
                { width: `${displayRatio * 100}%` },
                isScrubbing ? styles.progressFillActive : null,
              ]}
            />
            <View
              style={[
                styles.progressThumb,
                { left: `${displayRatio * 100}%` },
                isScrubbing ? styles.progressThumbActive : null,
              ]}
              pointerEvents="none"
            />
          </View>
        </View>
        <Text style={styles.timeText}>{formatClock(playback.durationMillis)}</Text>
      </View>

      {variant !== "sticky" ? (
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Audio</Text>
          <Pressable
            ref={speedHeaderButtonRef}
            onPress={() => toggleSpeedPicker(speedHeaderButtonRef)}
            style={styles.speedButton}
          >
            <Text style={styles.speedButtonText}>
              {playback.rate === 1 ? "1x" : `${playback.rate.toFixed(2)}x`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.controlsRow, variant === "sticky" ? styles.stickyControlsRow : null]}>
        {variant === "sticky" && canGoPrevious ? (
          <Pressable
            onPress={onPrevious}
            style={[styles.iconButton, styles.chapterNavButton]}
            accessibilityLabel="qa-player-previous"
            testID="qa-player-previous"
          >
            <Feather name="skip-back" size={18} color="rgba(219,233,255,0.7)" />
          </Pressable>
        ) : null}

        <Pressable onPress={() => void seekBy(-SEEK_STEP_MS)} style={styles.iconButton}>
          <Feather name="rotate-ccw" size={24} color="#dbe9ff" />
          <Text style={styles.iconButtonText}>10</Text>
        </Pressable>

        <Pressable
          onPress={() => void togglePlayback()}
          style={[styles.primaryButton, styles.playButton]}
          accessibilityLabel="qa-player-play-toggle"
          testID="qa-player-play-toggle"
        >
          {pendingPlay && !playback.isLoaded ? (
            // Spinner mientras el audio carga tras el primer tap.
            // Da feedback inmediato (estilo Spotify): el botón
            // reacciona al instante aunque el sound aún no esté listo.
            <ActivityIndicator size="small" color="#f5f9ff" />
          ) : (
            <Feather
              name={playback.isPlaying ? "pause" : "play"}
              size={30}
              color="#f5f9ff"
              style={playback.isPlaying ? undefined : styles.playIconOffset}
            />
          )}
        </Pressable>

        <Pressable onPress={() => void seekBy(SEEK_STEP_MS)} style={styles.iconButton}>
          <Feather name="rotate-cw" size={24} color="#dbe9ff" />
          <Text style={styles.iconButtonText}>10</Text>
        </Pressable>

        {variant === "sticky" && canGoNext ? (
          <Pressable
            onPress={onNext}
            style={[styles.iconButton, styles.chapterNavButton]}
            accessibilityLabel="qa-player-next"
            testID="qa-player-next"
          >
            <Feather name="skip-forward" size={18} color="rgba(219,233,255,0.7)" />
          </Pressable>
        ) : null}

        <Pressable
          ref={speedInlineButtonRef}
          onPress={() => toggleSpeedPicker(speedInlineButtonRef)}
          style={[styles.speedButton, styles.speedButtonInline]}
          accessibilityLabel="qa-player-speed"
          testID="qa-player-speed"
        >
          <Text style={styles.speedButtonText}>
            {playback.rate === 1 ? "1x" : `${playback.rate.toFixed(2)}x`}
          </Text>
          <Feather name="chevron-up" size={12} color="#dbe9ff" />
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={speedPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSpeedPickerAnchor(null)}
      >
        <Pressable
          style={styles.speedPickerBackdrop}
          onPress={() => setSpeedPickerAnchor(null)}
        />
        {speedPickerAnchor ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.speedPickerSheet,
              {
                position: "absolute",
                top: speedPickerAnchor.top,
                left: speedPickerAnchor.left,
                width: SPEED_SHEET_WIDTH,
              },
            ]}
          >
            {SPEEDS.map((option) => {
              const active = Math.abs(option - playback.rate) < 0.01;
              return (
                <Pressable
                  key={option}
                  onPress={() => void applySpeed(option)}
                  style={[
                    styles.speedPickerOption,
                    active ? styles.speedPickerOptionActive : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`qa-player-speed-${option}`}
                  testID={`qa-player-speed-${option}`}
                >
                  <Text
                    style={[
                      styles.speedPickerOptionText,
                      active ? styles.speedPickerOptionTextActive : null,
                    ]}
                  >
                    {option === 1 ? "1x" : `${option.toFixed(2)}x`}
                  </Text>
                  {active ? (
                    <Feather name="check" size={14} color={tokenCheckColor} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

// Color del check para la opción activa; definido fuera del JSX
// para evitar que el inline string se reevalúe en cada render.
const tokenCheckColor = "#fcd34d";

const styles = StyleSheet.create({
  card: {
    gap: 10,
    borderRadius: 20,
    backgroundColor: "#132237",
    borderWidth: 1,
    borderColor: "#28415f",
    padding: 16,
  },
  disabledCard: {
    gap: 8,
    borderRadius: 20,
    backgroundColor: "#132237",
    borderWidth: 1,
    borderColor: "#28415f",
    padding: 16,
  },
  stickyCard: {
    borderRadius: 18,
    backgroundColor: "#081626",
    borderColor: "#18314e",
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 22,
  },
  topTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trackWrapper: {
    flex: 1,
    // Vertical padding gives the gesture a generous touch area even
    // though the visible bar is only 6 pt tall. Spotify-style.
    paddingVertical: 12,
  },
  disabledTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  disabledBody: {
    color: "#c4d3e7",
    fontSize: 14,
    lineHeight: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  speedButton: {
    borderRadius: 999,
    backgroundColor: "#1a2f4a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  speedButtonText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#203754",
    position: "relative",
    // overflow visible so the thumb can extend slightly beyond the
    // bar edges; the fill clips itself via its own borderRadius.
  },
  progressTrackActive: {
    height: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f8c15c",
  },
  progressFillActive: {
    backgroundColor: "#ffd58c",
  },
  progressThumb: {
    position: "absolute",
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    marginLeft: -8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  progressThumbActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    top: -6,
    marginLeft: -10,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    color: "#b7c9de",
    fontSize: 11,
    fontWeight: "600",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stickyControlsRow: {
    gap: 16,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: "#2d74ff",
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    shadowColor: "#2d74ff",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryButtonText: {
    color: "#0b1626",
    fontSize: 15,
    fontWeight: "800",
  },
  playIconOffset: {
    marginLeft: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  // Override solo para los botones de capítulo anterior/siguiente en
  // variant="sticky". Más chicos y opacidad reducida para que actúen
  // como secundarios al lado del play + back-10/fwd-10. Las historias
  // de journey nunca renderizan estos botones (canGoPrevious=false),
  // así que su panel sigue exactamente igual.
  chapterNavButton: {
    width: 32,
    height: 32,
  },
  iconButtonText: {
    color: "#dbe9ff",
    fontSize: 8,
    fontWeight: "800",
    position: "absolute",
  },
  iconButtonDisabled: {
    opacity: 0.52,
  },
  speedButtonInline: {
    backgroundColor: "#122841",
    width: 74,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  errorText: {
    color: "#ffb4b4",
    fontSize: 13,
    lineHeight: 18,
  },
  speedPickerBackdrop: {
    // Cubre toda la pantalla; las taps fuera del sheet cierran. No
    // tinta el fondo (transparente) para que el dropdown se sienta
    // como un menú nativo, no como un modal centrado.
    ...StyleSheet.absoluteFillObject,
  },
  speedPickerSheet: {
    backgroundColor: "#0f1f33",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#28415f",
    paddingVertical: 6,
    paddingHorizontal: 6,
    // Sombra suave para que el sheet se separe visualmente del
    // contenido detrás.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 8,
  },
  speedPickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  speedPickerOptionActive: {
    backgroundColor: "rgba(252, 211, 77, 0.16)",
  },
  speedPickerOptionText: {
    color: "#dbe9ff",
    fontSize: 14,
    fontWeight: "700",
  },
  speedPickerOptionTextActive: {
    color: "#fcd34d",
    fontWeight: "800",
  },
});
