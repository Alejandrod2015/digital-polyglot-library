export type GamificationQuest = {
  id: "listen_today" | "finish_story" | "practice_today" | "save_words";
  label: string;
  current: number;
  target: number;
  rewardXp: number;
  complete: boolean;
};

export type GamificationBadge = {
  id: "first_story" | "week_streak" | "word_collector" | "practice_ten" | "region_explorer";
  label: string;
  description: string;
  unlocked: boolean;
  accent: string;
};

export type GamificationSummary = {
  totalXp: number;
  todayXp: number;
  weeklyXp: number;
  currentLevel: number;
  levelStartXp: number;
  nextLevelXp: number;
  levelProgress: number;
  dailyStreak: number;
  quests: GamificationQuest[];
  badges: GamificationBadge[];
};

type BuildGamificationArgs = {
  minutesListened: number;
  weeklyMinutesListened: number;
  storiesFinished: number;
  booksFinished: number;
  wordsLearned: number;
  practiceSessionsCompleted: number;
  regionsExplored: number;
  streakDays: number;
  todayMinutesListened: number;
  todayStoriesFinished: number;
  todayWordsSaved: number;
  todayPracticeSessions: number;
  weeklyStoriesFinished: number;
  weeklyPracticeSessions: number;
};

const XP_PER_LISTEN_MINUTE = 2;
const XP_PER_STORY_FINISHED = 30;
const XP_PER_BOOK_FINISHED = 80;
const XP_PER_WORD_SAVED = 6;
const XP_PER_PRACTICE_SESSION = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getXpForTotals(args: {
  minutesListened: number;
  storiesFinished: number;
  booksFinished: number;
  wordsLearned: number;
  practiceSessionsCompleted: number;
}) {
  return (
    Math.max(0, args.minutesListened) * XP_PER_LISTEN_MINUTE +
    Math.max(0, args.storiesFinished) * XP_PER_STORY_FINISHED +
    Math.max(0, args.booksFinished) * XP_PER_BOOK_FINISHED +
    Math.max(0, args.wordsLearned) * XP_PER_WORD_SAVED +
    Math.max(0, args.practiceSessionsCompleted) * XP_PER_PRACTICE_SESSION
  );
}

function getQuestList(args: BuildGamificationArgs): GamificationQuest[] {
  return [
    {
      id: "listen_today",
      label: "Listen 10 min",
      current: args.todayMinutesListened,
      target: 10,
      rewardXp: 20,
      complete: args.todayMinutesListened >= 10,
    },
    {
      id: "finish_story",
      label: "Finish 1 story",
      current: args.todayStoriesFinished,
      target: 1,
      rewardXp: 25,
      complete: args.todayStoriesFinished >= 1,
    },
    {
      id: "practice_today",
      label: "Complete 1 practice",
      current: args.todayPracticeSessions,
      target: 1,
      rewardXp: 15,
      complete: args.todayPracticeSessions >= 1,
    },
    {
      id: "save_words",
      label: "Save 3 words",
      current: args.todayWordsSaved,
      target: 3,
      rewardXp: 15,
      complete: args.todayWordsSaved >= 3,
    },
  ];
}

function getLevelBounds(totalXp: number) {
  let level = 1;
  let levelStartXp = 0;
  let levelWidth = 120;

  while (totalXp >= levelStartXp + levelWidth) {
    levelStartXp += levelWidth;
    level += 1;
    levelWidth = 120 + (level - 1) * 30;
  }

  return {
    currentLevel: level,
    levelStartXp,
    nextLevelXp: levelStartXp + levelWidth,
    levelProgress: clamp((totalXp - levelStartXp) / Math.max(1, levelWidth), 0, 1),
  };
}

function getBadgeList(args: BuildGamificationArgs): GamificationBadge[] {
  return [
    {
      id: "first_story",
      label: "First Story",
      description: "Finish your first story",
      unlocked: args.storiesFinished >= 1,
      accent: "#ffd36b",
    },
    {
      id: "week_streak",
      label: "On a Roll",
      description: "Reach a 7-day streak",
      unlocked: args.streakDays >= 7,
      accent: "#ff8a5b",
    },
    {
      id: "word_collector",
      label: "Collector",
      description: "Save 25 words",
      unlocked: args.wordsLearned >= 25,
      accent: "#8ef0c6",
    },
    {
      id: "practice_ten",
      label: "Sharpener",
      description: "Complete 10 practice sessions",
      unlocked: args.practiceSessionsCompleted >= 10,
      accent: "#7dd3fc",
    },
    {
      id: "region_explorer",
      label: "Pathfinder",
      description: "Explore 3 regions",
      unlocked: args.regionsExplored >= 3,
      accent: "#c4b5fd",
    },
  ];
}

export function buildGamificationSummary(args: BuildGamificationArgs): GamificationSummary {
  const totalXp = getXpForTotals({
    minutesListened: args.minutesListened,
    storiesFinished: args.storiesFinished,
    booksFinished: args.booksFinished,
    wordsLearned: args.wordsLearned,
    practiceSessionsCompleted: args.practiceSessionsCompleted,
  });

  const todayXp = getXpForTotals({
    minutesListened: args.todayMinutesListened,
    storiesFinished: args.todayStoriesFinished,
    booksFinished: 0,
    wordsLearned: args.todayWordsSaved,
    practiceSessionsCompleted: args.todayPracticeSessions,
  });

  const weeklyXp = getXpForTotals({
    minutesListened: args.weeklyMinutesListened,
    storiesFinished: args.weeklyStoriesFinished,
    booksFinished: 0,
    wordsLearned: 0,
    practiceSessionsCompleted: args.weeklyPracticeSessions,
  });

  return {
    totalXp,
    todayXp,
    weeklyXp,
    dailyStreak: args.streakDays,
    quests: getQuestList(args),
    badges: getBadgeList(args),
    ...getLevelBounds(totalXp),
  };
}
