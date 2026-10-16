// Règles de gamification : l'XP récompense la maîtrise (prédictions, défis, révisions), pas les clics.

export const XP = {
  predictCorrect: 10,
  predictWrong: 3, // s'engager sur une prédiction, même fausse, est utile
  quizCorrect: 5,
  challenge: 25,
  lessonComplete: 50,
  review: { again: 1, hard: 3, good: 5, easy: 6 },
} as const;

/** XP cumulée nécessaire pour atteindre le niveau n (n ≥ 1). Courbe quadratique douce. */
export const xpForLevel = (n: number) => 50 * (n - 1) * n;

export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, current: xp - floor, needed: ceil - floor, progress: (xp - floor) / (ceil - floor) };
}

export type BadgeStats = {
  lessonsCompleted: number;
  challengesDone: number;
  reviewsDone: number;
  streakBest: number;
  predictionsCorrect: number;
};

export type Badge = { id: string; title: string; description: string; icon: string; earned: (s: BadgeStats) => boolean };

export const BADGES: Badge[] = [
  { id: "first-lesson", title: "Premier pas", description: "Terminer une leçon", icon: "◆", earned: (s) => s.lessonsCompleted >= 1 },
  { id: "first-challenge", title: "Mains dans le cambouis", description: "Réussir un défi", icon: "▲", earned: (s) => s.challengesDone >= 1 },
  { id: "challenges-5", title: "Chasseur de seuils", description: "Réussir 5 défis", icon: "✦", earned: (s) => s.challengesDone >= 5 },
  { id: "oracle", title: "Oracle", description: "10 prédictions correctes", icon: "◉", earned: (s) => s.predictionsCorrect >= 10 },
  { id: "reviews-25", title: "Mémoire longue", description: "25 révisions", icon: "↻", earned: (s) => s.reviewsDone >= 25 },
  { id: "streak-3", title: "Régulier", description: "Série de 3 jours", icon: "≋", earned: (s) => s.streakBest >= 3 },
  { id: "streak-7", title: "Inarrêtable", description: "Série de 7 jours", icon: "☼", earned: (s) => s.streakBest >= 7 },
];

/** Date locale au format YYYY-MM-DD. */
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export type Streak = { current: number; best: number; lastDay: string | null; freezes: number };

/** Met à jour la série quand une activité a lieu `today`. Un « gel » couvre un jour manqué. */
export function touchStreak(s: Streak, today: string): Streak {
  if (s.lastDay === today) return s;
  const gap = s.lastDay ? daysBetween(s.lastDay, today) : Infinity;
  let { current, freezes } = s;
  if (gap === 1) current += 1;
  else if (gap === 2 && freezes > 0) {
    current += 1;
    freezes -= 1;
  } else current = 1;
  // un gel gagné tous les 7 jours de série, 2 max en réserve
  if (current > 0 && current % 7 === 0) freezes = Math.min(2, freezes + 1);
  return { current, best: Math.max(s.best, current), lastDay: today, freezes };
}

/** Série « vivante » à l'affichage (0 si un jour a été manqué sans gel). */
export function displayedStreak(s: Streak, today: string) {
  if (!s.lastDay) return 0;
  const gap = daysBetween(s.lastDay, today);
  if (gap <= 1) return s.current;
  if (gap === 2 && s.freezes > 0) return s.current;
  return 0;
}
