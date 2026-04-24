import { Feather } from "@expo/vector-icons";
import {
  VARIANT_OPTIONS_BY_LANGUAGE,
  formatLanguage,
  formatLanguageCode,
  formatLevel,
  formatRegion,
} from "@digital-polyglot/domain";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ProgressiveImage } from "./ProgressiveImage";

function isSingleVariantLanguage(language?: string): boolean {
  if (!language) return false;
  const key = formatLanguage(language).toLowerCase();
  const variants = VARIANT_OPTIONS_BY_LANGUAGE[key];
  return Array.isArray(variants) && variants.length <= 1;
}

export type StoryCardModel = {
  key: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  meta: string;
  badge: string;
  progressLabel?: string;
  qaLabel?: string;
  onPress?: () => void;
};

export type BookCardModel = {
  key: string;
  title: string;
  coverUrl: string;
  language?: string;
  variant?: string;
  region?: string;
  level?: string;
  statsLine?: string;
  topicsLine?: string;
  description?: string;
  qaLabel?: string;
  onPress: () => void;
};

export function StoryHeroCard({ item }: { item: StoryCardModel }) {
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.qaLabel}
      testID={item.qaLabel}
      style={styles.heroCard}
    >
      <ProgressiveImage uri={item.coverUrl} style={styles.heroCardImage} />
      <View style={styles.heroCardOverlay} />
      <View style={styles.heroCardContent}>
        <Text style={styles.heroCardBadge}>{item.badge}</Text>
        <Text style={styles.heroCardTitle}>{item.title}</Text>
        <Text style={styles.heroCardSubtitle}>{item.subtitle}</Text>
        <Text style={styles.heroCardMeta}>{item.meta}</Text>
        <View style={styles.heroCardButton}>
          <Text style={styles.heroCardButtonText}>Open story</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ExploreStoryListCard({ item }: { item: StoryCardModel }) {
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.qaLabel}
      testID={item.qaLabel}
      style={styles.exploreStoryCard}
    >
      <ProgressiveImage uri={item.coverUrl} style={styles.exploreStoryImage} />
      <View style={styles.exploreStoryBody}>
        <View style={styles.exploreStoryTopRow}>
          <Text style={styles.exploreStoryBadge}>{item.badge}</Text>
          <Feather name="chevron-right" size={16} color="#9cb0c9" />
        </View>
        <Text style={styles.exploreStoryTitle}>{item.title}</Text>
        <Text style={styles.exploreStorySubtitle}>{item.subtitle}</Text>
        <Text style={styles.exploreStoryMeta}>{item.meta}</Text>
      </View>
    </Pressable>
  );
}

export function FeatureStoryCard({
  item,
  label,
}: {
  item: StoryCardModel;
  label: string;
}) {
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.qaLabel}
      testID={item.qaLabel}
      style={styles.featureCard}
    >
      <ProgressiveImage uri={item.coverUrl} style={styles.featureCardImage} />
      <View style={styles.featureCardBody}>
        <Text style={styles.featureCardLabel}>{label}</Text>
        <Text style={styles.featureCardTitle}>{item.title}</Text>
        <Text style={styles.featureCardSubtitle}>{item.subtitle}</Text>
        <Text style={styles.featureCardMeta}>{item.meta}</Text>
        <View style={styles.featureMetaPills}>
          <Text style={styles.featureMetaPill}>{item.badge}</Text>
          <Text style={styles.featureMetaPill}>Open story</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function BookHomeCard({
  item,
  fullWidth = false,
}: {
  item: {
    key: string;
    title: string;
    coverUrl: string;
    subtitle: string;
    meta: string;
    progressLabel?: string;
    qaLabel?: string;
    /**
     * How to fit the cover inside the card frame. "cover" (default) fills the
     * whole frame and crops — perfect for landscape story covers. "contain"
     * letterboxes so portrait book covers aren't chopped; we also swap the
     * frame to a taller aspect so the letterbox blend is minimal.
     */
    coverFit?: "cover" | "contain";
    onPress: () => void;
  };
  fullWidth?: boolean;
}) {
  const usePortraitFrame = item.coverFit === "contain";
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.qaLabel}
      testID={item.qaLabel}
      style={[styles.bookHomeCard, fullWidth ? styles.bookHomeCardFullWidth : null]}
    >
      <ProgressiveImage
        uri={item.coverUrl}
        style={[styles.bookHomeCardImage, usePortraitFrame ? styles.bookHomeCardImagePortrait : null]}
        resizeMode={item.coverFit ?? "cover"}
      />
      <View style={styles.bookHomeCardBody}>
        <Text style={styles.bookHomeCardTitle}>{item.title}</Text>
        <Text style={styles.bookHomeCardSubtitle}>{item.subtitle}</Text>
        <Text style={styles.bookHomeCardMeta}>{item.meta}</Text>
        {item.progressLabel ? <Text style={styles.bookHomeCardProgress}>{item.progressLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

export function BookWebCard({ item, fullWidth = false }: { item: BookCardModel; fullWidth?: boolean }) {
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.qaLabel}
      testID={item.qaLabel}
      style={[styles.bookWebCard, fullWidth ? styles.bookWebCardFullWidth : null]}
    >
      <View style={styles.bookWebCardCoverFrame}>
        <ProgressiveImage uri={item.coverUrl} style={styles.bookWebCardCover} resizeMode="cover" />
      </View>
      <View style={styles.bookWebCardBody}>
        {/* Title first so its top aligns with the top of the cover instead
            of sitting ~24 pt down behind the badge row. */}
        <Text numberOfLines={2} style={styles.bookWebCardTitle}>{item.title}</Text>
        {(item.level || item.language || item.region) ? (
          <View style={styles.bookWebCardBadgeRow}>
            {item.level ? (
              <Text style={[styles.bookWebCardBadge, styles.bookWebCardLevelBadge]}>
                {formatLevel(item.level)}
              </Text>
            ) : null}
            {item.language ? <Text style={styles.bookWebCardBadge}>{formatLanguageCode(item.language)}</Text> : null}
            {item.region && !isSingleVariantLanguage(item.language) ? (
              <Text style={styles.bookWebCardBadge}>{formatRegion(item.region)}</Text>
            ) : null}
          </View>
        ) : null}
        {item.statsLine ? <Text style={styles.bookWebCardStats}>{item.statsLine}</Text> : null}
        {item.topicsLine ? <Text numberOfLines={1} style={styles.bookWebCardTopics}>{item.topicsLine}</Text> : null}
        {item.description ? (
          <Text numberOfLines={1} style={styles.bookWebCardDescription}>
            {item.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    width: 286,
    height: 344,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#122238",
    borderWidth: 1,
    borderColor: "#24405f",
  },
  heroCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 14, 27, 0.42)",
  },
  heroCardContent: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 22,
    gap: 10,
  },
  heroCardBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#24334a",
    color: "#f8c15c",
    fontSize: 12,
    fontWeight: "800",
  },
  heroCardTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  heroCardSubtitle: {
    color: "#eef4ff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  heroCardMeta: {
    color: "#dbe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  heroCardButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#f8c15c",
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  heroCardButtonText: {
    color: "#0d1828",
    fontSize: 14,
    fontWeight: "800",
  },
  exploreStoryCard: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    padding: 12,
  },
  exploreStoryImage: {
    width: 92,
    height: 118,
    borderRadius: 16,
    backgroundColor: "#102238",
  },
  exploreStoryBody: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  exploreStoryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  exploreStoryBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#1a2f48",
    color: "#dbe9ff",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  exploreStoryTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  exploreStorySubtitle: {
    color: "#f8c15c",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  exploreStoryMeta: {
    color: "#aebcd3",
    fontSize: 13,
    lineHeight: 18,
  },
  featureCard: {
    width: 312,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#14243b",
    borderWidth: 1,
    borderColor: "#27405f",
  },
  featureCardImage: {
    width: "100%",
    height: 188,
    backgroundColor: "#102238",
  },
  featureCardBody: {
    padding: 18,
    gap: 8,
  },
  featureCardLabel: {
    color: "#f8c15c",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  featureCardTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  featureCardSubtitle: {
    color: "#f1f6ff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  featureCardMeta: {
    color: "#aec1d9",
    fontSize: 14,
    lineHeight: 20,
  },
  featureMetaPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
  },
  featureMetaPill: {
    borderRadius: 999,
    backgroundColor: "#1a2f48",
    borderWidth: 1,
    borderColor: "#35506f",
    color: "#dbe9ff",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bookHomeCard: {
    width: 248,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    overflow: "hidden",
  },
  bookHomeCardFullWidth: {
    width: "100%",
  },
  bookHomeCardImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#102238",
  },
  bookHomeCardImagePortrait: {
    // Book covers are portrait (≈2:3). A taller frame lets "contain" display
    // the full art without letterbox bars dominating the top/bottom.
    height: 284,
  },
  bookHomeCardBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  bookHomeCardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  bookHomeCardSubtitle: {
    color: "#f8c15c",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  bookHomeCardMeta: {
    color: "#aebcd3",
    fontSize: 13,
    lineHeight: 18,
  },
  bookHomeCardProgress: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
  },
  bookWebCard: {
    width: 324,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    flexDirection: "row",
    // Body and cover are both ~118-126 pt tall now, so flex-start hugs the
    // content at the top and leaves no awkward gap above the badges.
    alignItems: "flex-start",
    padding: 12,
    gap: 12,
  },
  bookWebCardFullWidth: {
    width: "100%",
  },
  bookWebCardCoverFrame: {
    // Shrunk from 104→86 px wide so the cover's height (86 / 0.72 ≈ 120 pt)
    // matches the typical body height (badges + 2-line title + stats +
    // topics ≈ 110-125 pt). Result: no empty vertical space above or below
    // the text column.
    width: 86,
    aspectRatio: 0.72,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0c1a2c",
    borderWidth: 1,
    borderColor: "#27405f",
    flexShrink: 0,
  },
  bookWebCardCover: {
    width: "100%",
    height: "100%",
    backgroundColor: "#102238",
  },
  bookWebCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  bookWebCardBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bookWebCardBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#1a2f48",
    color: "#dbe9ff",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  bookWebCardLevelBadge: {
    borderColor: "#2b7a66",
    backgroundColor: "rgba(37, 120, 98, 0.25)",
    color: "#8ef0c6",
  },
  bookWebCardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  bookWebCardStats: {
    color: "#aebcd3",
    fontSize: 12,
    fontWeight: "700",
  },
  bookWebCardTopics: {
    color: "#aebcd3",
    fontSize: 13,
    lineHeight: 18,
  },
  bookWebCardDescription: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
});
