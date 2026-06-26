import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ProgressiveImage } from "./ProgressiveImage";
import { getCoverUrl } from "./coverUrl";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";

/**
 * Bottom sheet shown when the user taps a topic panel on the
 * journey path. Acts as a "teaser" for the topic; lists the
 * stories the user will read inside, plus a short vocabulary
 * preview so they get a sense of what they'll learn before they
 * dive in.
 *
 * The vocabulary preview is a placeholder for now: each story
 * doesn't ship a curated word list yet, so we just hint at "key
 * words" via the story titles. Once the journey content carries
 * tagged keywords per story, this section can show them inline.
 */

export type TopicPreviewStory = {
  id: string;
  title: string;
  coverUrl: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  levelId: string;
  topicLabel: string;
  bgColor: string;
  stories: TopicPreviewStory[];
  /** Real vocabulary words pulled from the topic's downloaded
   *  stories. Shown as chips to give the user a concrete preview
   *  of what they'll learn; not a generic description. Empty when
   *  no stories in the topic are cached offline yet. */
  vocabWords: string[];
  /** When `true`, the shell is fetching vocab in the background.
   *  We render shimmering skeleton chips during this window so the
   *  user never sees the fallback hint flash before the real chips
   *  arrive. */
  isVocabLoading?: boolean;
};

const SHEET_TRAVEL = 720;

// Varying chip widths so the skeleton reads as "real words loading"
// instead of a flat placeholder grid.
const SKELETON_CHIP_WIDTHS = [72, 96, 60, 84, 110, 68, 92, 76];

export function TopicPreviewSheet({
  open,
  onClose,
  levelId,
  topicLabel,
  bgColor,
  stories,
  vocabWords,
  isVocabLoading = false,
}: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SHEET_TRAVEL)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  // Drive a slow pulse on the skeleton chips while vocab loads. The
  // value oscillates 0 → 1 → 0 and we map it to opacity so the
  // chips "breathe" rather than sitting flat.
  useEffect(() => {
    if (!isVocabLoading) {
      shimmer.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isVocabLoading, shimmer]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 26,
          stiffness: 240,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SHEET_TRAVEL,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, mounted, backdrop, translateY]);

  if (!mounted) return null;

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdrop }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY }] },
        ]}
      >
        {/* Header card; same color as the topic panel on the path
            so the user sees a clear continuity from the panel they
            tapped. */}
        <View style={[styles.headerCard, { backgroundColor: bgColor }]}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerEyebrow}>LEVEL {levelId}</Text>
            <Text style={styles.headerTitle}>{topicLabel}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
            <Feather name="x" size={18} color="#ffffff" />
          </Pressable>
        </View>

        {/* Two independent scrolling sections; each gets its own
            fixed share of the sheet so adding more stories doesn't
            push the vocab section off screen. Stories: capped height,
            internal scroll if many. Vocab: takes the remaining space,
            chips wrap into multiple lines, internal scroll if many. */}
        <View style={styles.storiesSection}>
          <Text style={styles.sectionEyebrow}>STORIES IN THIS TOPIC</Text>
          {stories.length === 0 ? (
            <Text style={styles.emptyText}>
              Stories for this topic are still being added.
            </Text>
          ) : (
            <ScrollView
              style={styles.storiesScroll}
              contentContainerStyle={styles.storiesScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {stories.map((story, idx) => (
                <View key={story.id} style={styles.storyRow}>
                  <View style={styles.storyThumb}>
                    {story.coverUrl ? (
                      <ProgressiveImage
                        uri={getCoverUrl(story.coverUrl, 128)}
                        style={styles.storyThumbImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Feather name="book-open" size={18} color={tokenColor.cyan} />
                    )}
                  </View>
                  <View style={styles.storyTextBlock}>
                    <Text style={styles.storyIndex}>STORY {idx + 1}</Text>
                    <Text style={styles.storyTitle} numberOfLines={2}>
                      {story.title}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.vocabSection}>
          <Text style={styles.sectionEyebrow}>VOCABULARY YOU&apos;LL LEARN</Text>
          {vocabWords.length > 0 ? (
            <ScrollView
              horizontal
              style={styles.vocabScroll}
              contentContainerStyle={styles.vocabScrollContent}
              showsHorizontalScrollIndicator={false}
              bounces={false}
            >
              {/* Distribute words round-robin across 3 rows so each
                  chip keeps its natural width (driven by word length)
                  and the rows look organically staggered instead of
                  rigidly aligned. Earlier we used flexDirection:
                  column + flexWrap which forced every chip in a
                  column to share the widest one's width; looked
                  like a spreadsheet. */}
              <View style={styles.vocabRows}>
                {(() => {
                  const rowCount = 3;
                  const rows: string[][] = Array.from(
                    { length: rowCount },
                    () => []
                  );
                  vocabWords.forEach((word, idx) => {
                    rows[idx % rowCount].push(word);
                  });
                  return rows.map((row, rowIdx) => (
                    <View key={`vocab-row-${rowIdx}`} style={styles.vocabRow}>
                      {row.map((word) => (
                        <View key={word} style={styles.vocabChip}>
                          <Text style={styles.vocabChipText}>{word}</Text>
                        </View>
                      ))}
                    </View>
                  ));
                })()}
              </View>
            </ScrollView>
          ) : isVocabLoading ? (
            <Animated.View
              style={[
                styles.vocabChips,
                {
                  opacity: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.45, 0.85],
                  }),
                },
              ]}
            >
              {SKELETON_CHIP_WIDTHS.map((width, idx) => (
                <View
                  key={`vocab-skel-${idx}`}
                  style={[styles.vocabChipSkeleton, { width }]}
                />
              ))}
            </Animated.View>
          ) : (
            <Text style={styles.vocabHint}>
              Open a story in this topic to start learning the vocabulary.
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 88,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 24, 52, 0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokenBg[1],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 14,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 10,
  },
  // Stories section gets a capped height so 7+ stories don't push the
  // vocab section off the sheet. Internal ScrollView handles overflow.
  storiesSection: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
    maxHeight: 380,
  },
  storiesScroll: {
    flexGrow: 0,
  },
  storiesScrollContent: {
    gap: 10,
    paddingBottom: 4,
  },
  // Vocab section takes the remaining space below the stories
  // section. flex: 1 + maxHeight on the sheet keeps both visible.
  vocabSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    // Capped so a 100-word topic still leaves the sheet usable. The
    // sheet's own maxHeight (85% of screen) plus the stories cap
    // means with both sections at full height there is still some
    // breathing room.
    maxHeight: 360,
  },
  vocabScroll: {
    flexGrow: 0,
  },
  vocabScrollContent: {
    paddingBottom: 8,
  },
  sectionEyebrow: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  storyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  storyThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(125, 211, 252, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  storyThumbImage: {
    width: "100%",
    height: "100%",
  },
  storyTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  storyIndex: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  storyTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginTop: 2,
  },
  emptyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  vocabHint: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  vocabRows: {
    flexDirection: "column",
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  vocabRow: {
    flexDirection: "row",
    gap: 8,
  },
  // Kept for the loading skeleton, which still renders a wrap row
  // because we don't pre-compute skeleton row distribution.
  vocabChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  vocabChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.32)",
    backgroundColor: "rgba(125, 211, 252, 0.1)",
  },
  vocabChipSkeleton: {
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.18)",
    backgroundColor: "rgba(125, 211, 252, 0.08)",
  },
  vocabChipText: {
    color: tokenColor.cyan,
    fontSize: 13,
    fontWeight: "800",
  },
});
