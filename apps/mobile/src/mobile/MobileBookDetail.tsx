import type { RefObject } from "react";
import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BookHomeCard, BookWebCard, type BookCardModel } from "./MobileCards";
import { ProgressiveImage } from "./ProgressiveImage";

type BookDetailTab = "stories" | "vocab" | "reviews" | "about";
type BookStoryPickerSection = "topic" | "sort";

type FilterOption = {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

type BookStoryRow = {
  key: string;
  title: string;
  subtitle: string;
  meta: string;
  coverUrl: string;
  qaLabel?: string;
  onPress: () => void;
};

type BookDetailStoryCardItem = {
  key: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  meta: string;
  onPress: () => void;
};

type BookDetailContinueStory = {
  title: string;
  body: string;
  onPress: () => void;
};

type Props = {
  scrollRef?: RefObject<ScrollView | null>;
  title: string;
  subtitle?: string | null;
  coverUrl: string;
  description: string;
  descriptionExpanded: boolean;
  needsDescriptionToggle: boolean;
  onToggleDescription: () => void;
  pills: string[];
  storyCount: number;
  averageMinutes: number;
  isBookSaved: boolean;
  onPressBack: () => void;
  onPressSave: () => void;
  onPressStartReading?: () => void;
  continueStory?: BookDetailContinueStory | null;
  selectedTab: BookDetailTab;
  onSelectTab: (tab: BookDetailTab) => void;
  storySearchQuery: string;
  onChangeStorySearchQuery: (value: string) => void;
  onClearStorySearchQuery: () => void;
  selectedTopicLabel: string;
  selectedSortLabel: string;
  showingStoriesLabel: string;
  onOpenTopicPicker: () => void;
  onOpenSortPicker: () => void;
  pickerSection: BookStoryPickerSection | null;
  onClosePicker: () => void;
  topicOptions: FilterOption[];
  sortOptions: FilterOption[];
  storyRows: BookStoryRow[];
  suggestedStories: BookDetailStoryCardItem[];
  relatedBooks: BookCardModel[];
  vocabWords: string[];
  reviewQuotes: string[];
  aboutText: string;
};

export function MobileBookDetail({
  scrollRef,
  title,
  subtitle,
  coverUrl,
  description,
  descriptionExpanded,
  needsDescriptionToggle,
  onToggleDescription,
  pills,
  storyCount,
  averageMinutes,
  isBookSaved,
  onPressBack,
  onPressSave,
  onPressStartReading,
  continueStory,
  selectedTab,
  onSelectTab,
  storySearchQuery,
  onChangeStorySearchQuery,
  onClearStorySearchQuery,
  selectedTopicLabel,
  selectedSortLabel,
  showingStoriesLabel,
  onOpenTopicPicker,
  onOpenSortPicker,
  pickerSection,
  onClosePicker,
  topicOptions,
  sortOptions,
  storyRows,
  suggestedStories,
  relatedBooks,
  vocabWords,
  reviewQuotes,
  aboutText,
}: Props) {
  return (
    <View style={styles.shell}>
      <ScrollView
        ref={scrollRef}
        accessibilityLabel="qa-book-detail-screen"
        testID="qa-book-detail-screen"
        style={styles.scrollView}
        contentContainerStyle={[styles.container, styles.containerGrow]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={onPressBack}
            accessibilityRole="button"
            accessibilityLabel="qa-book-detail-back"
            testID="qa-book-detail-back"
            style={styles.iconButton}
          >
            <Feather name="arrow-left" size={18} color="#dbe9ff" />
          </Pressable>
          <Pressable onPress={onPressSave} style={styles.iconButton}>
            <Feather name="bookmark" size={18} color={isBookSaved ? "#f8c15c" : "#dbe9ff"} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <ProgressiveImage uri={coverUrl} style={styles.cover} resizeMode="contain" />
          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <Text style={styles.description} numberOfLines={descriptionExpanded ? undefined : 4}>
              {description}
            </Text>
            {needsDescriptionToggle ? (
              <Pressable onPress={onToggleDescription} style={styles.descriptionToggle}>
                <Text style={styles.descriptionToggleText}>
                  {descriptionExpanded ? "Show less" : "Show more"}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.pills}>
              {pills.map((pill) => (
                <View key={pill} style={styles.pill}>
                  <Text style={styles.pillText}>{pill}</Text>
                </View>
              ))}
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Stories</Text>
                <Text style={styles.statValue}>{storyCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg length</Text>
                <Text style={styles.statValue}>{averageMinutes}m</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Learner score</Text>
                <Text style={styles.statValue}>4.8</Text>
              </View>
            </View>

            <View style={styles.actions}>
              {onPressStartReading ? (
                <Pressable
                  onPress={onPressStartReading}
                  accessibilityRole="button"
                  accessibilityLabel="qa-book-start-reading"
                  testID="qa-book-start-reading"
                  style={[styles.inlineButton, styles.primaryButton]}
                >
                  <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Start reading</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onPressSave} style={[styles.inlineButton, styles.ghostButton]}>
                <Text style={styles.inlineButtonText}>{isBookSaved ? "Saved" : "Save book"}</Text>
              </Pressable>
            </View>

            {continueStory ? (
              <Pressable onPress={continueStory.onPress} style={styles.continueCard}>
                <Text style={styles.continueEyebrow}>Continue where you left off</Text>
                <Text style={styles.continueTitle}>{continueStory.title}</Text>
                <Text style={styles.continueMeta}>{continueStory.body}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.tabs}>
          {(["stories", "vocab", "reviews", "about"] as BookDetailTab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => onSelectTab(tab)}
              accessibilityRole="button"
              accessibilityLabel={`qa-book-tab-${tab}`}
              testID={`qa-book-tab-${tab}`}
              style={[styles.tab, selectedTab === tab ? styles.tabActive : null]}
            >
              <Text style={[styles.tabText, selectedTab === tab ? styles.tabTextActive : null]}>
                {tab === "stories" ? "Stories" : tab === "vocab" ? "Vocab" : tab === "reviews" ? "Reviews" : "About"}
              </Text>
            </Pressable>
          ))}
        </View>

        {selectedTab === "stories" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Stories</Text>
                <Text style={styles.sectionTitle}>Inside this book</Text>
              </View>
              <Text style={styles.helperText}>{storyCount} stories</Text>
            </View>

            <View style={styles.storyControls}>
              <View style={styles.searchInputWrap}>
                <Feather name="search" size={16} color="#7f95b2" />
                <TextInput
                  value={storySearchQuery}
                  onChangeText={onChangeStorySearchQuery}
                  accessibilityLabel="qa-book-story-search-input"
                  testID="qa-book-story-search-input"
                  placeholder="Search a story"
                  placeholderTextColor="#7f95b2"
                  style={styles.searchInput}
                />
                {storySearchQuery.length > 0 ? (
                  <Pressable onPress={onClearStorySearchQuery} hitSlop={8} style={styles.searchClear}>
                    <Text style={styles.searchClearText}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.storyControlRow}>
                <Pressable onPress={onOpenTopicPicker} style={styles.storyControlButton}>
                  <Text style={styles.storyControlLabel}>Topic</Text>
                  <Text style={styles.storyControlValue} numberOfLines={1}>
                    {selectedTopicLabel}
                  </Text>
                </Pressable>
                <Pressable onPress={onOpenSortPicker} style={styles.storyControlButton}>
                  <Text style={styles.storyControlLabel}>Sort</Text>
                  <Text style={styles.storyControlValue} numberOfLines={1}>
                    {selectedSortLabel}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.storyShowingText}>{showingStoriesLabel}</Text>
            </View>

            <Modal transparent visible={pickerSection !== null} animationType="fade" onRequestClose={onClosePicker}>
              <Pressable style={styles.modalBackdrop} onPress={onClosePicker}>
                <Pressable style={styles.pickerModal} onPress={() => {}}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.sectionTitle}>{pickerSection === "topic" ? "Topic" : "Sort"}</Text>
                    <Pressable onPress={onClosePicker} style={styles.iconButton}>
                      <Feather name="x" size={18} color="#dbe9ff" />
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="normal"
                    contentContainerStyle={styles.filterChips}
                  >
                    {(pickerSection === "topic" ? topicOptions : sortOptions).map((option) => (
                      <Pressable
                        key={option.key}
                        onPress={option.onPress}
                        style={[styles.filterChip, option.active ? styles.filterChipActive : null]}
                      >
                        <Text style={[styles.filterChipText, option.active ? styles.filterChipTextActive : null]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>

            {storyRows.length > 0 ? (
              <View style={styles.storyList}>
                {storyRows.map((story) => (
                  <Pressable
                    key={story.key}
                    onPress={story.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={story.qaLabel}
                    testID={story.qaLabel}
                    style={styles.storyListCard}
                  >
                    <ProgressiveImage uri={story.coverUrl} style={styles.storyListCover} resizeMode="cover" />
                    <View style={styles.storyListBody}>
                      <Text style={styles.storyListTitle}>{story.title}</Text>
                      <Text style={styles.storyListSubtitle}>{story.subtitle}</Text>
                      <Text style={styles.storyListMeta}>{story.meta}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#9cb0c9" />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No stories match those filters</Text>
                <Text style={styles.metaLine}>Try a different topic, sort or search query.</Text>
              </View>
            )}

            {suggestedStories.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>Suggested stories</Text>
                    <Text style={styles.sectionTitle}>More stories in your lane</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="normal"
                  contentContainerStyle={styles.carousel}
                >
                  {suggestedStories.map((item) => (
                    <BookHomeCard key={item.key} item={item} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {relatedBooks.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>Suggested books</Text>
                    <Text style={styles.sectionTitle}>Similar books to explore next</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="normal"
                  contentContainerStyle={styles.carousel}
                >
                  {relatedBooks.map((item) => (
                    <BookWebCard key={item.key} item={item} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : null}

        {selectedTab === "vocab" ? (
          <View style={styles.panelCard}>
            <Text style={styles.sectionTitle}>Top vocabulary in this book</Text>
            <Text style={styles.metaLine}>High-frequency words for quick practice.</Text>
            <View style={styles.vocabWrap}>
              {vocabWords.map((word) => (
                <View key={`vocab-${word}`} style={styles.vocabChip}>
                  <Text style={styles.vocabChipText}>{word}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {selectedTab === "reviews" ? (
          <View style={styles.reviewGrid}>
            {reviewQuotes.map((quote) => (
              <View key={quote} style={styles.reviewCard}>
                <Text style={styles.reviewText}>{quote}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {selectedTab === "about" ? (
          <View style={styles.panelCard}>
            <Text style={styles.sectionTitle}>About this book</Text>
            <Text style={styles.description}>{aboutText}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  scrollView: { flex: 1 },
  container: {
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 128,
  },
  containerGrow: {
    flexGrow: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#18304d",
    borderWidth: 1,
    borderColor: "#315174",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { gap: 18 },
  cover: {
    width: "100%",
    height: 320,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#28415f",
    backgroundColor: "#132238",
  },
  body: { gap: 10 },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  subtitle: {
    color: "#dbe9ff",
    fontSize: 18,
    lineHeight: 24,
  },
  description: {
    color: "#9cb0c9",
    fontSize: 15,
    lineHeight: 23,
  },
  descriptionToggle: {
    alignSelf: "flex-start",
    marginTop: -2,
  },
  descriptionToggleText: {
    color: "#f8c15c",
    fontSize: 13,
    fontWeight: "700",
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3d5470",
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "rgba(21, 37, 58, 0.55)",
  },
  pillText: {
    color: "#d7e2f1",
    fontSize: 11,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 4,
  },
  statLabel: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "700",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  inlineButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#172b43",
  },
  primaryButton: {
    backgroundColor: "#f8c15c",
    borderColor: "#f8c15c",
  },
  ghostButton: {
    backgroundColor: "#15263d",
  },
  inlineButtonText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButtonText: {
    color: "#10233a",
  },
  continueCard: {
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
    backgroundColor: "rgba(56,189,248,0.12)",
    padding: 14,
  },
  continueEyebrow: {
    color: "#8fdcff",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  continueTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  continueMeta: {
    color: "#d2e9f7",
    fontSize: 13,
    lineHeight: 18,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 2,
  },
  tab: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: "#2563eb",
  },
  tabText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionEyebrow: {
    color: "#f8c15c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: "#f5f7fb",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  helperText: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
  storyControls: { gap: 10 },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "500",
  },
  searchClear: {
    paddingVertical: 2,
  },
  searchClearText: {
    color: "#92a8c3",
    fontSize: 12,
    fontWeight: "600",
  },
  storyControlRow: {
    flexDirection: "row",
    gap: 10,
  },
  storyControlButton: {
    flex: 1,
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storyControlLabel: {
    color: "#92a8c3",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  storyControlValue: {
    color: "#f5f7fb",
    fontSize: 13,
    fontWeight: "600",
  },
  storyShowingText: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "500",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 10, 20, 0.72)",
    justifyContent: "center",
    padding: 24,
  },
  pickerModal: {
    backgroundColor: "#132238",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2c4564",
    padding: 20,
    gap: 16,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterChips: {
    gap: 10,
    paddingRight: 10,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#172b43",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: "#dbe9ff",
    borderColor: "#dbe9ff",
  },
  filterChipText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#10233a",
  },
  storyList: { gap: 12 },
  storyListCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
  },
  storyListCover: {
    width: 72,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#17304b",
  },
  storyListBody: {
    flex: 1,
    gap: 4,
  },
  storyListTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  storyListSubtitle: {
    color: "#f1c35d",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  storyListMeta: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: "#f5f7fb",
    fontSize: 18,
    fontWeight: "800",
  },
  metaLine: {
    color: "#9cb0c9",
    fontSize: 14,
    lineHeight: 21,
  },
  carousel: {
    gap: 12,
    paddingRight: 24,
  },
  panelCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
  },
  vocabWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vocabChip: {
    borderRadius: 999,
    backgroundColor: "#173351",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  vocabChipText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  reviewGrid: { gap: 10 },
  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
  },
  reviewText: {
    color: "#eef4ff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
