import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type JourneyOverviewCardProps = {
  score: number;
  totalStepsLabel: string;
  activeLevelLabel: string;
  nextMilestone: string;
  storyProgressLabel: string;
  practiceProgressLabel: string;
  checkpointProgressLabel: string;
  dueReviewLabel?: string | null;
  onPressDueReview?: () => void;
};

export type JourneyMilestoneCardProps = {
  progress: Animated.Value;
  title: string;
  body: string;
  cta: string;
  onPressPrimary: () => void;
  onPressLater: () => void;
};

export type JourneyPlacementOption = {
  id: string;
  title: string;
  active: boolean;
};

export type JourneyPlacementPickerProps = {
  currentLabel: string;
  levels: JourneyPlacementOption[];
  showAuto: boolean;
  disabled?: boolean;
  onSelectLevel: (levelId: string) => void;
  onSelectAuto: () => void;
};

export function JourneyOverviewCard({
  score,
  totalStepsLabel,
  activeLevelLabel,
  nextMilestone,
  storyProgressLabel,
  practiceProgressLabel,
  checkpointProgressLabel,
  dueReviewLabel,
  onPressDueReview,
}: JourneyOverviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreValue}>{score}</Text>
        <View style={styles.scoreCopy}>
          <Text style={styles.scoreTitle}>{totalStepsLabel}</Text>
          <Text style={styles.scoreMeta}>{activeLevelLabel}</Text>
        </View>
      </View>

      {dueReviewLabel ? (
        <View style={styles.metaPills}>
          <Pressable onPress={onPressDueReview}>
            <Text style={styles.metaPill}>{dueReviewLabel}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.scoreBar}>
        <View style={[styles.scoreBarFill, { width: `${Math.max(6, score)}%` }]} />
      </View>

      <Text style={styles.nextLine}>Next: {nextMilestone}</Text>

      <View style={styles.metaPills}>
        <Text style={styles.metaPill}>{storyProgressLabel}</Text>
        <Text style={styles.metaPill}>{practiceProgressLabel}</Text>
        <Text style={styles.metaPill}>{checkpointProgressLabel}</Text>
      </View>
    </View>
  );
}

export function JourneyMilestoneCard({
  progress,
  title,
  body,
  cta,
  onPressPrimary,
  onPressLater,
}: JourneyMilestoneCardProps) {
  return (
    <Animated.View
      style={[
        styles.primaryActionCard,
        styles.milestoneCard,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.primaryActionCopy}>
        <Text style={styles.primaryActionEyebrow}>Unlocked</Text>
        <Text style={styles.primaryActionTitle}>{title}</Text>
        <Text style={styles.primaryActionBody}>{body}</Text>
      </View>

      <View style={styles.milestoneBurst}>
        {[
          { left: 12, top: 10, backgroundColor: "#fde68a" },
          { left: 34, top: 30, backgroundColor: "#86efac" },
          { right: 18, top: 14, backgroundColor: "#7dd3fc" },
          { right: 40, top: 42, backgroundColor: "#fde68a" },
        ].map((particle, index) => (
          <Animated.View
            key={`journey-milestone-particle-${index}`}
            style={[
              styles.milestoneParticle,
              particle,
              {
                opacity: progress.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, index % 2 === 0 ? -12 : 12],
                    }),
                  },
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, index < 2 ? -8 : 8],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.6, 1, 0.7],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.milestoneActions}>
        <Pressable onPress={onPressPrimary} style={[styles.topicAction, styles.topicActionPrimary]}>
          <Text style={[styles.topicActionText, styles.topicActionTextPrimary]}>{cta}</Text>
        </Pressable>
        <Pressable onPress={onPressLater} style={styles.topicAction}>
          <Text style={styles.topicActionText}>Later</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function JourneyPlacementPicker({
  currentLabel,
  levels,
  showAuto,
  disabled = false,
  onSelectLevel,
  onSelectAuto,
}: JourneyPlacementPickerProps) {
  return (
    <View style={styles.placementInlineCard}>
      <View style={styles.placementInlineHeader}>
        <Text style={styles.primaryActionEyebrow}>Start level</Text>
        <Text style={styles.compactPlacementCopy}>{currentLabel}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.filterChips}>
        {levels.map((level) => (
          <Pressable
            key={`journey-placement-${level.id}`}
            disabled={disabled}
            onPress={() => onSelectLevel(level.id)}
            style={[styles.filterChip, level.active ? styles.filterChipActive : null]}
          >
            <Text style={[styles.filterChipText, level.active ? styles.filterChipTextActive : null]}>
              {level.title}
            </Text>
          </Pressable>
        ))}

        {showAuto ? (
          <Pressable disabled={disabled} onPress={onSelectAuto} style={styles.filterChip}>
            <Text style={styles.filterChipText}>Auto</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    backgroundColor: "#14243b",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#27405f",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  scoreValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 38,
  },
  scoreCopy: {
    flex: 1,
    gap: 2,
  },
  scoreTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  scoreMeta: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
  scoreBar: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#84cc16",
  },
  nextLine: {
    color: "#dbe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  metaPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#213754",
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  primaryActionCard: {
    gap: 14,
    backgroundColor: "#14243b",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#27405f",
  },
  milestoneCard: {
    borderColor: "rgba(110,231,183,0.26)",
    backgroundColor: "rgba(16,185,129,0.1)",
  },
  primaryActionCopy: {
    gap: 4,
  },
  primaryActionEyebrow: {
    color: "#f8d48a",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  primaryActionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  primaryActionBody: {
    color: "#c5d1e4",
    fontSize: 14,
    lineHeight: 21,
  },
  milestoneBurst: {
    position: "relative",
    height: 0,
  },
  milestoneParticle: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  milestoneActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  topicAction: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#172b43",
  },
  topicActionPrimary: {
    borderColor: "#5f83a8",
    backgroundColor: "#dbe9ff",
  },
  topicActionText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "800",
  },
  topicActionTextPrimary: {
    color: "#10233a",
  },
  placementInlineCard: {
    gap: 8,
    marginTop: 12,
  },
  placementInlineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  compactPlacementCopy: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1,
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
});
