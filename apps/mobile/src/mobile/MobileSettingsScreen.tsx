import { useState, type ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useAndroidBottomInset } from "./useAndroidBottomInset";

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

type SettingsTab = "account" | "personalize" | "privacy";

type Props = {
  headerAction?: ReactNode;
  /**
   * Display name for the user card. If omitted we derive a name from
   * `sessionEmail` (capitalised local-part). Falls back to "You".
   */
  displayName?: string | null;
  onPressEditProfile?: () => void;
  achievements?: AchievementSummary | null;
  /** Short label for the plan (e.g. "polyglot plan"). */
  planName?: string;
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
  /** Per-type notification toggles (streak, new content, practice…).
   *  The daily reminder keeps its own card above; these are the extra
   *  types the user can independently enable/disable. */
  notificationToggles?: Array<{
    key: string;
    label: string;
    description: string;
    value: boolean;
    onValueChange: (next: boolean) => void;
  }>;
  summaryItems: SummaryTile[];
  pushMessage?: string | null;
  showSignOut: boolean;
  onPressSignOut?: () => void;
  showSignIn: boolean;
  onPressSignIn?: () => void;
  /** Optional handler for the "Support" button at the bottom of Account. */
  onPressSupport?: () => void;
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

function deriveName(displayName: string | null | undefined, email: string | null | undefined): string {
  if (displayName && displayName.trim()) return displayName.trim();
  if (email) {
    const local = email.split("@")[0] ?? "";
    if (local) {
      // Capitalise: "yuri" → "Yuri", "alejandro.delcarpio" → "Alejandro".
      const first = local.split(/[._-]/)[0] ?? local;
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
  }
  return "You";
}

function initialOf(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  return ch || "Y";
}

export function MobileSettingsScreen({
  headerAction,
  displayName,
  onPressEditProfile,
  achievements,
  planName,
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
  notificationToggles,
  summaryItems,
  pushMessage,
  showSignOut,
  onPressSignOut,
  showSignIn,
  onPressSignIn,
  onPressSupport,
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
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  // Los Modal van en otra ventana: el inset de Android se aplica aquí.
  const androidBottomInset = useAndroidBottomInset();
  const name = deriveName(displayName, sessionEmail);
  const initial = initialOf(name);
  const activeReminder = reminderOptions.find((option) => option.active) ?? null;
  const planDisplayName = planName ?? (planLabel.replace(/^Current plan:\s*/i, "").trim() || "polyglot plan");

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <Text style={styles.heroTitle}>Settings</Text>
          {headerAction}
        </View>
      </View>

      <View style={styles.tabRow}>
        {(["account", "personalize", "privacy"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "account" ? "Account" : tab === "personalize" ? "Personalize" : "Privacy";
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, isActive ? styles.tabActive : null]}
            >
              <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.settingsSections}>
        {activeTab === "account" ? (
          <>
            {/* User card */}
            <View style={styles.userCard}>
              <View style={styles.userCardTopRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.userCardMeta}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {name}
                    </Text>
                    {achievements ? (
                      <Text style={styles.userLevelTag}> · Level {achievements.currentLevel}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.userSubLine} numberOfLines={1}>
                    {achievements
                      ? `${achievements.totalXp} XP · ${achievements.dailyStreak}-day streak`
                      : (sessionEmail ?? "")}
                  </Text>
                </View>
                {onPressEditProfile ? (
                  <Pressable onPress={onPressEditProfile} style={styles.userCardEditBtn}>
                    <Feather name="edit-2" size={14} color="#dbe9ff" />
                  </Pressable>
                ) : null}
              </View>

              {achievements ? (
                <>
                  <View style={styles.progressMetaRow}>
                    <Text style={styles.progressMetaCurrent}>
                      {achievements.currentLevelXp} / {achievements.nextLevelXp} XP
                    </Text>
                    <Text style={styles.progressMetaNext}>NEXT: LV {achievements.currentLevel + 1}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.round(
                              (achievements.currentLevelXp / Math.max(achievements.nextLevelXp, 1)) * 100
                            )
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.badgeRow}>
                    {achievements.badges.slice(0, 5).map((badge) => (
                      <View
                        key={`badge-${badge.id}`}
                        style={[
                          styles.badgeChip,
                          badge.unlocked ? styles.badgeChipActive : styles.badgeChipMuted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeChipText,
                            badge.unlocked ? styles.badgeChipTextActive : styles.badgeChipTextMuted,
                          ]}
                          numberOfLines={1}
                        >
                          {badge.label}
                        </Text>
                      </View>
                    ))}
                    <Text style={styles.badgeCounter}>
                      {achievements.badges.filter((b) => b.unlocked).length}/{achievements.badges.length}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Plan card */}
            <View style={styles.planCard}>
              <View style={styles.planIcon}>
                <Feather name="zap" size={16} color="#f8c15c" />
              </View>
              <View style={styles.planCopy}>
                <Text style={styles.planName}>{planDisplayName}</Text>
                <Text style={styles.planBody} numberOfLines={1}>
                  {planBody}
                </Text>
              </View>
              <Pressable onPress={onPressBilling} style={styles.planCta}>
                <Text style={styles.planCtaText}>{billingCta}</Text>
              </Pressable>
            </View>

            {/* Stats grid 4-up */}
            {summaryItems.length > 0 ? (
              <View style={styles.statsRow}>
                {summaryItems.slice(0, 4).map((item) => (
                  <View key={item.label} style={styles.statTile}>
                    <Text style={styles.statValue}>{item.value}</Text>
                    <Text style={styles.statLabel}>{item.label.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Daily reminder */}
            <View style={styles.reminderCard}>
              <View style={styles.reminderHeader}>
                <View style={styles.reminderIcon}>
                  <Feather name="bell" size={16} color="#dbe9ff" />
                </View>
                <View style={styles.reminderCopy}>
                  <Text style={styles.reminderTitle}>Daily reminder</Text>
                  <Text style={styles.reminderSub} numberOfLines={1}>
                    {!remindersEnabled
                      ? "Off"
                      : activeReminder
                        ? `Once a day at ${activeReminder.label}`
                        : "On · pick a time"}
                  </Text>
                </View>
                <Switch
                  value={remindersEnabled}
                  onValueChange={(v) => (v ? onPressRemindersOn() : onPressRemindersOff())}
                  trackColor={{ false: "#27405f", true: "#f8c15c" }}
                  thumbColor={remindersEnabled ? "#fff7e2" : "#9cb0c9"}
                  ios_backgroundColor="#27405f"
                />
              </View>

              {remindersEnabled ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.reminderChips}
                >
                  {reminderOptions.map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={option.onPress}
                      style={[styles.reminderChip, option.active ? styles.reminderChipActive : null]}
                    >
                      <Text
                        style={[styles.reminderChipText, option.active ? styles.reminderChipTextActive : null]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {pushMessage ? <Text style={styles.helperText}>{pushMessage}</Text> : null}
              {reminderHint ? <Text style={styles.helperText}>{reminderHint}</Text> : null}
            </View>

            {/* Per-type notification toggles */}
            {notificationToggles && notificationToggles.length > 0 ? (
              <View style={styles.reminderCard}>
                <View style={styles.reminderHeader}>
                  <View style={styles.reminderIcon}>
                    <Feather name="sliders" size={16} color="#dbe9ff" />
                  </View>
                  <View style={styles.reminderCopy}>
                    <Text style={styles.reminderTitle}>Notifications</Text>
                    <Text style={styles.reminderSub} numberOfLines={1}>
                      Choose what you want to hear about
                    </Text>
                  </View>
                </View>
                {notificationToggles.map((item, index) => (
                  <View
                    key={item.key}
                    style={[
                      styles.notifToggleRow,
                      index > 0 ? styles.notifToggleRowDivider : null,
                    ]}
                  >
                    <View style={styles.notifToggleCopy}>
                      <Text style={styles.notifToggleLabel}>{item.label}</Text>
                      <Text style={styles.notifToggleDesc}>{item.description}</Text>
                    </View>
                    <Switch
                      value={item.value}
                      onValueChange={item.onValueChange}
                      trackColor={{ false: "#27405f", true: "#f8c15c" }}
                      thumbColor={item.value ? "#fff7e2" : "#9cb0c9"}
                      ios_backgroundColor="#27405f"
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {/* Footer actions */}
            <View style={styles.footerRow}>
              {showSignOut && onPressSignOut ? (
                <Pressable onPress={onPressSignOut} style={[styles.footerButton, styles.footerButtonGhost]}>
                  <Feather name="log-out" size={16} color="#dbe9ff" />
                  <Text style={styles.footerButtonText}>Sign out</Text>
                </Pressable>
              ) : null}
              {showSignIn && onPressSignIn ? (
                <Pressable onPress={onPressSignIn} style={[styles.footerButton, styles.footerButtonPrimary]}>
                  <Text style={[styles.footerButtonText, styles.footerButtonTextPrimary]}>Sign in</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={
                  onPressSupport ??
                  (() =>
                    void Linking.openURL(
                      "mailto:support@digitalpolyglot.com?subject=Digital%20Polyglot%20iOS%20Feedback"
                    ))
                }
                style={[styles.footerButton, styles.footerButtonGhost]}
              >
                <Text style={styles.footerButtonText}>Support</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {activeTab === "personalize" ? (
          <View style={styles.personalizeWrap}>
            {/* 2-column grid keeps all 7 preferences visible without
                requiring scroll on iPhone 12-sized screens. */}
            <View style={styles.personalizeGrid}>
              {personalizationRows.map((row) => (
                <Pressable
                  key={row.id}
                  onPress={row.onPress}
                  style={styles.personalizeTile}
                >
                  <Text style={styles.personalizeLabel} numberOfLines={1}>
                    {row.label}
                  </Text>
                  <Text style={styles.personalizeValue} numberOfLines={1}>
                    {row.value}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={onPressSave}
              disabled={saveDisabled}
              style={[
                styles.inlineButton,
                styles.primaryButton,
                styles.personalizeSaveBtn,
                saveDisabled ? styles.disabledActionButton : null,
              ]}
            >
              <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>{saveLabel}</Text>
            </Pressable>
            {preferencesHint ? (
              <Text style={[styles.helperText, { textAlign: "center" }]} numberOfLines={1}>
                {preferencesHint}
              </Text>
            ) : null}
          </View>
        ) : null}

        {activeTab === "privacy" ? (
          <View style={styles.settingsLegalSection}>
            <Text style={styles.sectionEyebrow}>Privacy & legal</Text>
            <View style={styles.settingsLegalRow}>
              <Feather name="shield" size={16} color="#9cb0c9" />
              <View style={styles.settingsLegalCopy}>
                <Text style={styles.settingsLegalTitle}>Privacy</Text>
                <Text style={styles.settingsLegalText}>
                  Account, progress, favorites and usage data for authentication, personalization and billing.
                </Text>
              </View>
            </View>
            <View style={styles.settingsLegalDivider} />
            <View style={styles.settingsLegalRow}>
              <Feather name="sliders" size={16} color="#9cb0c9" />
              <View style={styles.settingsLegalCopy}>
                <Text style={styles.settingsLegalTitle}>Cookies</Text>
                <Text style={styles.settingsLegalText}>
                  Essential storage for sign-in and core behavior. Analytics is consent-based.
                </Text>
              </View>
            </View>
            <View style={styles.settingsLegalDivider} />
            <View style={styles.settingsLegalRow}>
              <Feather name="file-text" size={16} color="#9cb0c9" />
              <View style={styles.settingsLegalCopy}>
                <Text style={styles.settingsLegalTitle}>Terms</Text>
                <Text style={styles.settingsLegalText}>
                  Personal, non-exclusive access subject to fair use and platform policies.
                </Text>
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
              <Pressable
                onPress={() =>
                  void Linking.openURL("mailto:support@digitalpolyglot.com?subject=Data%20Deletion%20Request")
                }
                style={[styles.inlineButton, styles.primaryButton]}
              >
                <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Request deletion</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void Linking.openURL("mailto:support@digitalpolyglot.com?subject=Privacy%20Question")
                }
                style={styles.inlineButton}
              >
                <Text style={styles.inlineButtonText}>Contact support</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={onClosePicker}>
        <Pressable style={[styles.modalBackdrop, { paddingBottom: androidBottomInset }]} onPress={onClosePicker}>
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
                      <Pressable
                        key={interest}
                        onPress={() => onRemoveInterest(interest)}
                        style={styles.preferenceChip}
                      >
                        <Text style={styles.preferenceChipText}>{interest} ×</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {reminderPreviewTitle && reminderPreviewBody ? (
              <View style={styles.legalCard}>
                <View style={styles.settingsActionCopy}>
                  <Text style={styles.settingsActionTitle}>Preview</Text>
                  <Text style={styles.settingsActionText}>{reminderPreviewTitle}</Text>
                </View>
                <Text style={styles.legalBody}>{reminderPreviewBody}</Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 6,
    paddingBottom: 0,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  heroTitle: {
    color: "#f5f7fb",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },

  /* Tabs */
  tabRow: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#0f1f34",
    borderRadius: 18,
    padding: 4,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1e3450",
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#1f3553",
  },
  tabText: {
    color: "#9cb0c9",
    fontSize: 13,
    fontWeight: "800",
  },
  tabTextActive: {
    color: "#f8c15c",
  },

  /* User card */
  userCard: {
    backgroundColor: "#14243b",
    borderRadius: 20,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#27405f",
  },
  userCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f8c15c",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#10233a",
    fontSize: 20,
    fontWeight: "800",
  },
  userCardMeta: {
    flex: 1,
    gap: 4,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  userName: {
    color: "#f5f7fb",
    fontSize: 18,
    fontWeight: "800",
  },
  userLevelTag: {
    color: "#9cb0c9",
    fontSize: 14,
    fontWeight: "700",
  },
  userSubLine: {
    color: "#9cb0c9",
    fontSize: 13,
    fontWeight: "600",
  },
  userCardEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#172b43",
    alignItems: "center",
    justifyContent: "center",
  },

  progressMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressMetaCurrent: {
    color: "#f5f7fb",
    fontSize: 13,
    fontWeight: "700",
  },
  progressMetaNext: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f8c15c",
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  badgeChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  badgeChipActive: {
    borderColor: "rgba(248,193,92,0.55)",
    backgroundColor: "rgba(248,193,92,0.16)",
  },
  badgeChipMuted: {
    borderColor: "#29435f",
    backgroundColor: "#102238",
  },
  badgeChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeChipTextActive: {
    color: "#f8d48a",
  },
  badgeChipTextMuted: {
    color: "#7f95b2",
  },
  badgeCounter: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: "auto",
  },

  /* Plan card */
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#14243b",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27405f",
  },
  planIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(248,193,92,0.16)",
    borderWidth: 1,
    borderColor: "rgba(248,193,92,0.36)",
    alignItems: "center",
    justifyContent: "center",
  },
  planCopy: {
    flex: 1,
    gap: 1,
  },
  planName: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "800",
  },
  planBody: {
    color: "#9cb0c9",
    fontSize: 11,
  },
  planCta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f8c15c",
  },
  planCtaText: {
    color: "#10233a",
    fontSize: 13,
    fontWeight: "800",
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#14243b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27405f",
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    color: "#f5f7fb",
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    color: "#9cb0c9",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  /* Reminder */
  reminderCard: {
    backgroundColor: "#14243b",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27405f",
    padding: 12,
    gap: 10,
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reminderIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1f3553",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderCopy: {
    flex: 1,
    gap: 2,
  },
  reminderTitle: {
    color: "#f5f7fb",
    fontSize: 15,
    fontWeight: "800",
  },
  reminderSub: {
    color: "#9cb0c9",
    fontSize: 12,
  },
  reminderChips: {
    gap: 8,
    paddingRight: 8,
  },
  reminderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
  },
  reminderChipActive: {
    borderColor: "rgba(248,193,92,0.55)",
    backgroundColor: "rgba(248,193,92,0.16)",
  },
  reminderChipText: {
    color: "#9cb0c9",
    fontSize: 13,
    fontWeight: "700",
  },
  reminderChipTextActive: {
    color: "#f8d48a",
  },

  /* Per-type notification toggles */
  notifToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  notifToggleRowDivider: {
    borderTopWidth: 1,
    borderTopColor: "#1e3450",
  },
  notifToggleCopy: {
    flex: 1,
    gap: 2,
  },
  notifToggleLabel: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "700",
  },
  notifToggleDesc: {
    color: "#9cb0c9",
    fontSize: 12,
    lineHeight: 17,
  },

  /* Footer row */
  footerRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  footerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  footerButtonGhost: {
    borderColor: "#29435f",
    backgroundColor: "#102238",
  },
  footerButtonPrimary: {
    borderColor: "#f8c15c",
    backgroundColor: "#f8c15c",
  },
  footerButtonText: {
    color: "#dbe9ff",
    fontSize: 14,
    fontWeight: "800",
  },
  footerButtonTextPrimary: {
    color: "#10233a",
  },

  /* Shared / reused */
  card: {
    backgroundColor: "#14243b",
    borderRadius: 28,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#27405f",
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
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
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
  preferenceCard: {
    gap: 10,
  },
  /* Personalize tab; compact 2-column grid + save button. Designed
     so the 7 preference tiles + the save button fit on one screen on
     iPhone 12 without scrolling. */
  personalizeWrap: {
    gap: 10,
  },
  personalizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  personalizeTile: {
    flexBasis: "48.5%",
    flexGrow: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2,
  },
  personalizeLabel: {
    color: "#9cb0c9",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  personalizeValue: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "700",
  },
  personalizeSaveBtn: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 4,
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
    gap: 10,
    marginTop: 10,
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
