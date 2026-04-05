import { Pressable, StyleSheet, Text, View } from "react-native";

const LANGUAGE_FLAGS: Record<string, string> = {
  English: "🇬🇧",
  Spanish: "🇪🇸",
  French: "🇫🇷",
  German: "🇩🇪",
  Italian: "🇮🇹",
  Portuguese: "🇧🇷",
  Japanese: "🇯🇵",
  Korean: "🇰🇷",
  Chinese: "🇨🇳",
};

export type LanguageInsightsSummary = {
  score: number;
  completedSteps: number;
  totalSteps: number;
  currentLevelId: string | null;
  nextMilestone: string;
};

export type JourneyLanguageHubProps = {
  languages: string[];
  insightsByLanguage: Record<string, LanguageInsightsSummary | null>;
  onSelectLanguage: (language: string) => void;
  onOpenSettings: () => void;
};

export function JourneyLanguageHub({
  languages,
  insightsByLanguage,
  onSelectLanguage,
  onOpenSettings,
}: JourneyLanguageHubProps) {
  if (languages.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No languages selected</Text>
        <Text style={styles.emptyBody}>Add languages in Settings to start your journey.</Text>
        <Pressable onPress={onOpenSettings} style={styles.settingsButton}>
          <Text style={styles.settingsButtonText}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {languages.map((language) => {
        const insights = insightsByLanguage[language] ?? null;
        const flag = LANGUAGE_FLAGS[language] ?? "🌐";
        const hasContent = insights !== null;

        return (
          <Pressable
            key={language}
            onPress={() => onSelectLanguage(language)}
            accessibilityRole="button"
            accessibilityLabel={`qa-journey-language-${language.toLowerCase()}`}
            testID={`qa-journey-language-${language.toLowerCase()}`}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.flag}>{flag}</Text>
              <View style={styles.cardHeaderText}>
                <Text style={styles.languageName}>{language}</Text>
                {hasContent && insights.currentLevelId ? (
                  <Text style={styles.levelBadge}>{insights.currentLevelId.toUpperCase()}</Text>
                ) : null}
              </View>
              {hasContent ? (
                <Text style={styles.scoreText}>{insights.score}%</Text>
              ) : null}
            </View>

            {hasContent ? (
              <>
                <View style={styles.progressBar}>
                  <View style={[styles.progressBarFill, { width: `${Math.max(4, insights.score)}%` }]} />
                </View>
                <Text style={styles.milestoneText}>
                  {insights.completedSteps}/{insights.totalSteps} steps · {insights.nextMilestone}
                </Text>
              </>
            ) : (
              <Text style={styles.tapToStart}>Tap to start</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    gap: 10,
    backgroundColor: "#14243b",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27405f",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flag: {
    fontSize: 28,
  },
  cardHeaderText: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  languageName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  levelBadge: {
    color: "#f8d48a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    backgroundColor: "rgba(248,212,138,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  scoreText: {
    color: "#84cc16",
    fontSize: 16,
    fontWeight: "900",
  },
  progressBar: {
    height: 6,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#84cc16",
  },
  milestoneText: {
    color: "#9cb0c9",
    fontSize: 12,
    lineHeight: 17,
  },
  tapToStart: {
    color: "#5a7da0",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    gap: 10,
    backgroundColor: "#14243b",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#27405f",
    alignItems: "center",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyBody: {
    color: "#9cb0c9",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  settingsButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#dbe9ff",
  },
  settingsButtonText: {
    color: "#10233a",
    fontSize: 13,
    fontWeight: "800",
  },
});
