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

  summary.quests.forEach((quest) => {
    if (!quest.complete) return;
    items.push({
      id: `quest:${dayKey}:${quest.id}`,
      title: "Daily quest complete",
      body: `${quest.label} finished. You earned ${quest.rewardXp} XP.`,
      cta: "Claimed",
    });
  });

  return items;
}
