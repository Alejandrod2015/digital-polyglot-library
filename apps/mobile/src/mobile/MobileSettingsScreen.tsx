import type { ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type AchievementSummary = {
  totalXp: number;
  dailyStreak: number;
  currentLevel: number;
  currentLevelXp: number;
  nextLevelXp: number;
  badges: Array<{
    id: string;
    label: string;
    unlocked: boolean;
  }>;
};

type PreferenceRow = {
  id: string;
  label: string;
  value: string;
  onPress: () => void;
};

type ReminderOption = {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

type SummaryTile = {
  label: string;
  value: string;
};

type PickerOption = {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

type Props = {
  headerAction?: ReactNode;
  achievements?: AchievementSummary | null;
  planLabel: string;
  planBody: string;
  billingCta: string;
  onPressBilling: () => void;
  sessionEmail?: string | null;
  personalizationRows: PreferenceRow[];
  saveDisabled: boolean;
  saveLabel: string;
  onPressSave: () => void;
  preferencesHint: string;
  remindersEnabled: boolean;
  onPressRemindersOn: () => void;
  onPressRemindersOff: () => void;
  reminderOptions: ReminderOption[];
  reminderPreviewTitle?: string | null;
  reminderPreviewBody?: string | null;
  reminderHint: string;
  summaryItems: SummaryTile[];
  pushMessage?: string | null;
  showSignOut: boolean;
  onPressSignOut?: () => void;
  showSignIn: boolean;
  onPressSignIn?: () => void;
  pickerVisible: boolean;
  pickerTitle: string;
  onClosePicker: () => void;
  onSavePicker?: () => void;
  pickerOptions: PickerOption[];
  showInterestComposer: boolean;
  customInterestInput: string;
  onChangeCustomInterestInput: (value: string) => void;
  onAddCustomInterest: () => void;
  selectedInterests: string[];
  onRemoveInterest: (interest: string) => void;
};

export function MobileSettingsScreen({
  headerAction,
  achievements,
  planLabel,
  planBody,
  billingCta,
  onPressBilling,
  sessionEmail,
  personalizationRows,
  saveDisabled,
  saveLabel,
  onPressSave,
  preferencesHint,
  remindersEnabled,
  onPressRemindersOn,
  onPressRemindersOff,
  reminderOptions,
  reminderPreviewTitle,
  reminderPreviewBody,
  reminderHint,
  summaryItems,
  pushMessage,
  showSignOut,
  onPressSignOut,
  showSignIn,
  onPressSignIn,
  pickerVisible,
  pickerTitle,
  onClosePicker,
  onSavePicker,
  pickerOptions,
  showInterestComposer,
  customInterestInput,
  onChangeCustomInterestInput,
  onAddCustomInterest,
  selectedInterests,
  onRemoveInterest,
}: Props) {
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Settings</Text>
            <Text style={styles.title}>Account & device</Text>
            <Text style={styles.subtitle}>Plan, defaults and account actions.</Text>
          </View>
          {headerAction}
        </View>
      </View>

      <View style={styles.settingsSections}>
        {achievements ? (
          <View style={[styles.card, styles.accountCard]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Profile</Text>
                <Text style={styles.sectionTitle}>Achievements shelf</Text>
              </View>
              <Text style={styles.helperText}>{achievements.totalXp} XP</Text>
            </View>

            <View style={styles.gamificationBadgeRow}>
              <View style={styles.gamificationPill}>
                <Feather name="zap" size={14} color="#ffd36b" />
                <Text style={styles.gamificationPillText}>{achievements.dailyStreak}-day streak</Text>
              </View>
              <View style={styles.gamificationPill}>
                <Feather name="award" size={14} color="#8ef0c6" />
                <Text style={styles.gamificationPillText}>Level {achievements.currentLevel}</Text>
              </View>
            </View>

            <View style={styles.gamificationTrack}>
              <View
                style={[
                  styles.gamificationFill,
                  {
                    width: `${Math.round(
                      (achievements.currentLevelXp / Math.max(achievements.nextLevelXp, 1)) * 100
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.gamificationTrackMeta}>
              {achievements.currentLevelXp} / {achievements.nextLevelXp} XP to next level
            </Text>

            <View style={styles.gamificationBadgeSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>Unlocked badges</Text>
                <Text style={styles.helperText}>
                  {achievements.badges.filter((badge) => badge.unlocked).length}/{achievements.badges.length}
                </Text>
              </View>
              <View style={styles.gamificationBadgeWrap}>
                {achievements.badges.map((badge) => (
                  <View
                    key={`settings-badge-${badge.id}`}
                    style={[
                      styles.gamificationBadgeChip,
                      badge.unlocked ? styles.gamificationBadgeChipUnlocked : styles.gamificationBadgeChipLocked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.gamificationBadgeChipText,
                        badge.unlocked ? styles.gamificationBadgeChipTextUnlocked : styles.gamificationBadgeChipTextLocked,
                      ]}
                    >
                      {badge.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.billingCard}>
          <View style={styles.billingHeader}>
            <View style={styles.billingCopy}>
              <Text style={styles.sectionEyebrow}>Billing</Text>
              <Text style={styles.sectionTitle}>{planLabel}</Text>
              <Text style={styles.metaLine}>{planBody}</Text>
            </View>
          </View>
          <Pressable onPress={onPressBilling} style={[styles.inlineButton, styles.primaryButton, styles.billingButton]}>
            <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>{billingCta}</Text>
          </Pressable>
          {sessionEmail ? <Text style={styles.accountMeta}>{sessionEmail}</Text> : null}
        </View>

        <View style={[styles.card, styles.preferenceCard]}>
          <Text style={styles.sectionTitle}>Personalization</Text>
          <Text style={styles.metaLine}>Edit your defaults here without a long form.</Text>
          <View style={styles.accordion}>
            {personalizationRows.map((row) => (
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

          <View style={styles.settingsSaveRow}>
            <Pressable
              onPress={onPressSave}
              disabled={saveDisabled}
              style={[styles.inlineButton, styles.primaryButton, saveDisabled ? styles.disabledActionButton : null]}
            >
              <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>{saveLabel}</Text>
            </Pressable>
            <Text style={styles.helperText}>{preferencesHint}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.preferenceCard]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Daily reminders</Text>
              <Text style={styles.sectionTitle}>Keep the loop alive</Text>
            </View>
          </View>
          <Text style={styles.metaLine}>
            iPhone uses local notifications at the time you pick here. Web keeps the schedule synced.
          </Text>
          <View style={styles.filterChipsWrap}>
            <Pressable onPress={onPressRemindersOn} style={[styles.filterChip, remindersEnabled ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, remindersEnabled ? styles.filterChipTextActive : null]}>
                Reminders on
              </Text>
            </Pressable>
            <Pressable onPress={onPressRemindersOff} style={[styles.filterChip, !remindersEnabled ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, !remindersEnabled ? styles.filterChipTextActive : null]}>
                Reminders off
              </Text>
            </Pressable>
          </View>
          {remindersEnabled ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.filterChips}>
              {reminderOptions.map((option) => (
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
          ) : null}

          {remindersEnabled && reminderPreviewTitle && reminderPreviewBody ? (
            <View style={styles.legalCard}>
              <View style={styles.settingsActionCopy}>
                <Text style={styles.settingsActionTitle}>Preview</Text>
                <Text style={styles.settingsActionText}>{reminderPreviewTitle}</Text>
              </View>
              <Text style={styles.legalBody}>{reminderPreviewBody}</Text>
            </View>
          ) : null}
          <Text style={styles.helperText}>{reminderHint}</Text>
        </View>

        <View style={styles.settingsLegalSection}>
          <Text style={styles.sectionEyebrow}>Privacy & legal</Text>
          <View style={styles.settingsLegalRow}>
            <Feather name="shield" size={16} color="#9cb0c9" />
            <View style={styles.settingsLegalCopy}>
              <Text style={styles.settingsLegalTitle}>Privacy</Text>
              <Text style={styles.settingsLegalText}>Account, progress, favorites and usage data for authentication, personalization and billing.</Text>
            </View>
          </View>
          <View style={styles.settingsLegalDivider} />
          <View style={styles.settingsLegalRow}>
            <Feather name="sliders" size={16} color="#9cb0c9" />
            <View style={styles.settingsLegalCopy}>
              <Text style={styles.settingsLegalTitle}>Cookies</Text>
              <Text style={styles.settingsLegalText}>Essential storage for sign-in and core behavior. Analytics is consent-based.</Text>
            </View>
          </View>
          <View style={styles.settingsLegalDivider} />
          <View style={styles.settingsLegalRow}>
            <Feather name="file-text" size={16} color="#9cb0c9" />
            <View style={styles.settingsLegalCopy}>
              <Text style={styles.settingsLegalTitle}>Terms</Text>
              <Text style={styles.settingsLegalText}>Personal, non-exclusive access subject to fair use and platform policies.</Text>
            </View>
          </View>
          <View style={styles.settingsLegalDivider} />
          <View style={styles.settingsLegalRow}>
            <Feather name="trash-2" size={16} color="#9cb0c9" />
            <View style={styles.settingsLegalCopy}>
              <Text style={styles.settingsLegalTitle}>Data deletion</Text>
              <Text style={styles.settingsLegalText}>Request account or data deletion directly from iPhone.</Text>
            </View>
          </View>
          <View style={styles.legalActions}>
            <Pressable onPress={() => void Linking.openURL("mailto:support@digitalpolyglot.com?subject=Data%20Deletion%20Request")} style={[styles.inlineButton, styles.primaryButton]}>
              <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Request deletion</Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL("mailto:support@digitalpolyglot.com?subject=Privacy%20Question")} style={styles.inlineButton}>
              <Text style={styles.inlineButtonText}>Contact support</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          {summaryItems.map((item) => (
            <View key={item.label} style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        {pushMessage ? <Text style={styles.helperText}>{pushMessage}</Text> : null}
        {showSignOut && onPressSignOut ? (
          <Pressable onPress={onPressSignOut} style={[styles.inlineButton, styles.ghostButton]}>
            <Text style={styles.inlineButtonText}>Sign out</Text>
          </Pressable>
        ) : null}
        {showSignIn && onPressSignIn ? (
          <Pressable onPress={onPressSignIn} style={[styles.inlineButton, styles.primaryButton]}>
            <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Sign in</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={onClosePicker}>
        <Pressable style={styles.modalBackdrop} onPress={onClosePicker}>
          <Pressable style={styles.pickerModal} onPress={() => {}}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Settings</Text>
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

            {onSavePicker ? (
              <Pressable
                onPress={onSavePicker}
                style={[styles.inlineButton, styles.primaryButton, { marginTop: 8 }]}
              >
                <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Save</Text>
              </Pressable>
            ) : null}

            {showInterestComposer ? (
              <>
                <View style={styles.preferenceInputRow}>
                  <TextInput
                    value={customInterestInput}
                    onChangeText={onChangeCustomInterestInput}
                    placeholder="Add interest"
                    placeholderTextColor="#7f95b2"
                    style={styles.preferenceInput}
                  />
                  <Pressable onPress={onAddCustomInterest} style={[styles.inlineButton, styles.primaryButton]}>
                    <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Add</Text>
                  </Pressable>
                </View>
                {selectedInterests.length > 0 ? (
                  <View style={styles.preferenceChips}>
                    {selectedInterests.map((interest) => (
                      <Pressable key={interest} onPress={() => onRemoveInterest(interest)} style={styles.preferenceChip}>
                        <Text style={styles.preferenceChipText}>{interest} ×</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: "#f8c15c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#f5f7fb",
    fontSize: 34,
    fontWeight: "800",
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
  metaLine: {
    color: "#9cb0c9",
    fontSize: 14,
    lineHeight: 21,
  },
  gamificationBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gamificationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#203554",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  gamificationPillText: {
    color: "#e8f1ff",
    fontSize: 12,
    fontWeight: "800",
  },
  gamificationTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  gamificationFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f8c15c",
  },
  gamificationTrackMeta: {
    color: "#9cb0c9",
    fontSize: 12,
    lineHeight: 18,
  },
  gamificationBadgeSection: {
    gap: 10,
  },
  gamificationBadgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gamificationBadgeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  gamificationBadgeChipUnlocked: {
    borderColor: "rgba(248,193,92,0.45)",
    backgroundColor: "rgba(248,193,92,0.16)",
  },
  gamificationBadgeChipLocked: {
    borderColor: "#29435f",
    backgroundColor: "#102238",
  },
  gamificationBadgeChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  gamificationBadgeChipTextUnlocked: {
    color: "#f8d48a",
  },
  gamificationBadgeChipTextLocked: {
    color: "#7f95b2",
  },
  billingCard: {
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    padding: 16,
  },
  billingHeader: {
    gap: 8,
  },
  billingCopy: {
    gap: 6,
  },
  billingButton: {
    alignSelf: "stretch",
    marginTop: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  accountMeta: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
  preferenceCard: {
    gap: 10,
    marginTop: 12,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  sectionCardHeaderText: {
    flex: 1,
    gap: 4,
  },
  sectionLabel: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionValue: {
    color: "#f5f7fb",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  settingsSaveRow: {
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
  disabledActionButton: {
    opacity: 0.45,
  },
  filterChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
  settingsSections: {
    gap: 16,
  },
  settingsLegalSection: {
    gap: 14,
    paddingTop: 8,
  },
  settingsLegalRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  settingsLegalCopy: {
    flex: 1,
    gap: 2,
  },
  settingsLegalTitle: {
    color: "#f5f7fb",
    fontSize: 15,
    fontWeight: "700",
  },
  settingsLegalText: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 19,
  },
  settingsLegalDivider: {
    height: 1,
    backgroundColor: "#1e3450",
  },
  legalCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    padding: 14,
  },
  legalBody: {
    color: "#aebcd3",
    fontSize: 14,
    lineHeight: 21,
  },
  legalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  settingsActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingsActionCopy: {
    flex: 1,
    gap: 2,
  },
  settingsActionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  settingsActionText: {
    color: "#c3d0e2",
    fontSize: 13,
    lineHeight: 19,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryTile: {
    flexBasis: "47%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  summaryValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "700",
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
  readerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#18304d",
    borderWidth: 1,
    borderColor: "#315174",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  preferenceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  preferenceInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f5f7fb",
    fontSize: 14,
  },
  preferenceChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  preferenceChip: {
    borderRadius: 999,
    backgroundColor: "#173351",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  preferenceChipText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
});
