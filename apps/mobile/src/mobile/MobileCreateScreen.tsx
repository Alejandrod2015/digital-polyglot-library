import type { ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type SetupRow = {
  id: string;
  label: string;
  value: string;
  onPress: () => void;
};

type PickerOption = {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

type CreatedStoryCard = {
  title: string;
  meta: string;
  helper: string;
  onOpenReader: () => void;
  onPractice: () => void;
  onRefresh: () => void;
};

type CreatedStoryHistoryItem = {
  key: string;
  title: string;
  meta: string;
  onRead: () => void;
  onPractice: () => void;
};

type Props = {
  headerAction?: ReactNode;
  resumeNotice?: string | null;
  setupRows: SetupRow[];
  primaryCtaLabel: string;
  primaryCtaDisabled: boolean;
  onPressGenerate: () => void;
  saveDefaultsLabel: string;
  saveDefaultsDisabled: boolean;
  onPressSaveDefaults: () => void;
  onPressOpenWebCreate: () => void;
  error?: string | null;
  statusEyebrow?: string | null;
  statusTitle?: string | null;
  statusBody?: string | null;
  prefillHint: string;
  createdStory?: CreatedStoryCard | null;
  recentStories: CreatedStoryHistoryItem[];
  pickerVisible: boolean;
  pickerTitle: string;
  onClosePicker: () => void;
  pickerOptions: PickerOption[];
};

export function MobileCreateScreen({
  headerAction,
  resumeNotice,
  setupRows,
  primaryCtaLabel,
  primaryCtaDisabled,
  onPressGenerate,
  saveDefaultsLabel,
  saveDefaultsDisabled,
  onPressSaveDefaults,
  onPressOpenWebCreate,
  error,
  statusEyebrow,
  statusTitle,
  statusBody,
  prefillHint,
  createdStory,
  recentStories,
  pickerVisible,
  pickerTitle,
  onClosePicker,
  pickerOptions,
}: Props) {
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Create</Text>
            <Text style={styles.title}>Create stories</Text>
            <Text style={styles.subtitle}>Pick the essentials, generate on iPhone, and open the result here.</Text>
          </View>
          {headerAction}
        </View>
      </View>

      <View style={[styles.card, styles.accountCard]}>
        <Text style={styles.sectionTitle}>Story setup</Text>
        <Text style={styles.helperText}>Pick the essentials here, then generate directly on iPhone.</Text>

        {resumeNotice ? (
          <View style={styles.statusNotice}>
            <Text style={styles.statusNoticeText}>{resumeNotice}</Text>
          </View>
        ) : null}

        <View style={styles.accordion}>
          {setupRows.map((row) => (
            <View key={row.id} style={styles.sectionCard}>
              <Pressable onPress={row.onPress} style={styles.sectionCardHeader}>
                <View style={styles.sectionCardHeaderText}>
                  <Text style={styles.sectionLabel}>{row.label}</Text>
                  <Text style={styles.sectionValue}>{row.value}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#dbe9ff" />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.actionStack}>
          <Pressable
            onPress={onPressGenerate}
            disabled={primaryCtaDisabled}
            style={[styles.inlineButton, styles.primaryButton, primaryCtaDisabled ? styles.disabledActionButton : null]}
          >
            <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>{primaryCtaLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onPressSaveDefaults}
            disabled={saveDefaultsDisabled}
            style={[styles.inlineButton, styles.ghostButton, saveDefaultsDisabled ? styles.disabledActionButton : null]}
          >
            <Text style={styles.inlineButtonText}>{saveDefaultsLabel}</Text>
          </Pressable>
          <Pressable onPress={onPressOpenWebCreate} style={styles.inlineButton}>
            <Text style={styles.inlineButtonText}>Need the full web create flow?</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {statusEyebrow && statusTitle && statusBody ? (
          <View style={[styles.card, styles.statusCard]}>
            <Text style={styles.sectionEyebrow}>{statusEyebrow}</Text>
            <Text style={styles.sectionTitle}>{statusTitle}</Text>
            <Text style={styles.helperText}>{statusBody}</Text>
          </View>
        ) : null}

        <Text style={styles.helperText}>{prefillHint}</Text>

        {createdStory ? (
          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.sectionEyebrow}>Generated</Text>
            <Text style={styles.sectionTitle}>{createdStory.title}</Text>
            <Text style={styles.metaLine}>{createdStory.meta}</Text>
            <Text style={styles.helperText}>{createdStory.helper}</Text>
            <View style={styles.actionsRow}>
              <Pressable onPress={createdStory.onOpenReader} style={[styles.inlineButton, styles.primaryButton]}>
                <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Open in reader</Text>
              </Pressable>
              <Pressable onPress={createdStory.onPractice} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Practice this story</Text>
              </Pressable>
              <Pressable onPress={createdStory.onRefresh} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Refresh story</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {recentStories.length > 0 ? (
          <View style={[styles.card, styles.historyCard]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>Recent</Text>
                <Text style={styles.sectionTitle}>Created on iPhone</Text>
              </View>
              <Text style={styles.helperText}>{recentStories.length} stories</Text>
            </View>
            <View style={styles.historyList}>
              {recentStories.slice(0, 4).map((story) => (
                <View key={story.key} style={styles.historyItem}>
                  <View style={styles.historyItemCopy}>
                    <Text numberOfLines={2} style={styles.historyItemTitle}>
                      {story.title}
                    </Text>
                    <Text style={styles.historyItemMeta}>{story.meta}</Text>
                  </View>
                  <View style={styles.historyItemActions}>
                    <Pressable onPress={story.onRead} style={styles.inlineButton}>
                      <Text style={styles.inlineButtonText}>Read</Text>
                    </Pressable>
                    <Pressable onPress={story.onPractice} style={styles.inlineButton}>
                      <Text style={styles.inlineButtonText}>Practice</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={onClosePicker}>
        <Pressable style={styles.modalBackdrop} onPress={onClosePicker}>
          <Pressable style={styles.pickerModal} onPress={() => {}}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Create</Text>
                <Text style={styles.sectionTitle}>{pickerTitle}</Text>
              </View>
              <Pressable onPress={onClosePicker} style={styles.readerIconButton}>
                <Feather name="x" size={18} color="#dbe9ff" />
              </Pressable>
            </View>

            <View style={styles.pickerOptions}>
              {pickerOptions.map((option) => (
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
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  heroHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: "#f8c15c",
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
  },
  title: {
    color: "#f5f7fb",
    fontSize: 34,
    fontWeight: "800" as const,
    lineHeight: 38,
  },
  subtitle: {
    color: "#b8c4d9",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#14243b",
    borderRadius: 28,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#27405f",
  },
  accountCard: {
    gap: 14,
  },
  sectionTitle: {
    color: "#f5f7fb",
    fontSize: 28,
    fontWeight: "800" as const,
    lineHeight: 32,
  },
  sectionEyebrow: {
    color: "#f8c15c",
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
  },
  helperText: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
  statusNotice: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.28)",
    backgroundColor: "rgba(14,116,144,0.18)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusNoticeText: {
    color: "#d7efff",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600" as const,
  },
  accordion: {
    gap: 10,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionCardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 14,
  },
  sectionCardHeaderText: {
    flex: 1,
    gap: 4,
  },
  sectionLabel: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  sectionValue: {
    color: "#f5f7fb",
    fontSize: 15,
    fontWeight: "700" as const,
    lineHeight: 20,
  },
  actionStack: {
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
    fontWeight: "800" as const,
  },
  primaryButtonText: {
    color: "#10233a",
  },
  disabledActionButton: {
    opacity: 0.45,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600" as const,
  },
  statusCard: {
    gap: 10,
  },
  metaLine: {
    color: "#9cb0c9",
    fontSize: 14,
    lineHeight: 21,
  },
  resultCard: {
    gap: 10,
  },
  actionsRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 10,
  },
  historyCard: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    padding: 14,
    gap: 10,
  },
  historyItemCopy: {
    gap: 4,
  },
  historyItemTitle: {
    color: "#f5f7fb",
    fontSize: 16,
    fontWeight: "800" as const,
    lineHeight: 22,
  },
  historyItemMeta: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
  historyItemActions: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 10, 20, 0.72)",
    justifyContent: "center" as const,
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 12,
  },
  readerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#18304d",
    borderWidth: 1,
    borderColor: "#315174",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  pickerOptions: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 10,
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
    fontWeight: "700" as const,
  },
  filterChipTextActive: {
    color: "#10233a",
  },
});
