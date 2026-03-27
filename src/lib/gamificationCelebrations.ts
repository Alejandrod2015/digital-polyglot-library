import type { GamificationSummary } from "@/lib/gamification";

export type GamificationCelebration = {
  id: string;
  title: string;
  body: string;
  cta: string;
};

function getUtcDayKey(base = new Date()): string {
  const y = base.getUTCFullYear();
  const m = `${base.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${base.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildGamificationCelebrations(
  summary: GamificationSummary,
  base = new Date()
): GamificationCelebration[] {
  const dayKey = getUtcDayKey(base);
  const items: GamificationCelebration[] = [];

  if (summary.currentLevel > 1) {
    items.push({
      id: `level:${summary.currentLevel}`,
      title: `Level ${summary.currentLevel} reached`,
      body: `You just leveled up with ${summary.totalXp} total XP. Keep the streak going.`,
      cta: "Keep going",
    });
  }

  summary.quests.forEach((quest) => {
    if (!quest.complete) return;
    items.push({
      id: `quest:${dayKey}:${quest.id}`,
      title: "Daily quest complete",
      body: `${quest.label} finished. You earned ${quest.rewardXp} XP.`,
      cta: "Claimed",
    });
  });

  summary.badges.forEach((badge) => {
    if (!badge.unlocked) return;
    items.push({
      id: `badge:${badge.id}`,
      title: `Badge unlocked: ${badge.label}`,
      body: badge.description,
      cta: "New badge",
    });
  });

  return items;
}
