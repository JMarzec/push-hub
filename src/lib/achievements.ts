export type AchievementStats = {
  totalReps: number;
  bestDay: number;
  daysLogged: number;
  targetDays: number;
  currentStreak: number;
  longestStreak: number;
  bankedTotal: number;
  inTeam: boolean;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: "flame" | "trophy" | "medal" | "piggy" | "users" | "zap";
  progress: number;
  goal: number;
};

export function buildAchievements(stats: AchievementStats): Achievement[] {
  const repMilestones = [100, 500, 1_000, 5_000, 10_000];
  const nextRepGoal = repMilestones.find((m) => stats.totalReps < m) ?? repMilestones.at(-1)!;

  return [
    {
      id: "first-rep",
      title: "First rep",
      description: "Log your very first push-up.",
      icon: "zap",
      progress: Math.min(stats.totalReps, 1),
      goal: 1,
    },
    {
      id: "reps-milestone",
      title: `${nextRepGoal.toLocaleString()} club`,
      description: `Total ${nextRepGoal.toLocaleString()} push-ups logged all-time.`,
      icon: "trophy",
      progress: Math.min(stats.totalReps, nextRepGoal),
      goal: nextRepGoal,
    },
    {
      id: "streak-3",
      title: "Three in a row",
      description: "Hit your daily target 3 days running.",
      icon: "flame",
      progress: Math.min(stats.longestStreak, 3),
      goal: 3,
    },
    {
      id: "streak-7",
      title: "Full week",
      description: "Hit your daily target 7 days running.",
      icon: "flame",
      progress: Math.min(stats.longestStreak, 7),
      goal: 7,
    },
    {
      id: "streak-21",
      title: "Challenge complete",
      description: "Hit your daily target 21 days running.",
      icon: "medal",
      progress: Math.min(stats.longestStreak, 21),
      goal: 21,
    },
    {
      id: "target-days-10",
      title: "Ten target days",
      description: "Reach your daily target on 10 separate days.",
      icon: "medal",
      progress: Math.min(stats.targetDays, 10),
      goal: 10,
    },
    {
      id: "century-day",
      title: "Century day",
      description: "Log 100 push-ups in a single day.",
      icon: "trophy",
      progress: Math.min(stats.bestDay, 100),
      goal: 100,
    },
    {
      id: "saver",
      title: "Rainy day saver",
      description: "Bank 100 surplus push-ups for future days.",
      icon: "piggy",
      progress: Math.min(stats.bankedTotal, 100),
      goal: 100,
    },
    {
      id: "squad",
      title: "Better together",
      description: "Join or start a squad with friends.",
      icon: "users",
      progress: stats.inTeam ? 1 : 0,
      goal: 1,
    },
  ];
}
