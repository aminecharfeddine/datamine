import { metricsAt, type Metrics, type Sample } from "./metrics";

// Défis de manipulation : validés automatiquement à partir de l'état de la viz.
// Définis côté client (les fonctions ne peuvent pas transiter depuis un MDX serveur).

export type LabState = {
  data: Sample[];
  threshold: number;
  separation: number;
  prevalence: number;
  metrics: Metrics;
  rocAuc: number;
};

export type Challenge = {
  id: string;
  title: string;
  goal: string;
  hint: string;
  check: (s: LabState) => boolean;
};

function maxF1(data: Sample[]) {
  let best = 0;
  for (let t = 0; t <= 1; t += 0.005) best = Math.max(best, metricsAt(data, t).f1);
  return best;
}

const f1Cache = new WeakMap<Sample[], number>();
const cachedMaxF1 = (d: Sample[]) => {
  if (!f1Cache.has(d)) f1Cache.set(d, maxF1(d));
  return f1Cache.get(d)!;
};

export const CHALLENGES: Record<string, Challenge> = {
  "recall-90": {
    id: "recall-90",
    title: "Le dépistage",
    goal: "Trouve un seuil avec un recall ≥ 0,90 tout en gardant une precision ≥ 0,70.",
    hint: "Commence très bas puis remonte doucement : le recall ne fait que baisser quand le seuil monte.",
    check: ({ metrics: m }) => m.recall >= 0.9 && m.precision >= 0.7,
  },
  "zero-fp": {
    id: "zero-fp",
    title: "Zéro fausse alerte",
    goal: "Obtiens FP = 0 en conservant un recall ≥ 0,25.",
    hint: "Les négatifs avec les scores les plus hauts sont les derniers à basculer.",
    check: ({ metrics: m }) => m.fp === 0 && m.recall >= 0.25,
  },
  "best-f1": {
    id: "best-f1",
    title: "Le meilleur compromis",
    goal: "Approche le F1 maximal possible pour ce modèle (à 0,01 près).",
    hint: "Le F1 est maximal quand ni la precision ni le recall ne s'effondrent : regarde les deux barres.",
    check: ({ data, metrics }) => metrics.f1 >= cachedMaxF1(data) - 0.01,
  },
  "random-model": {
    id: "random-model",
    title: "Le modèle au hasard",
    goal: "Règle la séparation pour obtenir une AUC ROC entre 0,45 et 0,55.",
    hint: "Une AUC de 0,5, c'est un modèle qui classe les exemples comme une pièce de monnaie.",
    check: ({ rocAuc }) => rocAuc >= 0.45 && rocAuc <= 0.55,
  },
  "imbalance-trap": {
    id: "imbalance-trap",
    title: "Le piège du déséquilibre",
    goal: "Garde une AUC ROC ≥ 0,90 mais fais tomber la precision sous 0,40 avec un recall ≥ 0,60.",
    hint: "Ne touche pas à la séparation : joue sur la prévalence, puis cherche le seuil.",
    check: ({ rocAuc, metrics: m }) => rocAuc >= 0.9 && m.precision < 0.4 && m.recall >= 0.6,
  },
};
