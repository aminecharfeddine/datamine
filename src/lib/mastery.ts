import { CARDS } from "./cards";

// Niveau de maîtrise d'un concept, dérivé de la progression et de la mémoire mesurée par FSRS.
// Module pur (sans état) pour pouvoir être utilisé par le store, et les succès.

export const MASTERY_LABELS = ["Non vu", "Découvert", "Pratiqué", "Maîtrisé", "Consolidé"] as const;
export type MasteryLevel = 0 | 1 | 2 | 3 | 4;

type MasterySource = {
  discovered: Record<string, true>;
  srs: Record<string, { reps: number; stability: number }>;
};

/**
 * 0 Non vu · 1 Découvert (leçon ouverte) · 2 Pratiqué (cartes dans le deck)
 * 3 Maîtrisé (toutes les cartes révisées, stabilité ≥ 5 j) · 4 Consolidé (stabilité ≥ 21 j)
 */
export function conceptLevel(state: MasterySource, concept: string): MasteryLevel {
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
