import { Pressable, StyleSheet, Text, View } from "react-native";

type LanguageTheme = {
  flag: string;
  bg: string;
  accent: string;
};

const LANGUAGE_THEMES: Record<string, LanguageTheme> = {
  English:    { flag: "🇬🇧", bg: "#152a4a", accent: "#5b9bd5" },
  Spanish:    { flag: "🇪🇸", bg: "#301818", accent: "#e85d4a" },
  French:     { flag: "🇫🇷", bg: "#1e1e38", accent: "#7b68ee" },
  German:     { flag: "🇩🇪", bg: "#2a2816", accent: "#d4a843" },
  Italian:    { flag: "🇮🇹", bg: "#162e1a", accent: "#4aba6e" },
  Portuguese: { flag: "🇧🇷", bg: "#163030", accent: "#3dbfa8" },
  Japanese:   { flag: "🇯🇵", bg: "#2e1828", accent: "#e06090" },
  Korean:     { flag: "🇰🇷", bg: "#162040", accent: "#6aadff" },
};

const DEFAULT_THEME: LanguageTheme = { flag: "🌐", bg: "#14243b", accent: "#84cc16" };

export const ALL_LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian",
  "Portuguese", "Japanese", "Korean",
];

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
}: JourneyLanguageHubProps) {
  const displayLanguages = languages.length > 0 ? languages : ALL_LANGUAGES;

  return (
    <View style={styles.grid}>
      {displayLanguages.map((language) => {
        const insights = insightsByLanguage[language] ?? null;
        const theme = LANGUAGE_THEMES[language] ?? DEFAULT_THEME;
        const hasContent = insights !== null;

        return (
          <Pressable
            key={language}
            onPress={() => onSelectLanguage(language)}
            accessibilityRole="button"
            accessibilityLabel={`qa-journey-language-${language.toLowerCase()}`}
            testID={`qa-journey-language-${language.toLowerCase()}`}
            style={styles.cardWrapper}
          >
            <View style={[styles.card, { backgroundColor: theme.bg, borderColor: `${theme.accent}30` }]}>
              <Text style={styles.flag}>{theme.flag}</Text>
              <Text style={styles.languageName}>{language}</Text>

              {hasContent ? (
                <>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.max(6, insights.score)}%`, backgroundColor: theme.accent },
                      ]}
                    />
                  </View>
                  <View style={styles.statsRow}>
                    <Text style={[styles.scoreText, { color: theme.accent }]}>{insights.score}%</Text>
                    {insights.currentLevelId ? (
                      <Text style={[styles.levelBadge, { color: theme.accent, backgroundColor: `${theme.accent}18` }]}>
                        {insights.currentLevelId.toUpperCase()}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <Text style={styles.tapToStart}>Tap to start</Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cardWrapper: {
    width: "48.5%",
    flexGrow: 0,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 6,
    minHeight: 130,
    justifyContent: "flex-end",
  },
  flag: {
    fontSize: 32,
    marginBottom: 2,
  },
  languageName: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  progressBar: {
    height: 4,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 4,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreText: {
    fontSize: 13,
    fontWeight: "900",
  },
  levelBadge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: "hidden",
  },
  tapToStart: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
});
