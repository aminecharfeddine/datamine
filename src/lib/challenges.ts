import { metricsAt, type Metrics, type Sample } from "./metrics";
import { bayes, ciHalfWidth, errorCurve, ridgeCurve, W_GLOBAL, W_PEAK, type BayesParams, type DistId, type GdPath, type Pt } from "./sims";

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

export type Challenge<S = any> = {
  id: string;
  title: string;
  goal: string;
  hint: string;
  check: (s: S) => boolean;
};

export type BayesState = BayesParams;
export type GdState = { w0: number; lr: number; path: GdPath };
export type CltState = { dist: DistId; n: number; count: number };
export type AbState = { n: number; effect: number; runs: number; significant: number };
export type CiState = { n: number; level: number; count: number; hits: number };
export type RidgeState = { logLambda: number; train: Pt[]; test: Pt[]; trainMse: number; testMse: number };
export type BvState = { degree: number; n: number; noise: number; train: Pt[]; test: Pt[]; trainMse: number; testMse: number };

const bestTestCache = new WeakMap<Pt[], number>();
const bestTest = (train: Pt[], test: Pt[]) => {
  if (!bestTestCache.has(train)) bestTestCache.set(train, Math.min(...errorCurve(train, test).map((e) => e.test)));
  return bestTestCache.get(train)!;
};
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const ridgeBestCache = new WeakMap<Pt[], number>();
const ridgeBest = (train: Pt[], test: Pt[]) => {
  if (!ridgeBestCache.has(train)) ridgeBestCache.set(train, Math.min(...ridgeCurve(train, test).map((e) => e.test)));
  return ridgeBestCache.get(train)!;
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

  // ---------------------------------------------------------------- Bayes
  "ppv-90": {
    id: "ppv-90",
    title: "Un test vraiment fiable",
    goal: "Avec une maladie touchant au plus 1 % de la population, obtiens P(malade | test +) ≥ 0,90.",
    hint: "Avec si peu de malades, les faux positifs viennent des sains : c'est la specificity qu'il faut pousser.",
    check: (s: BayesState) => s.prevalence <= 0.01 + 1e-9 && bayes(s).ppv >= 0.9,
  } satisfies Challenge<BayesState>,
  "ppv-50": {
    id: "ppv-50",
    title: "Pile ou face",
    goal: "Sans toucher au test (sensitivity 0,90, specificity 0,95), trouve la prévalence où un test positif n'est juste qu'une fois sur deux (entre 0,50 et 0,55).",
    hint: "Quand la prévalence augmente, les vrais positifs rattrapent les faux positifs.",
    check: (s: BayesState) =>
      near(s.sensitivity, 0.9) && near(s.specificity, 0.95) && bayes(s).ppv >= 0.5 && bayes(s).ppv <= 0.55,
  } satisfies Challenge<BayesState>,

  // ---------------------------------------------------------------- Descente de gradient
  "gd-converge": {
    id: "gd-converge",
    title: "En 10 pas",
    goal: "Atteins le minimum (à 0,01 près) en 10 pas maximum.",
    hint: "Trop petit : tu rampes. Trop grand : tu rebondis d'un bord à l'autre. Il existe un juste milieu.",
    check: (s: GdState) =>
      !s.path.diverged && s.path.ws.length - 1 <= 10 && Math.abs(s.path.ws[s.path.ws.length - 1] - W_GLOBAL) < 0.01,
  } satisfies Challenge<GdState>,
  "gd-diverge": {
    id: "gd-diverge",
    title: "Explosion",
    goal: "Trouve un learning rate qui fait diverger la descente.",
    hint: "Chaque pas vaut learning rate × pente. Si ce produit dépasse la largeur de la vallée…",
    check: (s: GdState) => s.path.diverged,
  } satisfies Challenge<GdState>,
  "gd-escape": {
    id: "gd-escape",
    title: "L'évasion",
    goal: "Pars de la droite (w₀ ≥ 1,5) et termine dans la vallée de gauche, la plus profonde, après au moins 20 pas.",
    hint: "Avec un petit learning rate, tu tombes dans le premier creux venu. Il faut des pas assez grands pour franchir la bosse.",
    check: (s: GdState) =>
      !s.path.diverged && s.w0 >= 1.5 && s.path.ws.length - 1 >= 20 && s.path.ws[s.path.ws.length - 1] < W_PEAK - 0.3,
  } satisfies Challenge<GdState>,

  // ---------------------------------------------------------------- TCL
  "clt-bell": {
    id: "clt-bell",
    title: "Une cloche à partir de rien",
    goal: "Pars de la distribution exponentielle (très asymétrique) et obtiens au moins 500 moyennes avec n ≥ 30.",
    hint: "Choisis « Exponentielle », règle n, puis tire des échantillons par paquets de 100.",
    check: (s: CltState) => s.dist === "exponentielle" && s.n >= 30 && s.count >= 500,
  } satisfies Challenge<CltState>,
  "clt-sqrt": {
    id: "clt-sqrt",
    title: "Diviser par quatre",
    goal: "Trouve la plus petite taille d'échantillon n qui divise par 4 l'écart-type des moyennes (par rapport à n = 1), puis tire au moins 200 moyennes.",
    hint: "L'écart-type des moyennes vaut σ / √n.",
    check: (s: CltState) => s.n === 16 && s.count >= 200,
  } satisfies Challenge<CltState>,

  // ---------------------------------------------------------------- Bias-variance
  "bv-overfit": {
    id: "bv-overfit",
    title: "Par cœur",
    goal: "Trouve un modèle dont l'erreur d'entraînement est au moins 5 fois plus petite que l'erreur de test.",
    hint: "Un modèle très flexible peut passer par presque tous les points d'entraînement…",
    check: (s: BvState) => s.trainMse * 5 <= s.testMse,
  } satisfies Challenge<BvState>,
  "bv-best": {
    id: "bv-best",
    title: "Le juste degré",
    goal: "Choisis un degré dont l'erreur de test est à moins de 5 % de la meilleure possible.",
    hint: "Regarde le creux de la courbe de test, pas celle d'entraînement.",
    check: (s: BvState) => s.testMse <= bestTest(s.train, s.test) * 1.05,
  } satisfies Challenge<BvState>,
  "bv-data": {
    id: "bv-data",
    title: "Noyer l'overfitting",
    goal: "Garde un degré ≥ 10, mais fais descendre l'erreur de test sous 0,12 en jouant sur la quantité de données.",
    hint: "Un modèle complexe a besoin de beaucoup d'exemples pour ne pas apprendre le bruit.",
    check: (s: BvState) => s.degree >= 10 && s.testMse < 0.12,
  } satisfies Challenge<BvState>,

  // ---------------------------------------------------------------- Tests A/B
  "pv-false": {
    id: "pv-false",
    title: "Des découvertes qui n'existent pas",
    goal: "Sans aucun effet réel (écart réglé sur 0), lance au moins 40 expériences et obtiens au moins un résultat « significatif ».",
    hint: "Avec un seuil à 0,05, environ une expérience sur vingt sort significative par pur hasard.",
    check: (s: AbState) => near(s.effect, 0) && s.runs >= 40 && s.significant >= 1,
  } satisfies Challenge<AbState>,
  "pv-power": {
    id: "pv-power",
    title: "Assez de visiteurs",
    goal: "La version B convertit vraiment 2 points de plus. Trouve une taille d'échantillon qui détecte cet effet dans au moins 80 % de 30 expériences ou plus.",
    hint: "L'écart-type de la différence diminue en 1/√n : il faut plusieurs milliers de visiteurs par groupe.",
    check: (s: AbState) => near(s.effect, 0.02) && s.runs >= 30 && s.significant / s.runs >= 0.8,
  } satisfies Challenge<AbState>,

  // ---------------------------------------------------------------- Intervalles de confiance
  "ci-coverage": {
    id: "ci-coverage",
    title: "Vérifier la promesse",
    goal: "Au niveau 95 %, trace au moins 100 intervalles et compare la part qui contient la vraie moyenne.",
    hint: "Utilise le bouton « +100 sondages ».",
    check: (s: CiState) => near(s.level, 0.95) && s.count >= 100,
  } satisfies Challenge<CiState>,
  "ci-narrow": {
    id: "ci-narrow",
    title: "Précis et sûr",
    goal: "Obtiens des intervalles à 99 % dont la marge est d'au plus ±2, puis trace-en au moins 20.",
    hint: "La marge vaut z × σ / √n : pour la réduire sans baisser le niveau, il faut augmenter n.",
    check: (s: CiState) => near(s.level, 0.99) && ciHalfWidth(s.n, s.level) <= 2 && s.count >= 20,
  } satisfies Challenge<CiState>,

  // ---------------------------------------------------------------- Régularisation
  "ridge-best": {
    id: "ridge-best",
    title: "Dompter le degré 15",
    goal: "Trouve une force de régularisation λ qui donne une erreur de test à moins de 5 % de la meilleure possible.",
    hint: "Cherche le creux de la courbe orange : ni trop peu de régularisation, ni trop.",
    check: (s: RidgeState) => s.testMse <= ridgeBest(s.train, s.test) * 1.05,
  } satisfies Challenge<RidgeState>,
  "ridge-under": {
    id: "ridge-under",
    title: "Trop serré",
    goal: "Régularise tellement que le modèle devient presque plat : erreur d'entraînement supérieure à 0,4.",
    hint: "Pousse λ vers la droite jusqu'au bout.",
    check: (s: RidgeState) => s.trainMse > 0.4,
  } satisfies Challenge<RidgeState>,
};
