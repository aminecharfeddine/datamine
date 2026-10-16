"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";
import { BADGES, dayKey, touchStreak, XP, type BadgeStats, type Streak } from "./gamification";
import { cardsForConcepts, CARDS } from "./cards";

// Stockage local (mode invité). La phase 2 synchronisera ce même état avec Supabase.

export type StoredCard = Omit<Card, "due" | "last_review"> & { due: string; last_review?: string };

export type Toast = { id: number; text: string; tone: "xp" | "badge" | "info" };

/** Données de progression sérialisables (ce qui est stocké localement et dans Supabase). */
export type ProgressData = {
  xp: number;
  dailyXp: Record<string, number>;
  awarded: Record<string, true>;
  discovered: Record<string, true>;
  completedLessons: Record<string, string>;
  challengesDone: number;
  predictionsCorrect: number;
  reviewsDone: number;
  streak: Streak;
  srs: Record<string, StoredCard>;
  badges: Record<string, string>;
};

export const DATA_KEYS = [
  "xp", "dailyXp", "awarded", "discovered", "completedLessons", "challengesDone",
  "predictionsCorrect", "reviewsDone", "streak", "srs", "badges",
] as const satisfies readonly (keyof ProgressData)[];

export function pickData(s: ProgressData): ProgressData {
  const out = {} as Record<string, unknown>;
  for (const k of DATA_KEYS) out[k] = s[k];
  return out as ProgressData;
}

type ProgressState = ProgressData & {
  /** Compte auquel appartient l'état local (null = mode invité). */
  ownerId: string | null;
  setData: (data: ProgressData, ownerId: string | null) => void;
  xp: number;
  dailyXp: Record<string, number>;
  awarded: Record<string, true>;
  discovered: Record<string, true>;
  completedLessons: Record<string, string>;
  challengesDone: number;
  predictionsCorrect: number;
  reviewsDone: number;
  streak: Streak;
  srs: Record<string, StoredCard>;
  badges: Record<string, string>;
  toasts: Toast[];

  award: (key: string | null, amount: number, label: string) => boolean;
  recordPrediction: (key: string, correct: boolean) => void;
  recordQuiz: (key: string, correct: boolean) => void;
  recordExercise: (key: string) => void;
  recordChallenge: (key: string) => void;
  markDiscovered: (concepts: string[]) => void;
  completeLesson: (slug: string, concepts: string[]) => void;
  review: (cardId: string, grade: Grade) => void;
  dismissToast: (id: number) => void;
  reset: () => void;
};

/** Délai avant la première révision des cartes d'une leçon terminée. */
export const FIRST_REVIEW_DELAY_MS = 4 * 60 * 60 * 1000;

// Étapes d'apprentissage espacées : 10 min puis 4 h avant de passer en jours (et 10 min après un oubli).
const scheduler = fsrs(generatorParameters({ enable_fuzz: true, learning_steps: ["10m", "4h"], relearning_steps: ["10m"] }));

const serialize = (c: Card): StoredCard => ({
  ...c,
  due: c.due.toISOString(),
  last_review: c.last_review ? c.last_review.toISOString() : undefined,
});
const deserialize = (c: StoredCard): Card => ({
  ...c,
  due: new Date(c.due),
  last_review: c.last_review ? new Date(c.last_review) : undefined,
});

let toastSeq = 0;

export const EMPTY_DATA: ProgressData = {
  xp: 0,
  dailyXp: {},
  awarded: {},
  discovered: {},
  completedLessons: {},
  challengesDone: 0,
  predictionsCorrect: 0,
  reviewsDone: 0,
  streak: { current: 0, best: 0, lastDay: null, freezes: 1 },
  srs: {},
  badges: {},
};

const initial = {
  ownerId: null as string | null,
  xp: 0,
  dailyXp: {},
  awarded: {},
  discovered: {},
  completedLessons: {},
  challengesDone: 0,
  predictionsCorrect: 0,
  reviewsDone: 0,
  streak: { current: 0, best: 0, lastDay: null, freezes: 1 } as Streak,
  srs: {},
  badges: {},
  toasts: [] as Toast[],
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => {
      const pushToast = (text: string, tone: Toast["tone"]) => {
        const id = ++toastSeq;
        set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
        setTimeout(() => get().dismissToast(id), 2600);
      };

      const checkBadges = () => {
        const s = get();
        const stats: BadgeStats = {
          lessonsCompleted: Object.keys(s.completedLessons).length,
          challengesDone: s.challengesDone,
          reviewsDone: s.reviewsDone,
          streakBest: s.streak.best,
          predictionsCorrect: s.predictionsCorrect,
        };
        for (const b of BADGES) {
          if (!s.badges[b.id] && b.earned(stats)) {
            set((st) => ({ badges: { ...st.badges, [b.id]: new Date().toISOString() } }));
            pushToast(`Badge débloqué · ${b.icon} ${b.title}`, "badge");
          }
        }
      };

      return {
        ...initial,

        award: (key, amount, label) => {
          if (key && get().awarded[key]) return false;
          const today = dayKey();
          set((s) => ({
            xp: s.xp + amount,
            dailyXp: { ...s.dailyXp, [today]: (s.dailyXp[today] ?? 0) + amount },
            awarded: key ? { ...s.awarded, [key]: true } : s.awarded,
            streak: touchStreak(s.streak, today),
          }));
          pushToast(`+${amount} XP · ${label}`, "xp");
          checkBadges();
          return true;
        },

        recordPrediction: (key, correct) => {
          if (get().awarded[key]) return;
          if (correct) set((s) => ({ predictionsCorrect: s.predictionsCorrect + 1 }));
          get().award(key, correct ? XP.predictCorrect : XP.predictWrong, correct ? "Bonne prédiction" : "Prédiction");
        },

        recordExercise: (key) => {
          if (get().awarded[key]) return;
          get().award(key, XP.exercise, "Exercice réussi");
        },

        recordQuiz: (key, correct) => {
          if (!correct || get().awarded[key]) return;
          get().award(key, XP.quizCorrect, "Bonne réponse");
        },

        recordChallenge: (key) => {
          if (get().awarded[key]) return;
          set((s) => ({ challengesDone: s.challengesDone + 1 }));
          get().award(key, XP.challenge, "Défi réussi");
        },

        markDiscovered: (concepts) =>
          set((s) => {
            if (concepts.every((c) => s.discovered[c])) return s;
            const d = { ...s.discovered };
            concepts.forEach((c) => (d[c] = true));
            return { discovered: d };
          }),

        completeLesson: (slug, concepts) => {
          const s = get();
          const srs = { ...s.srs };
          const now = new Date();
          // Première révision quelques heures après la leçon : la revoir juste après n'apporte rien.
          const firstReview = new Date(now.getTime() + FIRST_REVIEW_DELAY_MS);
          for (const card of cardsForConcepts(concepts)) {
            if (!srs[card.id]) srs[card.id] = serialize({ ...createEmptyCard(now), due: firstReview });
          }
          set({
            srs,
            completedLessons: s.completedLessons[slug]
              ? s.completedLessons
              : { ...s.completedLessons, [slug]: now.toISOString() },
          });
          const firstTime = !s.completedLessons[slug];
          get().award(`lesson:${slug}`, XP.lessonComplete, "Leçon terminée");
          if (firstTime) pushToast("Fiche récap débloquée", "info");
          checkBadges();
        },

        review: (cardId, grade) => {
          const stored = get().srs[cardId];
          if (!stored) return;
          const { card } = scheduler.next(deserialize(stored), new Date(), grade);
          set((s) => ({ srs: { ...s.srs, [cardId]: serialize(card) }, reviewsDone: s.reviewsDone + 1 }));
          const amount =
            grade === Rating.Again ? XP.review.again
            : grade === Rating.Hard ? XP.review.hard
            : grade === Rating.Good ? XP.review.good
            : XP.review.easy;
          get().award(null, amount, "Révision");
        },

        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        setData: (data, ownerId) => set({ ...EMPTY_DATA, ...data, ownerId }),

        reset: () => set({ ...initial }),
      };
    },
    {
      name: "datamine-progress-v1",
      version: 1,
      partialize: ({ toasts, ...rest }) => rest,
    },
  ),
);

// ---------- Sélecteurs dérivés ----------

export function dueCardIds(srs: Record<string, StoredCard>, now = new Date()) {
  return Object.entries(srs)
    .filter(([, c]) => new Date(c.due) <= now)
    .sort(([, a], [, b]) => +new Date(a.due) - +new Date(b.due))
    .map(([id]) => id);
}

export const MASTERY_LABELS = ["Non vu", "Découvert", "Pratiqué", "Maîtrisé", "Consolidé"] as const;

/** Niveau de maîtrise 0-4 d'un concept, dérivé de la progression et de la stabilité FSRS. */
export function conceptLevel(
  state: Pick<ProgressState, "discovered" | "srs">,
  concept: string,
): 0 | 1 | 2 | 3 | 4 {
  const cards = CARDS.filter((c) => c.concept === concept);
  const stored = cards.map((c) => state.srs[c.id]).filter(Boolean);
  if (stored.length > 0 && stored.length === cards.length) {
    const reviewed = stored.every((c) => c.reps > 0);
    const minStab = Math.min(...stored.map((c) => c.stability));
    if (reviewed && minStab >= 21) return 4;
    if (reviewed && minStab >= 5) return 3;
    return 2;
  }
  return state.discovered[concept] ? 1 : 0;
}

/** Date de prochaine révision pour chaque note possible (affichée sur les boutons). */
export function previewDue(stored: StoredCard, now = new Date()) {
  const preview = scheduler.repeat(deserialize(stored), now);
  return {
    [Rating.Again]: preview[Rating.Again].card.due,
    [Rating.Hard]: preview[Rating.Hard].card.due,
    [Rating.Good]: preview[Rating.Good].card.due,
    [Rating.Easy]: preview[Rating.Easy].card.due,
  } as Record<Grade, Date>;
}

export function humanDelay(due: Date, now = new Date()) {
  const min = Math.round((+due - +now) / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} j`;
  if (d < 30) return `${Math.round(d / 7)} sem.`;
  if (d < 365) return `${Math.round(d / 30)} mois`;
  return `${Math.round(d / 365)} an${d >= 730 ? "s" : ""}`;
}
