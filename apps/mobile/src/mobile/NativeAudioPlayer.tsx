import { Audio, InterruptionModeIOS, type AVPlaybackStatus } from "expo-av";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

type Props = {
  src?: string | null;
  onProgressChange?: (snapshot: PlaybackSnapshot) => void;
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

  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  const hasAudio = normalizedSrc.length > 0;
  const progressRatio = useMemo(() => {
    if (!playback.durationMillis) return 0;
    return Math.min(1, playback.positionMillis / playback.durationMillis);
  }, [playback.durationMillis, playback.positionMillis]);

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
            // Expo AV surfaces mid-playback failures (the AVPlayerItem 11800
            // "AVErrorUnknown" family) on the status object via `error` when
            // unloaded, or `didJustFinish === false && !isLoaded` otherwise.
            // We log the full context + URL so we can diagnose the next
            // time a reader's first story fails.
            if (!status.isLoaded && "error" in status && status.error) {
              console.error("[audio] playback status error", {
                error: status.error,
                url: normalizedSrc,
              });
              setError(
                typeof status.error === "string"
                  ? `Audio unavailable: ${status.error}`
                  : "Audio unavailable. Tap retry or check your connection."
              );
              return;
            }
            setPlayback(toSnapshot(status));
          }
        );

        if (cancelled) {
          await sound.unloadAsync().catch(() => undefined);
          return;
        }

        soundRef.current = sound;
      } catch (loadError) {
        if (!cancelled) {
          // Include the URL in the log so failures are traceable. 11800 =
          // AVFoundationErrorDomain / AVErrorUnknown, typically an HTTP 4xx
          // or format issue on the remote file.
          console.error("[audio] load failed", {
            error: loadError,
            url: normalizedSrc,
          });
          const message = loadError instanceof Error ? loadError.message : "Unable to load audio.";
          setError(`Audio unavailable: ${message}`);
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

  async function togglePlayback() {
    const sound = soundRef.current;
    if (!sound || !playback.isLoaded) return;

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

  async function cycleSpeed() {
    const sound = soundRef.current;
    if (!sound || !playback.isLoaded) return;

    const currentIndex = SPEEDS.findIndex((candidate) => candidate === playback.rate);
    const nextRate = SPEEDS[(currentIndex + 1) % SPEEDS.length] ?? 1;
    await sound.setRateAsync(nextRate, true);
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
        <Text style={styles.timeText}>{formatClock(playback.positionMillis)}</Text>
        <View style={styles.trackWrapper}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>
        </View>
        <Text style={styles.timeText}>{formatClock(playback.durationMillis)}</Text>
      </View>

      {variant !== "sticky" ? (
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Audio</Text>
          <Pressable onPress={() => void cycleSpeed()} style={styles.speedButton}>
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
            style={styles.iconButton}
            accessibilityLabel="qa-player-previous"
            testID="qa-player-previous"
          >
            <Feather name="skip-back" size={22} color="#dbe9ff" />
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
          <Feather
            name={playback.isPlaying ? "pause" : "play"}
            size={30}
            color="#f5f9ff"
            style={playback.isPlaying ? undefined : styles.playIconOffset}
          />
        </Pressable>

        <Pressable onPress={() => void seekBy(SEEK_STEP_MS)} style={styles.iconButton}>
          <Feather name="rotate-cw" size={24} color="#dbe9ff" />
          <Text style={styles.iconButtonText}>10</Text>
        </Pressable>

        {variant === "sticky" && canGoNext ? (
          <Pressable
            onPress={onNext}
            style={styles.iconButton}
            accessibilityLabel="qa-player-next"
            testID="qa-player-next"
          >
            <Feather name="skip-forward" size={22} color="#dbe9ff" />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => void cycleSpeed()}
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
    </View>
  );
}

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
    paddingHorizontal: 14,
  },
  topTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trackWrapper: {
    flex: 1,
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
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#203754",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f8c15c",
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
});
