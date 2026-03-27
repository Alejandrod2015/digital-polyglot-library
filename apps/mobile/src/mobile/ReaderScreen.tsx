import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  formatLanguage,
  formatTopic,
  type Book,
  type Story,
  type VocabItem,
} from "@digital-polyglot/domain";
import { NativeAudioPlayer } from "./NativeAudioPlayer";
import { ProgressiveImage } from "./ProgressiveImage";
import { apiFetch } from "../lib/api";
import { mobileConfig } from "../config";

type StoryBlock = {
  type: "paragraph" | "quote";
  text: string;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripInlineTags(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function shortenDefinition(input?: string, maxLength = 56): string | undefined {
  if (!input) return undefined;
  const clean = input.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

function shortenContext(input?: string, maxLength = 72): string | undefined {
  if (!input) return undefined;
  const clean = input.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

function toBlocks(text: string): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  const blockRegex = /<(p|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null = blockRegex.exec(text);

  while (match) {
    const type = match[1] === "blockquote" ? "quote" : "paragraph";
    const cleaned = stripInlineTags(match[2] ?? "");
    if (cleaned) {
      blocks.push({ type, text: cleaned });
    }
    match = blockRegex.exec(text);
  }

  if (blocks.length > 0) return blocks;

  return text
    .replace(/<[^>]+>/g, "\n")
    .split(/\n{2,}/)
    .map((part) => stripInlineTags(part))
    .filter(Boolean)
    .map((part) => ({ type: "paragraph" as const, text: part }));
}

const MAX_HIGHLIGHT_WORDS = 30;
const MAX_HIGHLIGHT_WORD_LENGTH = 48;
const MAX_HIGHLIGHT_WORD_TOKENS = 4;
const MAX_REGEX_SOURCE_LENGTH = 1400;
const MAX_TEXT_LENGTH_FOR_HIGHLIGHT = 25000;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeVocabForHighlight(vocab: VocabItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of vocab) {
    const raw =
      typeof item?.surface === "string" && item.surface.trim()
        ? item.surface.trim()
        : typeof item?.word === "string"
          ? item.word.trim()
          : "";

    if (!raw) continue;
    if (raw.length < 3 || raw.length > MAX_HIGHLIGHT_WORD_LENGTH) continue;
    if (/[<>[\]{}]/.test(raw)) continue;
    const tokenCount = raw.split(/\s+/).filter(Boolean).length;
    if (tokenCount > MAX_HIGHLIGHT_WORD_TOKENS) continue;

    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= MAX_HIGHLIGHT_WORDS) break;
  }

  return out;
}

function renderHighlightedParagraph(
  text: string,
  vocab: VocabItem[],
  paragraphKey: string,
  onWordPress: (word: VocabItem, contextSentence?: string) => void,
  variant: "paragraph" | "quote" = "paragraph"
) {
  const baseTextStyle = variant === "quote" ? styles.quoteParagraph : styles.paragraph;

  if (!text || text.length > MAX_TEXT_LENGTH_FOR_HIGHLIGHT) {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  const cleanWords = normalizeVocabForHighlight(vocab);
  if (cleanWords.length === 0) {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  const uniqueWords = Array.from(new Set(cleanWords.map((word) => word.trim())));
  const canonicalByLower = new Map(uniqueWords.map((word) => [word.toLowerCase(), word] as const));
  const alternatives = [...uniqueWords].sort((a, b) => b.length - a.length).map(escapeRegex);
  if (alternatives.length === 0) {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  const regexSource = alternatives.join("|");
  if (regexSource.length > MAX_REGEX_SOURCE_LENGTH) {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  let regex: RegExp;
  try {
    regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${regexSource})(?=$|[^\\p{L}\\p{N}_])`, "giu");
  } catch {
    return <Text style={baseTextStyle}>{text}</Text>;
  }

  const alreadyHighlighted = new Set<string>();
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  let key = 0;

  while (match) {
    const leading = match[1] ?? "";
    const matchedText = match[2] ?? "";
    const start = match.index + leading.length;
    const end = start + matchedText.length;

    if (start > lastIndex) {
      const before = text.slice(lastIndex, start);
      if (before) {
        nodes.push(
          <Text key={`${paragraphKey}-txt-${key++}`} style={baseTextStyle}>
            {before}
          </Text>
        );
      }
    }

    const canonical = canonicalByLower.get(matchedText.toLowerCase()) ?? matchedText;
    const canonicalKey = canonical.toLowerCase();
    const vocabItem =
      vocab.find((item) => {
        const word = item.word?.trim().toLowerCase();
        const surface = item.surface?.trim().toLowerCase();
        return word === canonicalKey || surface === canonicalKey;
      }) ?? null;

    const highlightStyle =
      alreadyHighlighted.has(canonicalKey) || !vocabItem ? baseTextStyle : styles.highlightedWord;

    if (!alreadyHighlighted.has(canonicalKey)) {
      alreadyHighlighted.add(canonicalKey);
    }

    nodes.push(
      <Text
        key={`${paragraphKey}-voc-${key++}`}
        style={highlightStyle}
        onPress={vocabItem ? () => onWordPress(vocabItem, text) : undefined}
      >
        {matchedText}
      </Text>
    );

    lastIndex = end;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    if (tail) {
      nodes.push(
        <Text key={`${paragraphKey}-tail-${key++}`} style={baseTextStyle}>
          {tail}
        </Text>
      );
    }
  }

  return <Text style={baseTextStyle}>{nodes.length > 0 ? nodes : text}</Text>;
}

export function ReaderScreen(args: {
  book: Book;
  story: Story;
  resolvedAudioUrl?: string | null;
  sessionToken?: string | null;
  onBack: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPreviousStory?: () => void;
  onNextStory?: () => void;
  isSaved: boolean;
  isSaving: boolean;
  onToggleSaved: () => void;
  initialProgress?: {
    progressRatio?: number;
    currentBlockIndex?: number;
    totalBlocks?: number;
  } | null;
  onTrackProgress: (details?: {
    progressRatio?: number;
    currentBlockIndex?: number;
    totalBlocks?: number;
  }) => void;
  isAvailableOffline: boolean;
  isDownloadingOffline: boolean;
  onDownloadOffline: () => void;
  onRemoveOffline: () => void;
  onOpenPractice?: () => void;
  isFavoriteWord: (word: string) => boolean;
  onToggleFavoriteWord: (item: VocabItem, contextSentence?: string) => void;
}) {
  const {
    book,
    story,
    resolvedAudioUrl,
    sessionToken,
    onBack,
    canGoPrevious = false,
    canGoNext = false,
    onPreviousStory,
    onNextStory,
    isSaved,
    isSaving,
    onToggleSaved,
    initialProgress,
    onTrackProgress,
    isAvailableOffline,
    isDownloadingOffline,
    onDownloadOffline,
    onRemoveOffline,
    onOpenPractice,
    isFavoriteWord,
    onToggleFavoriteWord,
  } = args;
  const blocks = useMemo(() => toBlocks(story.text), [story.text]);
  const vocab = story.vocab ?? [];
  const audioUrl = typeof resolvedAudioUrl === "string" && resolvedAudioUrl.trim() ? resolvedAudioUrl : story.audio;
  const isOfflineAudio = typeof audioUrl === "string" && audioUrl.startsWith("file://");
  const [selectedVocab, setSelectedVocab] = useState<VocabItem | null>(null);
  const lastTrackedStoryId = useRef<string | null>(null);
  const lastPersistedProgressSecRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef<number>(0);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const lastAutoScrollRatioRef = useRef(0);
  const lastScrollRatioRef = useRef(0);
  const blockOffsetsRef = useRef<number[]>([]);
  const hasRestoredPositionRef = useRef(false);
  const lastTrackedReadingRatioRef = useRef<number | null>(null);
  const lastTrackedBlockIndexRef = useRef<number | null>(null);
  const coverUrl = story.cover || story.coverUrl || book.cover;
  const [activeBlockIndex, setActiveBlockIndex] = useState(
    Math.min(Math.max(initialProgress?.currentBlockIndex ?? 0, 0), Math.max(blocks.length - 1, 0))
  );
  const compactDefinition = useMemo(
    () => shortenDefinition(selectedVocab?.definition),
    [selectedVocab?.definition]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        setSelectedVocab(null);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (lastTrackedStoryId.current === story.id) {
      return;
    }

    lastTrackedStoryId.current = story.id;
    lastAutoScrollRatioRef.current = 0;
    lastScrollRatioRef.current = initialProgress?.progressRatio ?? 0;
    blockOffsetsRef.current = [];
    hasRestoredPositionRef.current = false;
    lastTrackedReadingRatioRef.current = null;
    lastTrackedBlockIndexRef.current = null;
    const nextBlockIndex = Math.min(
      Math.max(initialProgress?.currentBlockIndex ?? 0, 0),
      Math.max(blocks.length - 1, 0)
    );
    setActiveBlockIndex(nextBlockIndex);
    onTrackProgress({
      progressRatio: initialProgress?.progressRatio ?? 0,
      currentBlockIndex: nextBlockIndex,
      totalBlocks: blocks.length,
    });
  }, [story.id, initialProgress?.currentBlockIndex, initialProgress?.progressRatio, blocks.length]);

  useEffect(() => {
    lastPersistedProgressSecRef.current = null;
    lastPersistedAtRef.current = 0;
  }, [story.id]);

  function trackReadingPosition(progressRatio: number, nextBlockIndex: number) {
    const clampedRatio = Math.min(1, Math.max(0, progressRatio));
    if (
      lastTrackedReadingRatioRef.current !== null &&
      Math.abs(clampedRatio - lastTrackedReadingRatioRef.current) < 0.03 &&
      lastTrackedBlockIndexRef.current === nextBlockIndex
    ) {
      return;
    }

    lastTrackedReadingRatioRef.current = clampedRatio;
    lastTrackedBlockIndexRef.current = nextBlockIndex;
    onTrackProgress({
      progressRatio: clampedRatio,
      currentBlockIndex: nextBlockIndex,
      totalBlocks: blocks.length,
    });
  }

  function restoreReadingPosition() {
    if (hasRestoredPositionRef.current || !scrollViewRef.current) return;
    const scrollableHeight = Math.max(contentHeightRef.current - viewportHeightRef.current, 0);
    if (scrollableHeight <= 0) return;
    const initialRatio = Math.min(1, Math.max(0, initialProgress?.progressRatio ?? 0));
    if (initialRatio <= 0) {
      hasRestoredPositionRef.current = true;
      return;
    }
    hasRestoredPositionRef.current = true;
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: initialRatio * scrollableHeight,
        animated: false,
      });
    });
  }

  async function persistContinueListening(progressSec: number, durationSec: number) {
    if (!sessionToken || !book.slug || !story.slug) return;

    const roundedProgress = Math.max(0, Math.round(progressSec));
    const roundedDuration = Math.max(0, Math.round(durationSec));
    const now = Date.now();

    if (
      lastPersistedProgressSecRef.current !== null &&
      Math.abs(roundedProgress - lastPersistedProgressSecRef.current) < 15 &&
      now - lastPersistedAtRef.current < 45_000
    ) {
      return;
    }

    lastPersistedProgressSecRef.current = roundedProgress;
    lastPersistedAtRef.current = now;

    try {
      await apiFetch<{ success: boolean }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/continue-listening",
        token: sessionToken,
        method: "POST",
        timeoutMs: 15000,
        body: {
          bookSlug: book.slug,
          storySlug: story.slug,
          progressSec: roundedProgress,
          audioDurationSec: roundedDuration,
        },
      });
    } catch {
      // Keep listening experience resilient even if sync fails.
    }
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    contentHeightRef.current = contentSize.height;
    viewportHeightRef.current = layoutMeasurement.height;
    const scrollableHeight = Math.max(contentSize.height - layoutMeasurement.height, 1);
    const ratio = Math.min(1, Math.max(0, contentOffset.y / scrollableHeight));
    lastScrollRatioRef.current = ratio;
    const anchorY = contentOffset.y + Math.max(80, layoutMeasurement.height * 0.22);
    let nextBlockIndex = 0;
    for (let index = 0; index < blockOffsetsRef.current.length; index += 1) {
      if ((blockOffsetsRef.current[index] ?? 0) <= anchorY) {
        nextBlockIndex = index;
      } else {
        break;
      }
    }
    if (nextBlockIndex !== activeBlockIndex) {
      setActiveBlockIndex(nextBlockIndex);
    }
    trackReadingPosition(ratio, nextBlockIndex);
  }

  return (
    <View style={styles.screen} accessibilityLabel="qa-reader-screen" testID="qa-reader-screen">
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.container, styles.containerGrow]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={(_width, height) => {
          contentHeightRef.current = height;
          restoreReadingPosition();
        }}
        onLayout={(event) => {
          viewportHeightRef.current = event.nativeEvent.layout.height;
          restoreReadingPosition();
        }}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="qa-reader-back"
            testID="qa-reader-back"
            style={styles.iconButton}
          >
            <Feather name="arrow-left" size={18} color="#dbe9ff" />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable onPress={onToggleSaved} style={styles.iconButton}>
              <Feather
                name={isSaved ? "bookmark" : "bookmark"}
                size={18}
                color={isSaved ? "#f8c15c" : "#dbe9ff"}
              />
            </Pressable>
            <Pressable
              onPress={isAvailableOffline ? onRemoveOffline : onDownloadOffline}
              style={styles.iconButton}
            >
              <Feather
                name={isDownloadingOffline ? "more-horizontal" : "download"}
                size={18}
                color={isAvailableOffline ? "#8fc7ff" : "#dbe9ff"}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.headerBlock}>
          <Text style={styles.bookTitle}>{book.title}</Text>
          <Text style={styles.storyTitle}>{story.title}</Text>
          <View style={styles.metaPills}>
            <View style={[styles.pill, styles.activePill]}>
              <Text style={[styles.pillText, styles.activePillText]}>{book.level}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{(book.variant ?? book.region ?? "").toUpperCase()}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{formatLanguage(story.language ?? book.language)}</Text>
            </View>
          </View>
        </View>

        {coverUrl ? (
          <ProgressiveImage uri={coverUrl} style={styles.readerCover} resizeMode="cover" />
        ) : null}

        {onOpenPractice ? (
          <Pressable
            onPress={onOpenPractice}
            accessibilityRole="button"
            accessibilityLabel="qa-reader-practice-story"
            testID="qa-reader-practice-story"
            style={styles.practiceStoryButton}
          >
            <Feather name="zap" size={15} color="#0e1727" />
            <Text style={styles.practiceStoryButtonText}>Practice this story</Text>
          </Pressable>
        ) : null}

        <View style={styles.textWrap}>
          <View style={styles.textCard}>
            {blocks.map((block, index) => (
              <View
                key={`${story.id}-${index}`}
                style={[
                  block.type === "quote" ? styles.quoteBlock : styles.paragraphBlock,
                ]}
                onLayout={(event) => {
                  blockOffsetsRef.current[index] = event.nativeEvent.layout.y;
                  restoreReadingPosition();
                }}
              >
                {renderHighlightedParagraph(
                  block.text,
                  vocab,
                  `${story.id}-${index}`,
                  (word, contextSentence) =>
                    setSelectedVocab(
                      contextSentence ? { ...word, note: contextSentence } : word
                    ),
                  block.type
                )}
              </View>
            ))}
          </View>

          {isOfflineAudio ? (
            <Text style={styles.offlineBadge}>Offline audio ready on this device</Text>
          ) : null}
        </View>
      </ScrollView>

      {selectedVocab ? (
        <Pressable
          style={styles.vocabOverlay}
          onPress={() => setSelectedVocab(null)}
          accessibilityLabel="qa-reader-vocab-overlay"
          testID="qa-reader-vocab-overlay"
        >
          <Pressable style={styles.vocabBubbleWrap} onPress={() => undefined}>
            <View style={styles.vocabBubble} accessibilityLabel="qa-reader-vocab-bubble" testID="qa-reader-vocab-bubble">
              <View style={styles.vocabBubbleHeader}>
                <View style={styles.vocabBubbleTitleStack}>
                  <Text style={styles.vocabBubbleWord}>{selectedVocab.word}</Text>
                </View>
                <Pressable onPress={() => setSelectedVocab(null)} style={styles.vocabClose}>
                  <Text style={styles.vocabCloseText}>×</Text>
                </Pressable>
              </View>
              {compactDefinition ? (
                <Text style={styles.vocabBubbleDefinition}>{compactDefinition}</Text>
              ) : null}
              <View style={styles.vocabActionRow}>
                <Pressable
                  onPress={() => onToggleFavoriteWord(selectedVocab, selectedVocab.note)}
                  style={[
                    styles.vocabAction,
                    isFavoriteWord(selectedVocab.word) ? styles.vocabActionActive : null,
                  ]}
                >
                  <Feather
                    name="heart"
                    size={14}
                    color="#ffffff"
                    style={isFavoriteWord(selectedVocab.word) ? styles.vocabActionIconActive : undefined}
                  />
                  <Text style={styles.vocabActionText}>
                    {isFavoriteWord(selectedVocab.word) ? "Saved" : "Save"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      <View style={styles.playerDock}>
        <NativeAudioPlayer
          src={audioUrl}
          variant="sticky"
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onPrevious={onPreviousStory}
          onNext={onNextStory}
          onProgressChange={(playback) => {
            if (playback.isLoaded && playback.durationMillis > 0) {
              const progressSec = playback.positionMillis / 1000;
              const durationSec = playback.durationMillis / 1000;
              const ratio = durationSec > 0 ? progressSec / durationSec : 0;
              const shouldPersist =
                playback.isPlaying
                  ? progressSec >= 15 && Math.abs(progressSec - (lastPersistedProgressSecRef.current ?? 0)) >= 20
                  : ratio >= 0.95 || progressSec >= 15;
              if (shouldPersist) {
                void persistContinueListening(progressSec, durationSec);
              }
            }

            if (!playback.isLoaded || !playback.isPlaying || playback.durationMillis <= 0) {
              return;
            }

            const nextRatio = Math.min(1, Math.max(0, playback.positionMillis / playback.durationMillis));
            if (Math.abs(nextRatio - lastAutoScrollRatioRef.current) < 0.01) {
              return;
            }

            const scrollableHeight = Math.max(contentHeightRef.current - viewportHeightRef.current, 0);
            if (scrollableHeight <= 0 || !scrollViewRef.current) {
              return;
            }

            lastAutoScrollRatioRef.current = nextRatio;
            const estimatedBlockIndex = Math.min(
              blocks.length - 1,
              Math.max(0, Math.round(nextRatio * Math.max(blocks.length - 1, 0)))
            );
            setActiveBlockIndex(estimatedBlockIndex);
            trackReadingPosition(nextRatio, estimatedBlockIndex);
            scrollViewRef.current.scrollTo({
              y: nextRatio * scrollableHeight,
              animated: true,
            });
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 172,
  },
  containerGrow: {
    flexGrow: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    borderRadius: 999,
    backgroundColor: "#132238",
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "#2d4562",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    color: "#cfe3ff",
    fontWeight: "700",
    fontSize: 13,
  },
  headerBlock: {
    gap: 8,
  },
  bookTitle: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.05,
    textTransform: "uppercase",
  },
  storyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  metaPills: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3d5470",
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "rgba(21, 37, 58, 0.55)",
  },
  activePill: {
    borderColor: "#9f7f35",
    backgroundColor: "rgba(157, 124, 44, 0.22)",
  },
  pillText: {
    color: "#d7e2f1",
    fontSize: 11,
    fontWeight: "700",
  },
  activePillText: {
    color: "#f4d58e",
  },
  readerCover: {
    width: "100%",
    height: 196,
    borderRadius: 16,
    backgroundColor: "#132237",
    borderWidth: 1,
    borderColor: "#28415f",
  },
  textWrap: {
    gap: 8,
  },
  practiceStoryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#f8c15c",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  practiceStoryButtonText: {
    color: "#0e1727",
    fontSize: 13,
    fontWeight: "800",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#243953",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f8c15c",
  },
  offlineBadge: {
    color: "#8fc7ff",
    fontSize: 13,
    fontWeight: "700",
  },
  textCard: {
    gap: 20,
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  paragraphBlock: {
    gap: 0,
  },
  quoteBlock: {
    gap: 4,
    paddingLeft: 0,
  },
  paragraph: {
    color: "#eef4ff",
    fontSize: 20,
    lineHeight: 35,
  },
  quoteParagraph: {
    color: "#e5eefb",
    fontSize: 20,
    lineHeight: 35,
  },
  highlightedWord: {
    color: "#fff1bf",
    fontSize: 20,
    lineHeight: 35,
    backgroundColor: "rgba(185, 155, 63, 0.18)",
    borderBottomWidth: 2,
    borderBottomColor: "#c6a749",
    fontWeight: "700",
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderRadius: 3,
  },
  vocabOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 118,
    backgroundColor: "rgba(6, 14, 25, 0.16)",
  },
  vocabBubbleWrap: {
    width: "100%",
  },
  vocabBubble: {
    backgroundColor: "#0f2138",
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#28415f",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  vocabBubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  vocabBubbleTitleStack: {
    flex: 1,
    gap: 2,
  },
  vocabBubbleWord: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  vocabClose: {
    borderRadius: 999,
    backgroundColor: "#213754",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  vocabCloseText: {
    color: "#dbe9ff",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18,
  },
  vocabBubbleDefinition: {
    color: "#eef4ff",
    fontSize: 15,
    lineHeight: 22,
  },
  vocabAction: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#21456c",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  vocabActionActive: {
    backgroundColor: "#745224",
  },
  vocabActionRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  vocabActionIconActive: {
    opacity: 1,
  },
  vocabActionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  playerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },
});
