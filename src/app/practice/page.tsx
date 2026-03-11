"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import {
  buildPracticeSession,
  getDuePracticeItems,
  getSpeechSynthesisLang,
  PracticeAudioClip,
  PracticeExercise,
  PracticeFavoriteItem,
  PracticeMode,
} from "@/lib/practiceExercises";
import {
  coerceAudioSegments,
  findBestAudioSegment,
  findBestAudioSegmentLegacy,
  type AudioSegment,
} from "@/lib/audioSegments";
import { isStandaloneSourcePath } from "@/lib/storySource";

type LoadState = "loading" | "ready" | "error";
type StoryAudioData = {
  audioUrl: string | null;
  audioSegments: AudioSegment[];
};

function normalizeStorySlug(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function findSegmentForClip(
  storyAudio: StoryAudioData | null | undefined,
  clip: PracticeAudioClip | null | undefined
): AudioSegment | null {
  if (!storyAudio || !clip) return null;
  if (clip.storySource !== "standalone") {
    return findBestAudioSegmentLegacy(storyAudio.audioSegments, clip.sentence);
  }
  const segmentId = typeof clip.segmentId === "string" ? clip.segmentId.trim() : "";

  const exactById =
    segmentId
      ? storyAudio.audioSegments.find((segment) => segment.id === segmentId) ?? null
      : null;

  if (exactById) return exactById;

  return findBestAudioSegment(storyAudio.audioSegments, clip.sentence, {
    targetWord: clip.targetWord,
    mode: "strict",
  });
}

function isStandaloneFavorite(item: PracticeFavoriteItem): boolean {
  return isStandaloneSourcePath(item.sourcePath, item.storySlug);
}

const matchColorClasses = [
  "border-sky-400 bg-sky-400/18 text-sky-100",
  "border-emerald-400 bg-emerald-400/18 text-emerald-100",
  "border-amber-300 bg-amber-300/18 text-amber-100",
  "border-fuchsia-400 bg-fuchsia-400/18 text-fuchsia-100",
  "border-cyan-300 bg-cyan-300/18 text-cyan-100",
  "border-rose-400 bg-rose-400/18 text-rose-100",
];

const CLIP_START_PADDING_SEC = 0.08;
const CLIP_END_TRIM_SEC = 0.5;

type FeedbackTone = "correct" | "wrong";

function getCompletionTone(score: number, total: number) {
  const ratio = total > 0 ? score / total : 0;

  if (ratio === 1) {
    return {
      badge: "Perfect session",
      line: "You cleared every prompt. Keep the momentum going.",
      accent: "from-emerald-400/35 via-teal-300/25 to-transparent",
      scoreColor: "text-emerald-300",
      pill: "border-emerald-300/35 bg-emerald-300/14 text-emerald-100",
    };
  }

  if (ratio >= 0.8) {
    return {
      badge: "Strong session",
      line: "Your review is holding up well. One more round would lock it in.",
      accent: "from-sky-400/30 via-cyan-300/20 to-transparent",
      scoreColor: "text-sky-300",
      pill: "border-sky-300/35 bg-sky-300/14 text-sky-100",
    };
  }

  if (ratio >= 0.6) {
    return {
      badge: "Good progress",
      line: "You are moving in the right direction. Another short set will help.",
      accent: "from-amber-300/30 via-yellow-200/20 to-transparent",
      scoreColor: "text-amber-200",
      pill: "border-amber-200/35 bg-amber-200/14 text-amber-50",
    };
  }

  return {
    badge: "Keep going",
    line: "This was still useful. A second round now will feel much easier.",
    accent: "from-rose-300/28 via-pink-200/18 to-transparent",
    scoreColor: "text-rose-200",
    pill: "border-rose-200/35 bg-rose-200/12 text-rose-50",
  };
}

export default function PracticePage() {
  const { user, isLoaded } = useUser();
  const [favorites, setFavorites] = useState<PracticeFavoriteItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({});
  const [activeMatchWord, setActiveMatchWord] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [speakingClipId, setSpeakingClipId] = useState<string | null>(null);
  const [userStoryAudioBySlug, setUserStoryAudioBySlug] = useState<Record<string, StoryAudioData>>({});
  const [standaloneStoryAudioBySlug, setStandaloneStoryAudioBySlug] = useState<Record<string, StoryAudioData>>({});
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);
  const clipStopAtRef = useRef<number | null>(null);
  const clipTimeHandlerRef = useRef<(() => void) | null>(null);
  const feedbackAudioContextRef = useRef<AudioContext | null>(null);
  const feedbackSoundRefs = useRef<Record<FeedbackTone, HTMLAudioElement | null>>({
    correct: null,
    wrong: null,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setFavorites([]);
      setUserStoryAudioBySlug({});
      setStandaloneStoryAudioBySlug({});
      setLoadState("ready");
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoadState("loading");
        const res = await fetch("/api/favorites", { cache: "no-store" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as PracticeFavoriteItem[];
        if (!cancelled) {
          setFavorites(Array.isArray(data) ? data : []);
          setLoadState("ready");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setFavorites([]);
          setLoadState("error");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  useEffect(() => {
    const userStorySlugs = Array.from(
      new Set(
        favorites
          .filter((favorite) => !isStandaloneFavorite(favorite))
          .map((favorite) => (typeof favorite.storySlug === "string" ? favorite.storySlug.trim() : ""))
          .filter(Boolean)
      )
    );

    if (userStorySlugs.length === 0) {
      setUserStoryAudioBySlug({});
    }

    const standaloneStorySlugs = Array.from(
      new Set(
        favorites
          .filter((favorite) => isStandaloneFavorite(favorite))
          .map((favorite) => (typeof favorite.storySlug === "string" ? favorite.storySlug.trim() : ""))
          .filter(Boolean)
      )
    );

    if (standaloneStorySlugs.length === 0) {
      setStandaloneStoryAudioBySlug({});
    }

    let cancelled = false;

    const loadUserStoryAudio = async () => {
      if (userStorySlugs.length === 0) return;
      try {
        const res = await fetch(`/api/user-stories?slugs=${encodeURIComponent(userStorySlugs.join(","))}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as {
          stories?: Array<{ slug?: string; audioUrl?: string | null; audioSegments?: unknown }>;
        };

        if (cancelled) return;

        const next: Record<string, StoryAudioData> = {};
        for (const story of data.stories ?? []) {
          const slug = normalizeStorySlug(story.slug);
          if (!slug) continue;
          next[slug] = {
            audioUrl: typeof story.audioUrl === "string" ? story.audioUrl : null,
            audioSegments: coerceAudioSegments(story.audioSegments),
          };
        }
        setUserStoryAudioBySlug(next);
      } catch (error) {
        console.error("[practice] failed to load user story audio segments", error);
        if (!cancelled) setUserStoryAudioBySlug({});
      }
    };

    const loadStandaloneStoryAudio = async () => {
      if (standaloneStorySlugs.length === 0) return;
      try {
        const res = await fetch(
          `/api/standalone-story-audio?slugs=${encodeURIComponent(standaloneStorySlugs.join(","))}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as {
          stories?: Array<{ slug?: string; audioUrl?: string | null; audioSegments?: unknown }>;
        };

        if (cancelled) return;

        const next: Record<string, StoryAudioData> = {};
        for (const story of data.stories ?? []) {
          const slug = normalizeStorySlug(story.slug);
          if (!slug) continue;
          next[slug] = {
            audioUrl: typeof story.audioUrl === "string" ? story.audioUrl : null,
            audioSegments: coerceAudioSegments(story.audioSegments),
          };
        }
        setStandaloneStoryAudioBySlug(next);
      } catch (error) {
        console.error("[practice] failed to load standalone story audio segments", error);
        if (!cancelled) setStandaloneStoryAudioBySlug({});
      }
    };

    void loadUserStoryAudio();
    void loadStandaloneStoryAudio();

    return () => {
      cancelled = true;
    };
  }, [favorites]);

  const exercises = useMemo(
    () => (selectedMode ? buildPracticeSession(favorites, selectedMode) : []),
    [favorites, selectedMode]
  );
  const currentExercise = exercises[exerciseIndex] ?? null;
  const dueCount = useMemo(() => getDuePracticeItems(favorites).length, [favorites]);
  const revealed = currentExercise ? revealedIds.includes(currentExercise.id) : false;
  const activeSession = selectedMode !== null;
  const completedExerciseCount = sessionComplete ? exercises.length : revealedIds.length;
  const progressPercent =
    exercises.length > 0 ? Math.min(100, (completedExerciseCount / exercises.length) * 100) : 0;
  const showFeedback = Boolean(revealed && currentExercise);
  const canSubmitAnswer = currentExercise
    ? currentExercise.type === "match_meaning"
      ? currentExercise.pairs.every((pair) => Boolean(matchAnswers[pair.word]))
      : Boolean(selectedOption)
    : false;

  const openSession = useCallback((mode: PracticeMode) => {
    if (typeof window !== "undefined") {
      window.history.pushState({ practiceSession: true }, "", window.location.href);
    }
    setSelectedMode(mode);
  }, []);

  const closeSession = useCallback(() => {
    if (typeof window !== "undefined" && window.history.state?.practiceSession) {
      window.history.back();
      return;
    }
    setSelectedMode(null);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.practiceActive = activeSession ? "true" : "false";
    window.dispatchEvent(new Event("practice-session-visibility-change"));
    return () => {
      document.body.dataset.practiceActive = "false";
      window.dispatchEvent(new Event("practice-session-visibility-change"));
    };
  }, [activeSession]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeSession) return;

    const handlePopState = () => {
      setSelectedMode(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activeSession]);

  useEffect(() => {
    setExerciseIndex(0);
    setSelectedOption(null);
    setMatchAnswers({});
    setActiveMatchWord(null);
    setRevealedIds([]);
    setScore(0);
    setSessionComplete(false);
    setStreak(0);
    setLastResult(null);
  }, [selectedMode, favorites.length]);

  useEffect(() => {
    setSelectedOption(null);
    setMatchAnswers({});
    setActiveMatchWord(null);
    setLastResult(null);
    setPlayingClipId(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingClipId(null);
  }, [exerciseIndex]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeSession) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeSession, exerciseIndex, sessionComplete]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const correct = new Audio("/sounds/practice-correct.wav");
      const wrong = new Audio("/sounds/practice-wrong.wav");
      correct.preload = "auto";
      wrong.preload = "auto";
      feedbackSoundRefs.current.correct = correct;
      feedbackSoundRefs.current.wrong = wrong;
    }

    const feedbackSounds = feedbackSoundRefs.current;

    return () => {
      const audio = clipAudioRef.current;
      if (audio && clipTimeHandlerRef.current) {
        audio.removeEventListener("timeupdate", clipTimeHandlerRef.current);
      }
      audio?.pause();
      feedbackSounds.correct?.pause();
      feedbackSounds.wrong?.pause();
      feedbackAudioContextRef.current?.close().catch(() => {});
    };
  }, []);

  const playGeneratedFeedbackTone = useCallback((tone: FeedbackTone) => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

    if (!AudioContextClass) return;

    const context =
      feedbackAudioContextRef.current && feedbackAudioContextRef.current.state !== "closed"
        ? feedbackAudioContextRef.current
        : new AudioContextClass();
    feedbackAudioContextRef.current = context;

    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const master = context.createGain();
    master.connect(context.destination);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(tone === "correct" ? 0.08 : 0.055, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + (tone === "correct" ? 0.34 : 0.28));

    const notes =
      tone === "correct"
        ? [
            { frequency: 660, start: 0, end: 0.12, type: "triangle" as OscillatorType },
            { frequency: 880, start: 0.1, end: 0.24, type: "sine" as OscillatorType },
            { frequency: 1046, start: 0.22, end: 0.34, type: "sine" as OscillatorType },
          ]
        : [
            { frequency: 320, start: 0, end: 0.12, type: "sawtooth" as OscillatorType },
            { frequency: 240, start: 0.1, end: 0.28, type: "triangle" as OscillatorType },
          ];

    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(tone === "correct" ? 0.85 : 0.65, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.end);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.end);
    }
  }, []);

  const playFeedbackSound = useCallback((tone: FeedbackTone) => {
    if (typeof window === "undefined") return;
    const sound = feedbackSoundRefs.current[tone];
    if (sound) {
      sound.currentTime = 0;
      void sound.play().catch(() => {
        playGeneratedFeedbackTone(tone);
      });
      return;
    }

    playGeneratedFeedbackTone(tone);
  }, [playGeneratedFeedbackTone]);

  const revealCurrent = () => {
    if (!currentExercise) return;
    setRevealedIds((prev) => (prev.includes(currentExercise.id) ? prev : [...prev, currentExercise.id]));

    const isCorrect =
      currentExercise.type === "match_meaning"
        ? currentExercise.pairs.every((pair) => matchAnswers[pair.word] === pair.answer)
        : selectedOption === currentExercise.answer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setStreak((prev) => prev + 1);
      setLastResult("correct");
      playFeedbackSound("correct");
    } else {
      setStreak(0);
      setLastResult("wrong");
      playFeedbackSound("wrong");
    }
  };

  const stopClipPlayback = useCallback(() => {
    const audio = clipAudioRef.current;
    if (audio && clipTimeHandlerRef.current) {
      audio.removeEventListener("timeupdate", clipTimeHandlerRef.current);
    }
    if (audio) {
      audio.pause();
    }
    clipStopAtRef.current = null;
    clipTimeHandlerRef.current = null;
    setPlayingClipId(null);
  }, []);

  useEffect(() => {
    stopClipPlayback();
  }, [exerciseIndex, stopClipPlayback]);

  const playExactContextClip = useCallback(
    async (clipOwnerId: string, clip: PracticeAudioClip | null | undefined) => {
      if (!clip || typeof window === "undefined") return;
      const normalizedSlug = normalizeStorySlug(clip.storySlug);
      const storyAudio =
        clip.storySource === "standalone"
          ? standaloneStoryAudioBySlug[normalizedSlug]
          : userStoryAudioBySlug[normalizedSlug];
      const segment = findSegmentForClip(storyAudio, clip);
      if (!storyAudio?.audioUrl || !segment) return;

      const audio = clipAudioRef.current ?? new Audio();
      clipAudioRef.current = audio;

      if (clipTimeHandlerRef.current) {
        audio.removeEventListener("timeupdate", clipTimeHandlerRef.current);
        clipTimeHandlerRef.current = null;
      }

      if (audio.src !== storyAudio.audioUrl) {
        audio.src = storyAudio.audioUrl;
      }

      const startPlayback = async () => {
        const isStandaloneClip = clip.storySource === "standalone";
        const directClipUrl =
          isStandaloneClip && typeof segment.clipUrl === "string" && segment.clipUrl.trim()
            ? segment.clipUrl.trim()
            : null;

        if (directClipUrl) {
          clipStopAtRef.current = null;
          if (audio.src !== directClipUrl) {
            audio.src = directClipUrl;
          }
          audio.currentTime = 0;
          setPlayingClipId(clipOwnerId);
          await audio.play();
          return;
        }

        const rawStartSec = isStandaloneClip
          ? segment.startSec
          : Math.max(0, segment.startSec - CLIP_START_PADDING_SEC);
        const rawEndSec = isStandaloneClip
          ? segment.endSec
          : Math.max(rawStartSec + 0.2, segment.endSec - CLIP_END_TRIM_SEC);
        const clipStartSec = Math.max(0, rawStartSec);
        const clipEndSec =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.min(audio.duration, rawEndSec)
            : rawEndSec;

        clipStopAtRef.current = clipEndSec;
        audio.currentTime = clipStartSec;

        const onTimeUpdate = () => {
          if (clipStopAtRef.current == null) return;
          if (audio.currentTime >= clipStopAtRef.current) {
            stopClipPlayback();
          }
        };

        clipTimeHandlerRef.current = onTimeUpdate;
        audio.addEventListener("timeupdate", onTimeUpdate);
        setPlayingClipId(clipOwnerId);
        await audio.play();
      };

      try {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
              audio.removeEventListener("loadedmetadata", onLoaded);
              audio.removeEventListener("error", onError);
              resolve();
            };
            const onError = () => {
              audio.removeEventListener("loadedmetadata", onLoaded);
              audio.removeEventListener("error", onError);
              reject(new Error("Could not load clip metadata"));
            };
            audio.addEventListener("loadedmetadata", onLoaded, { once: true });
            audio.addEventListener("error", onError, { once: true });
            audio.load();
          });
        }

        if (playingClipId === clipOwnerId) {
          stopClipPlayback();
          return;
        }

        stopClipPlayback();
        await startPlayback();
      } catch (error) {
        console.error("[practice] clip playback failed", error);
        stopClipPlayback();
      }
    },
    [playingClipId, standaloneStoryAudioBySlug, stopClipPlayback, userStoryAudioBySlug]
  );
  void playExactContextClip;

  const goNext = () => {
    if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex((prev) => prev + 1);
      return;
    }
    setSessionComplete(true);
  };

  const restart = () => {
    setExerciseIndex(0);
    setSelectedOption(null);
    setMatchAnswers({});
    setRevealedIds([]);
    setScore(0);
    setSessionComplete(false);
  };

  const playListenPrompt = () => {
    if (!currentExercise || currentExercise.type !== "listen_choose") return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentExercise.speechText);
    utterance.lang = getSpeechSynthesisLang(currentExercise.language);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const playTtsContextClip = useCallback((clipOwnerId: string, clip: PracticeAudioClip | null | undefined) => {
    if (!clip || clip.storySource !== "user" || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    if (speakingClipId === clipOwnerId) {
      synth.cancel();
      setSpeakingClipId(null);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(clip.sentence);
    const lang = getSpeechSynthesisLang(clip.language);
    utterance.lang = lang;
    utterance.rate = 0.92;

    const voices = synth.getVoices();
    const preferredVoice =
      voices.find((voice) => voice.lang?.toLowerCase().startsWith(lang.toLowerCase()) && /google|microsoft|natural|neural/i.test(voice.name)) ??
      voices.find((voice) => voice.lang?.toLowerCase().startsWith(lang.toLowerCase())) ??
      null;

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      setSpeakingClipId((current) => (current === clipOwnerId ? null : current));
    };
    utterance.onerror = () => {
      setSpeakingClipId((current) => (current === clipOwnerId ? null : current));
    };

    setSpeakingClipId(clipOwnerId);
    synth.speak(utterance);
  }, [speakingClipId]);

  const assignMatchMeaning = (meaning: string) => {
    if (!currentExercise || currentExercise.type !== "match_meaning" || !activeMatchWord || revealed) return;

    setMatchAnswers((prev) => {
      const next = { ...prev };
      for (const [word, assignedMeaning] of Object.entries(next)) {
        if (assignedMeaning === meaning) {
          delete next[word];
        }
      }
      next[activeMatchWord] = meaning;
      return next;
    });
    setActiveMatchWord(null);
  };

  const unassignMatchWord = (word: string) => {
    setMatchAnswers((prev) => {
      if (!prev[word]) return prev;
      const next = { ...prev };
      delete next[word];
      return next;
    });
    setActiveMatchWord((prev) => (prev === word ? null : prev));
  };

  const contextBlockClass =
    "mb-5 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3";

  const contextTextClass =
    "text-xs leading-6 text-[var(--muted)]/75 sm:text-sm";

  const renderContextBlock = (
    sentence: string,
    clip: PracticeAudioClip | null | undefined,
    clipOwnerId: string
  ) => {
    const normalizedSlug = clip ? normalizeStorySlug(clip.storySlug) : "";
    const storyAudio = clip
      ? clip.storySource === "standalone"
        ? standaloneStoryAudioBySlug[normalizedSlug]
        : userStoryAudioBySlug[normalizedSlug]
      : null;
    const exactSegment = findSegmentForClip(storyAudio, clip);

    if (process.env.NODE_ENV !== "production" && clip) {
      console.debug("[practice] context clip resolution", {
        clipOwnerId,
        storySlug: clip.storySlug,
        storySource: clip.storySource,
        targetWord: clip.targetWord ?? null,
        segmentId: clip.segmentId ?? null,
        sentence: clip.sentence,
        hasStoryAudio: Boolean(storyAudio?.audioUrl),
        audioSegmentCount: storyAudio?.audioSegments.length ?? 0,
        resolvedSegmentId: exactSegment?.id ?? null,
      });
    }

    return (
      <div className={contextBlockClass}>
        <div className="flex items-start justify-between gap-3">
          <p className={`${contextTextClass} flex-1`}>{sentence}</p>
          <div className="flex shrink-0 items-center gap-2">
            {clip && clip.storySource === "user" ? (
              <button
                type="button"
                onClick={() => playTtsContextClip(clipOwnerId, clip)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white/10"
              >
                <Volume2 size={14} />
                {speakingClipId === clipOwnerId ? "Stop" : "Play"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const getCorrectAnswerText = (exercise: PracticeExercise | null) => {
    if (!exercise) return "";
    if (exercise.type === "match_meaning") {
      return exercise.pairs.map((pair) => `${pair.word} — ${pair.answer}`).join(" · ");
    }
    return exercise.answer;
  };

  const correctAnswerText = getCorrectAnswerText(currentExercise);
  const modeCards: Array<{
    mode: PracticeMode;
    title: string;
    detail: string;
    caption: string;
  }> = [
    {
      mode: "meaning",
      title: "Meaning",
      detail: "Choose the meaning that fits a word in context.",
      caption: "Best for locking in definitions with real usage.",
    },
    {
      mode: "context",
      title: "Context",
      detail: "Complete short sentences with the right word or expression.",
      caption: "Best for recall and sentence-level usage.",
    },
    {
      mode: "natural",
      title: "Natural usage",
      detail: "Spot the expression that sounds right in real language.",
      caption: "Best for phrases, connectors, and colloquial language.",
    },
    {
      mode: "listening",
      title: "Listening",
      detail: "Hear a word and choose what was said.",
      caption: "Best for audio recognition and fast review.",
    },
    {
      mode: "match",
      title: "Match",
      detail: "Match saved words to their meanings in quick sets.",
      caption: "Best for fast warm-up rounds.",
    },
  ];
  const completionTone = getCompletionTone(score, exercises.length);
  const completionBursts = useMemo(
    () => [
      { left: "8%", top: "18%", delay: "0ms", size: "h-2.5 w-2.5", color: "bg-emerald-300/80" },
      { left: "18%", top: "12%", delay: "80ms", size: "h-2 w-2", color: "bg-sky-300/80" },
      { left: "28%", top: "24%", delay: "160ms", size: "h-3 w-3", color: "bg-amber-200/85" },
      { left: "72%", top: "16%", delay: "120ms", size: "h-2.5 w-2.5", color: "bg-cyan-200/80" },
      { left: "82%", top: "10%", delay: "220ms", size: "h-2 w-2", color: "bg-emerald-200/80" },
      { left: "90%", top: "22%", delay: "140ms", size: "h-3 w-3", color: "bg-sky-200/80" },
      { left: "16%", top: "70%", delay: "260ms", size: "h-2 w-2", color: "bg-amber-200/75" },
      { left: "84%", top: "74%", delay: "320ms", size: "h-2.5 w-2.5", color: "bg-emerald-200/75" },
    ],
    []
  );

  if (!isLoaded || loadState === "loading") {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <div className="mb-4 h-9 w-48 animate-pulse rounded bg-[var(--card-bg)]" />
        <div className="mb-3 h-4 w-80 animate-pulse rounded bg-[var(--card-bg)]" />
        <div className="h-72 animate-pulse rounded-3xl bg-[var(--card-bg)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Sign in to practice your saved vocabulary with fill-in-the-blank, matching, listening,
          and context exercises.
        </p>
        <Link
          href="/sign-in?redirect_url=/practice"
          className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="text-sm text-amber-300">Could not load your saved vocabulary right now.</p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Save words while reading and they will appear here as exercises.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/explore"
            className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Explore stories
          </Link>
          <Link
            href="/favorites"
            className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
          >
            Open favorites
          </Link>
        </div>
      </div>
    );
  }

  if (activeSession) {
    return (
      <div className="-mx-1 -my-6 box-border h-[calc(100dvh-env(safe-area-inset-top))] overflow-hidden px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-[var(--foreground)] sm:px-5 sm:py-4 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mx-auto grid h-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] gap-2 sm:grid-rows-[auto_minmax(0,1fr)_144px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeSession}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--bg-content)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
              aria-label="Close practice"
            >
              <X size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 h-5">
                <p
                  className={`text-[11px] font-bold uppercase tracking-[0.2em] text-lime-300 transition-opacity duration-150 ${
                    streak > 1 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {streak > 1 ? `${streak} in a row` : "\u00a0"}
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/12">
                <div
                  className={`h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 ${
                    lastResult === "correct" && revealed ? "animate-pulse" : ""
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  {modeCards.find((card) => card.mode === selectedMode)?.title ?? "Practice"}
                </p>
                <p className="shrink-0 text-xs text-[var(--muted)]">
                  {sessionComplete ? "Complete" : `${exerciseIndex + 1}/${exercises.length}`}
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
            {sessionComplete ? (
              <div
                className="relative h-full overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-md"
                style={{ animation: "fade-in 220ms ease-out" }}
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b ${completionTone.accent}`}
                />
                {completionBursts.map((burst, index) => (
                  <span
                    key={`burst-${index}`}
                    aria-hidden="true"
                    className={`pointer-events-none absolute rounded-full ${burst.size} ${burst.color}`}
                    style={{
                      left: burst.left,
                      top: burst.top,
                      animation: `completion-pop 900ms ease-out ${burst.delay} both`,
                    }}
                  />
                ))}

                <div className="relative flex h-full flex-col">
                  <div
                    className={`mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 ${completionTone.pill}`}
                    style={{ animation: "fade-in 260ms ease-out" }}
                  >
                    {completionTone.badge}
                  </div>
                  <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Session complete</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                    {completionTone.line}
                  </p>
                  <div className="mt-6 flex flex-wrap items-end gap-4 rounded-[1.75rem] border border-white/8 bg-white/[0.03] px-5 py-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Final score
                      </p>
                      <p
                        className={`mt-2 text-6xl font-bold leading-none sm:text-7xl ${completionTone.scoreColor}`}
                        style={{ animation: "score-pop 260ms ease-out" }}
                      >
                        {score}/{exercises.length}
                      </p>
                    </div>
                    <div className="pb-1 text-sm leading-6 text-[var(--muted)]">
                      <p>You finished all {exercises.length} exercises in this set.</p>
                      <p>{score === exercises.length ? "No misses this round." : `${exercises.length - score} to revisit next time.`}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                    <button
                      type="button"
                      onClick={restart}
                      className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Practice 10 more
                    </button>
                    <Link
                      href="/favorites"
                      className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
                    >
                      Open favorites
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
                    >
                      Back to home
                    </Link>
                  </div>
                </div>

                <style jsx global>{`
                  @keyframes completion-pop {
                    0% {
                      opacity: 0;
                      transform: translateY(8px) scale(0.5);
                    }
                    60% {
                      opacity: 1;
                      transform: translateY(-6px) scale(1.08);
                    }
                    100% {
                      opacity: 0;
                      transform: translateY(-16px) scale(0.95);
                    }
                  }
                  @keyframes score-pop {
                    0% {
                      opacity: 0;
                      transform: translateY(12px) scale(0.96);
                    }
                    100% {
                      opacity: 1;
                      transform: translateY(0) scale(1);
                    }
                  }
                  @keyframes fade-in {
                    0% {
                      opacity: 0;
                      transform: translateY(10px);
                    }
                    100% {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                `}</style>
              </div>
            ) : currentExercise ? (
              <div className="flex h-full min-h-0 flex-col rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-[clamp(0.65rem,1.3vw,0.9rem)] shadow-md">
                <p className="mb-[clamp(0.35rem,0.9vh,0.6rem)] shrink-0 text-[clamp(1.15rem,2.4vw,1.8rem)] font-semibold leading-tight tracking-tight">
                  {currentExercise.prompt}
                </p>

                {currentExercise.type === "fill_blank" ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {renderContextBlock(
                      currentExercise.sentence,
                      currentExercise.audioClip,
                      currentExercise.id
                    )}
                    <div className="grid flex-1 auto-rows-fr gap-2.5 sm:grid-cols-2">
                      {currentExercise.options.map((option) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = revealed && option === currentExercise.answer;
                        const isWrong = revealed && isSelected && option !== currentExercise.answer;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedOption(option)}
                            disabled={revealed}
                            className={`rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${
                              isCorrect
                                ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                : isWrong
                                  ? "border-rose-400 bg-rose-400 text-slate-950"
                                  : isSelected
                                    ? "border-blue-400 bg-blue-500/20"
                                    : "border-[var(--card-border)] bg-[var(--bg-content)] hover:bg-[var(--card-bg-hover)]"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {currentExercise.type === "meaning_in_context" ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 shrink-0">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                        Target word
                      </p>
                      <p className="text-[clamp(2rem,4vw,2.65rem)] font-semibold leading-none tracking-tight">
                        {currentExercise.word}
                      </p>
                    </div>
                    {renderContextBlock(
                      currentExercise.sentence,
                      currentExercise.audioClip,
                      currentExercise.id
                    )}
                    <div className="grid flex-1 auto-rows-fr gap-2.5">
                      {currentExercise.options.map((option) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = revealed && option === currentExercise.answer;
                        const isWrong = revealed && isSelected && option !== currentExercise.answer;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedOption(option)}
                            disabled={revealed}
                            className={`rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${
                              isCorrect
                                ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                : isWrong
                                  ? "border-rose-400 bg-rose-400 text-slate-950"
                                  : isSelected
                                    ? "border-blue-400 bg-blue-500/20"
                                    : "border-[var(--card-border)] bg-[var(--bg-content)] hover:bg-[var(--card-bg-hover)]"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {currentExercise.type === "natural_expression" ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {renderContextBlock(
                      currentExercise.sentence,
                      currentExercise.audioClip,
                      currentExercise.id
                    )}
                    <div className="grid flex-1 auto-rows-fr gap-2.5 sm:grid-cols-2">
                      {currentExercise.options.map((option) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = revealed && option === currentExercise.answer;
                        const isWrong = revealed && isSelected && option !== currentExercise.answer;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedOption(option)}
                            disabled={revealed}
                            className={`rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${
                              isCorrect
                                ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                : isWrong
                                  ? "border-rose-400 bg-rose-400 text-slate-950"
                                  : isSelected
                                    ? "border-blue-400 bg-blue-500/20"
                                    : "border-[var(--card-border)] bg-[var(--bg-content)] hover:bg-[var(--card-bg-hover)]"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {currentExercise.type === "listen_choose" ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <button
                      type="button"
                      onClick={playListenPrompt}
                      className="mb-4 inline-flex shrink-0 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Play audio
                    </button>
                    <div className="grid flex-1 auto-rows-fr gap-2.5 sm:grid-cols-2">
                      {currentExercise.options.map((option) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = revealed && option === currentExercise.answer;
                        const isWrong = revealed && isSelected && option !== currentExercise.answer;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedOption(option)}
                            disabled={revealed}
                            className={`rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${
                              isCorrect
                                ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                : isWrong
                                  ? "border-rose-400 bg-rose-400 text-slate-950"
                                  : isSelected
                                    ? "border-blue-400 bg-blue-500/20"
                                    : "border-[var(--card-border)] bg-[var(--bg-content)] hover:bg-[var(--card-bg-hover)]"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {currentExercise.type === "match_meaning" ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-[clamp(0.2rem,0.6vh,0.45rem)] grid shrink-0 grid-cols-2 gap-[clamp(0.35rem,0.7vw,0.55rem)]">
                      <p className="px-1 text-center text-[clamp(0.68rem,1.1vw,0.8rem)] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Words
                      </p>
                      <p className="px-1 text-center text-[clamp(0.68rem,1.1vw,0.8rem)] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Meanings
                      </p>
                    </div>
                    <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-4 gap-[clamp(0.35rem,0.7vw,0.55rem)]">
                      {currentExercise.pairs.map((pair, index) => {
                        const meaning = currentExercise.pairs[0]?.options[index];
                        const currentValue = matchAnswers[pair.word] ?? "";
                        const matchColor = matchColorClasses[index % matchColorClasses.length];
                        const isActive = activeMatchWord === pair.word;
                        const isCorrect = revealed && currentValue === pair.answer;
                        const isWrong = revealed && currentValue && currentValue !== pair.answer;
                        const assignedWord =
                          meaning != null
                            ? Object.entries(matchAnswers).find(([, assignedMeaning]) => assignedMeaning === meaning)?.[0] ?? null
                            : null;
                        const isAssigned = Boolean(assignedWord);
                        const assignedIndex = assignedWord
                          ? currentExercise.pairs.findIndex((candidate) => candidate.word === assignedWord)
                          : -1;
                        const assignedPair =
                          assignedWord != null
                            ? currentExercise.pairs.find((candidate) => candidate.word === assignedWord) ?? null
                            : null;
                        const meaningColor =
                          assignedIndex >= 0
                            ? matchColorClasses[assignedIndex % matchColorClasses.length]
                            : "";
                        const meaningIsCorrect = revealed && assignedPair?.answer === meaning;
                        const meaningIsWrong = revealed && isAssigned && assignedPair?.answer !== meaning;

                        return (
                          <div key={`${pair.word}-${meaning ?? index}`} className="contents">
                            <button
                              type="button"
                              onClick={() => {
                                if (revealed) return;
                                if (currentValue) {
                                  unassignMatchWord(pair.word);
                                  return;
                                }
                                setActiveMatchWord((prev) => (prev === pair.word ? null : pair.word));
                              }}
                              className={`flex h-full min-h-0 w-full items-center justify-center rounded-[1.2rem] border px-[clamp(0.4rem,0.8vw,0.7rem)] py-[clamp(0.4rem,0.8vw,0.7rem)] text-center transition ${
                                isCorrect
                                  ? matchColor
                                  : isWrong
                                    ? "border-rose-400 bg-rose-400 text-slate-950"
                                    : currentValue
                                      ? matchColor
                                      : isActive
                                        ? matchColor
                                        : "border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]"
                              }`}
                            >
                              <div>
                                <p className="text-[clamp(0.95rem,1.6vw,1.55rem)] font-semibold tracking-tight">
                                  {pair.word}
                                </p>
                              </div>
                            </button>

                            {meaning ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (revealed) return;
                                  if (assignedWord) {
                                    unassignMatchWord(assignedWord);
                                    return;
                                  }
                                  assignMatchMeaning(meaning);
                                }}
                                disabled={revealed || (!activeMatchWord && !assignedWord)}
                                className={`flex h-full min-h-0 w-full items-center justify-center rounded-[1.2rem] border px-[clamp(0.4rem,0.8vw,0.7rem)] py-[clamp(0.4rem,0.8vw,0.7rem)] text-center transition ${
                                  meaningIsCorrect
                                    ? meaningColor
                                    : meaningIsWrong
                                      ? "border-rose-400 bg-rose-400 text-slate-950"
                                      : isAssigned
                                        ? meaningColor
                                        : "border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]"
                                } disabled:opacity-100`}
                              >
                                <p className="text-[clamp(0.76rem,1.12vw,0.94rem)] leading-[1.22]">
                                  {meaning}
                                </p>
                              </button>
                            ) : (
                              <div />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="h-full rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-md">
                <h2 className="text-2xl font-semibold tracking-tight">Not enough words yet</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  This mode needs a few more saved words with clear context before it can generate a useful session.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href="/favorites"
                    className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Open favorites
                  </Link>
                  <button
                    type="button"
                    onClick={closeSession}
                    className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
                  >
                    Choose another mode
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            className={`min-h-[112px] overflow-hidden rounded-3xl border px-4 py-2 shadow-xl sm:min-h-0 sm:px-4 sm:py-2 ${
              sessionComplete || !currentExercise
                ? "border-transparent bg-transparent shadow-none"
                : showFeedback
                  ? lastResult === "correct"
                    ? "border-lime-300/30 bg-lime-300/14"
                    : "border-rose-300/30 bg-rose-300/14"
                  : "border-[var(--card-border)] bg-[var(--card-bg)]"
            }`}
          >
            {!sessionComplete && currentExercise ? (
              <div className="flex h-full flex-col">
                {showFeedback ? (
                  <>
                    <div className="min-h-0 flex-1">
                      <p
                        className={`text-lg font-bold tracking-tight sm:text-2xl ${
                          lastResult === "correct" ? "text-lime-300" : "text-rose-300"
                        }`}
                      >
                        {lastResult === "correct"
                          ? streak > 1
                            ? "Awesome!"
                            : "Good job!"
                          : currentExercise.type === "match_meaning"
                            ? "Check the corrected pairs above"
                            : "Correct answer:"}
                      </p>
                      {lastResult === "wrong" && currentExercise.type !== "match_meaning" ? (
                        <p className="mt-1 hidden max-w-3xl text-sm leading-5 text-rose-50 sm:block">
                          {correctAnswerText}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center">
                      <button
                        type="button"
                        onClick={goNext}
                        className={`inline-flex min-w-[128px] justify-center rounded-lg px-4 py-1 text-[13px] font-extrabold uppercase tracking-[0.16em] ${
                          lastResult === "correct"
                            ? "bg-lime-400 text-slate-950 hover:bg-lime-300"
                            : "bg-rose-400 text-slate-950 hover:bg-rose-300"
                        }`}
                      >
                        {exerciseIndex >= exercises.length - 1 ? "Finish" : "Continue"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-h-0 flex-1">
                      <p className="text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                        Ready?
                      </p>
                      <p className="mt-1 hidden text-sm leading-5 text-[var(--muted)] sm:block">
                        Choose your answer, then check it here.
                      </p>
                    </div>
                    <div className="mt-1 flex items-center">
                      <button
                        type="button"
                        onClick={revealCurrent}
                        disabled={!canSubmitAnswer}
                        className="inline-flex min-w-[136px] justify-center rounded-lg bg-[var(--primary)] px-4 py-1 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Check answer
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="text-sm text-[var(--muted)]">
          Choose how you want to practice, then focus on one short session at a time.
        </p>
      </div>
      <div className="mb-5 flex items-center gap-3 text-sm text-[var(--muted)]">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
          Due words {dueCount}
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
          Saved words {favorites.length}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modeCards.map((card) => (
          <button
            key={card.mode}
            type="button"
            onClick={() => openSession(card.mode)}
            className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 text-left shadow-md transition hover:bg-[var(--card-bg-hover)]"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Practice mode
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]/88">{card.detail}</p>
            <p className="mt-5 text-xs leading-5 text-[var(--muted)]">{card.caption}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
