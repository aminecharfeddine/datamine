"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";
import { dayKey, levelInfo, touchStreak, XP, type Streak } from "./gamification";
import { newlyEarned } from "./achievements";
import { describeUnlock, unlockedBetweenLevels, unlockedByBadge, type Cosmetic, type Equipped, type Slot } from "./cosmetics";
import { cardsForConcepts } from "./cards";

// Stockage local (mode invité). La phase 2 synchronisera ce même état avec Supabase.

/** Carte FSRS sérialisée. `u` = date de dernière modification (sert à départager deux appareils). */
export type StoredCard = Omit<Card, "due" | "last_review"> & { due: string; last_review?: string; u?: string };

/** Une révision effectuée : carte, note (1 à 4), date. */
export type ReviewLogEntry = { c: string; g: number; t: string };
export const REVIEW_LOG_MAX = 500;

export type Toast = { id: number; text: string; tone: "xp" | "badge" | "info" | "level"; detail?: string };

/** Moment de célébration : petit (défi réussi) ou grand (leçon terminée, niveau, succès). */
export type Celebration = { id: number; size: "small" | "big"; effect?: string };

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
  /** Réponses données dans les leçons (choix d'une prédiction, meilleur score d'un quiz, valeur d'un exercice). */
  answers: Record<string, number>;
  /** Historique chronologique des révisions. */
  reviewLog: ReviewLogEntry[];
  /** Traces d'exploration (labos manipulés, fiches lues, indices affichés…), pour les succès de curiosité et de rigueur. */
  explored: Record<string, true>;
  /** Cosmétiques équipés (u = date du dernier changement, pour la fusion entre appareils). */
  cosmetics: Equipped;
};

export const DATA_KEYS = [
  "xp", "dailyXp", "awarded", "discovered", "completedLessons", "challengesDone",
  "predictionsCorrect", "reviewsDone", "streak", "srs", "badges", "answers", "reviewLog", "explored", "cosmetics",
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
  celebrations: Celebration[];

  award: (key: string | null, amount: number, label: string) => boolean;
  recordPrediction: (key: string, correct: boolean) => void;
  recordQuiz: (key: string, correct: boolean) => void;
  recordExercise: (key: string) => void;
  /** Mémorise une réponse. mode "first" : garde la première ; "max" : garde la meilleure ; "last" : remplace. */
  rememberAnswer: (key: string, value: number, mode?: "first" | "max" | "last") => void;
  /** Remet une carte à réviser tout de suite. */
  requeue: (cardId: string) => void;
  recordChallenge: (key: string) => void;
  markDiscovered: (concepts: string[]) => void;
  completeLesson: (slug: string, concepts: string[]) => void;
  review: (cardId: string, grade: Grade) => void;
  dismissToast: (id: number) => void;
  /** Note une exploration (idempotent). */
  explore: (key: string) => void;
  equip: (slot: Slot, id: string) => void;
  celebrate: (size: Celebration["size"], effect?: string) => void;
  endCelebration: (id: number) => void;
  reset: () => void;
};

/** Délai avant la première révision des cartes d'une leçon terminée. */
export const FIRST_REVIEW_DELAY_MS = 4 * 60 * 60 * 1000;

// Étapes d'apprentissage espacées : 10 min puis 4 h avant de passer en jours (et 10 min après un oubli).
const scheduler = fsrs(generatorParameters({ enable_fuzz: true, learning_steps: ["10m", "4h"], relearning_steps: ["10m"] }));

const serialize = (c: Card, u = new Date()): StoredCard => ({
  due: c.due.toISOString(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state,
  last_review: c.last_review ? c.last_review.toISOString() : undefined,
  u: u.toISOString(),
});
const deserialize = ({ u: _u, ...c }: StoredCard): Card => ({
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
  answers: {},
  reviewLog: [],
  explored: {},
  cosmetics: {},
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
  answers: {} as Record<string, number>,
  reviewLog: [] as ReviewLogEntry[],
  explored: {} as Record<string, true>,
  cosmetics: {} as Equipped,
  toasts: [] as Toast[],
  celebrations: [] as Celebration[],
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => {
      const pushToast = (text: string, tone: Toast["tone"], detail?: string) => {
        const id = ++toastSeq;
        set((s) => ({ toasts: [...s.toasts, { id, text, tone, detail }] }));
        setTimeout(() => get().dismissToast(id), detail ? 5200 : 2600);
      };

      const celebrate = (size: Celebration["size"], effect?: string) => {
        const id = ++toastSeq;
        set((s) => ({ celebrations: [...s.celebrations.slice(-2), { id, size, effect }] }));
        setTimeout(() => get().endCelebration(id), 2200);
      };

      const unlockDetail = (items: Cosmetic[]) =>
        items.length ? `Débloque ${items.map(describeUnlock).join(", ")}.` : undefined;

      const checkBadges = () => {
        const earned = newlyEarned(get());
        if (!earned.length) return;
        const now = new Date().toISOString();
        set((st) => ({ badges: { ...st.badges, ...Object.fromEntries(earned.map((x) => [x.id, now])) } }));
        for (const x of earned) pushToast(`Succès débloqué · ${x.title}`, "badge", unlockDetail(unlockedByBadge(x.id)));
        celebrate("big");
      };

      return {
        ...initial,

        award: (key, amount, label) => {
          if (key && get().awarded[key]) return false;
          const today = dayKey();
          const levelBefore = levelInfo(get().xp).level;
          // Moment de la journée (succès secrets « Noctambule » et « Lève-tôt »).
          const hour = new Date().getHours();
          if (hour < 5) get().explore("time:night");
          else if (hour < 7) get().explore("time:early");
          set((s) => ({
            xp: s.xp + amount,
            dailyXp: { ...s.dailyXp, [today]: (s.dailyXp[today] ?? 0) + amount },
            awarded: key ? { ...s.awarded, [key]: true } : s.awarded,
            streak: touchStreak(s.streak, today),
          }));
          pushToast(`+${amount} XP · ${label}`, "xp");
          const levelAfter = levelInfo(get().xp).level;
          if (levelAfter > levelBefore) {
            pushToast(`Niveau ${levelAfter} atteint`, "level", unlockDetail(unlockedBetweenLevels(levelBefore, levelAfter)));
            celebrate("big");
          }
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

        rememberAnswer: (key, value, mode = "last") =>
          set((s) => {
            const prev = s.answers[key];
            if (prev !== undefined && (mode === "first" || (mode === "max" && prev >= value) || prev === value)) return s;
            return { answers: { ...s.answers, [key]: value } };
          }),

        requeue: (cardId) =>
          set((s) => {
            const c = s.srs[cardId];
            if (!c) return s;
            const now = new Date().toISOString();
            return { srs: { ...s.srs, [cardId]: { ...c, due: now, u: now } } };
          }),

        recordQuiz: (key, correct) => {
          if (!correct || get().awarded[key]) return;
          get().award(key, XP.quizCorrect, "Bonne réponse");
        },

        recordChallenge: (key) => {
          if (get().awarded[key]) return;
          set((s) => ({ challengesDone: s.challengesDone + 1 }));
          celebrate("small");
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
          if (firstTime) {
            pushToast("Fiche récap débloquée", "info");
            celebrate("big");
          }
          checkBadges();
        },

        review: (cardId, grade) => {
          const stored = get().srs[cardId];
          if (!stored) return;
          const now = new Date();
          const { card } = scheduler.next(deserialize(stored), now, grade);
          set((s) => ({
            srs: { ...s.srs, [cardId]: serialize(card, now) },
            reviewsDone: s.reviewsDone + 1,
            reviewLog: [...s.reviewLog, { c: cardId, g: grade, t: now.toISOString() }].slice(-REVIEW_LOG_MAX),
          }));
          const amount =
            grade === Rating.Again ? XP.review.again
            : grade === Rating.Hard ? XP.review.hard
            : grade === Rating.Good ? XP.review.good
            : XP.review.easy;
          get().award(null, amount, "Révision");
        },

        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        explore: (key) => {
          if (get().explored[key]) return;
          set((s) => ({ explored: { ...s.explored, [key]: true } }));
          checkBadges();
        },

        equip: (slot, id) => set((s) => ({ cosmetics: { ...s.cosmetics, [slot]: id, u: new Date().toISOString() } })),

        celebrate,

        endCelebration: (id) => set((s) => ({ celebrations: s.celebrations.filter((c) => c.id !== id) })),

        setData: (data, ownerId) => set({ ...EMPTY_DATA, ...data, ownerId }),

        reset: () => set({ ...initial }),
      };
    },
    {
      name: "datamine-progress-v1",
      version: 1,
      partialize: ({ toasts, celebrations, ...rest }) => rest,
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

export { MASTERY_LABELS, conceptLevel } from "./mastery";

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
