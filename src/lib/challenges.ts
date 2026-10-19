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
export type CvState = { degree: number; k: number; cv: number[] };
export type LeakState = { leakyAcc: number | null; cleanAcc: number | null };
export type KnnState = { k: number; scaled: boolean; testAcc: number; bestAcc: number };
export type TreeState = { depth: number; trainAcc: number; testAcc: number; bestAcc: number };
export type LogitState = { w: number; x0: number; loss: number; bestLoss: number };
export type LogRegState = { degree: number; testAcc: number; linearAcc: number };
export type ForestState = { trees: number; testAcc: number; singleAcc: number };
export type BoostState = { lr: number; rounds: number; trainAcc: number; testAcc: number; bestAcc: number };
export type KMeansState = { k: number; mode: "random" | "pp"; converged: boolean; inertia: number; best: number };
export type NnState = { H: number; act: string; trained: boolean; testAcc: number };
export type BackpropState = { loss: number; updates: number };
export type MysteryState = { guessed: boolean };
export type BpeState = { merges: number; ratio: number; words: number; tokens: number; allMerges: boolean };
export type AttnState = { weight: number };
export type PandasState = { categorie: string; minMontant: number; group: string; agg: string; sortDesc: boolean };
export type BroadcastState = { a: string; b: string; ok: boolean };
export type PipeState = { impute: string; scale: string; ville: string; model: string; acc: number };
export type FeatState = { split: string; valR2: number };
export type SqlState = { match: boolean };
export type DriftState = { retrains: number; minAcc: number };
export type ArchState = { total: number; usedPreset: boolean };
export type LoraState = { r: number; err: number; minR: number };
export type SamplingState = { T: number; topK: number; kept: number };
export type InfState = { model: string; ctx: number; fits: boolean; gpu: string };
export type RagState = { recall: number; avgTokens: number };
export type RegState = { valLoss: number };
export type ConvState = { custom: boolean; vertical: number; horizontal: number; diagonal: number };
export type TransferState = { mode: string; n: number; acc: number };
export type EmbState = { a: string; b: string; c: string; top: string; expected: string | null };
export type RnnState = { model: string; T: number; grad: number };
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

  // ---------------------------------------------------------------- Validation croisée
  "cv-select": {
    id: "cv-select",
    title: "Laisser la validation choisir",
    goal: "Règle le degré sur celui qui minimise l'erreur de validation croisée.",
    hint: "Cherche le point le plus bas de la courbe colorée : c'est le seul critère que tu as le droit d'utiliser.",
    check: (s: CvState) => s.degree === s.cv.indexOf(Math.min(...s.cv)),
  } satisfies Challenge<CvState>,
  "leak-illusion": {
    id: "leak-illusion",
    title: "L'illusion",
    goal: "Obtiens une précision d'au moins 75 % en sélectionnant les variables sur tout le dataset, puis relance avec la sélection dans chaque pli pour voir la vraie performance (65 % ou moins).",
    hint: "Les deux modes se choisissent au-dessus du bouton. Si la version honnête dépasse 65 % par chance, tire un nouveau jeu de données.",
    check: (s: LeakState) => s.leakyAcc !== null && s.leakyAcc >= 0.75 && s.cleanAcc !== null && s.cleanAcc <= 0.65,
  } satisfies Challenge<LeakState>,

  // ---------------------------------------------------------------- k-NN
  "knn-best": {
    id: "knn-best",
    title: "Le bon nombre de voisins",
    goal: "Trouve un k dont la précision de test est au plus à 0,5 point de la meilleure possible.",
    hint: "k = 1 colle au bruit, k = 149 fait voter presque tout le monde. La réponse est entre les deux.",
    check: (s: KnnState) => !s.scaled && s.testAcc >= s.bestAcc - 0.005,
  } satisfies Challenge<KnnState>,
  "knn-scale": {
    id: "knn-scale",
    title: "Unités piégées",
    goal: "Active « y mesuré en centimètres » et constate une chute d'au moins 5 points de précision par rapport au meilleur modèle.",
    hint: "Quand une variable a des valeurs 20 fois plus grandes, elle écrase l'autre dans le calcul des distances.",
    check: (s: KnnState) => s.scaled && s.testAcc <= s.bestAcc - 0.05,
  } satisfies Challenge<KnnState>,

  // ---------------------------------------------------------------- Arbres
  "tree-memorize": {
    id: "tree-memorize",
    title: "Par cœur, version arbre",
    goal: "Fais pousser l'arbre jusqu'à classer parfaitement les données d'entraînement (100 %).",
    hint: "Augmente la profondeur maximale : chaque niveau découpe les rectangles en plus petits.",
    check: (s: TreeState) => s.trainAcc >= 0.9999,
  } satisfies Challenge<TreeState>,
  "tree-best": {
    id: "tree-best",
    title: "Élaguer juste",
    goal: "Trouve la profondeur qui donne la meilleure précision de test (à 0,5 point près).",
    hint: "Regarde où la courbe de test atteint son sommet, pas celle d'entraînement.",
    check: (s: TreeState) => s.testAcc >= s.bestAcc - 0.005,
  } satisfies Challenge<TreeState>,
  // ---------------------------------------------------------------- Régression logistique
  "logit-fit": {
    id: "logit-fit",
    title: "La bonne sigmoïde",
    goal: "Règle la pente et le point de bascule pour amener la log-loss à moins de 0,005 de son minimum.",
    hint: "Place d'abord le point de bascule là où les échecs laissent place aux réussites, puis ajuste la pente : trop raide, les quelques surprises coûtent très cher.",
    check: (s: LogitState) => s.loss <= s.bestLoss + 0.005,
  } satisfies Challenge<LogitState>,
  "logit-poly": {
    id: "logit-poly",
    title: "Courber une droite",
    goal: "Gagne au moins 3 points de précision de test par rapport au modèle linéaire, sans changer de modèle.",
    hint: "La frontière d'une régression logistique est linéaire… dans l'espace des variables qu'on lui donne. Donne-lui des variables plus riches.",
    check: (s: LogRegState) => s.testAcc >= s.linearAcc + 0.03,
  } satisfies Challenge<LogRegState>,

  // ---------------------------------------------------------------- Ensembles
  "forest-gain": {
    id: "forest-gain",
    title: "La sagesse des arbres",
    goal: "Fais mieux d'au moins 5 points de précision de test qu'un arbre seul, sans limiter la profondeur.",
    hint: "Chaque arbre seul overfitte à sa façon. Combien d'avis faut-il pour que les erreurs se compensent ?",
    check: (s: ForestState) => s.testAcc >= s.singleAcc + 0.05,
  } satisfies Challenge<ForestState>,
  "boost-best": {
    id: "boost-best",
    title: "Savoir s'arrêter",
    goal: "Trouve un taux d'apprentissage et un nombre d'itérations dont la précision de test est à 0,5 point de la meilleure possible.",
    hint: "Avec un taux élevé, le sommet arrive très tôt puis le modèle apprend le bruit. Avec un petit taux, il faut plus d'itérations.",
    check: (s: BoostState) => s.testAcc >= s.bestAcc - 0.005,
  } satisfies Challenge<BoostState>,

  // ---------------------------------------------------------------- k-means
  "kmeans-local": {
    id: "kmeans-local",
    title: "Coincé dans un creux",
    goal: "Avec k = 4 et l'initialisation aléatoire, fais converger l'algorithme vers une solution au moins 25 % moins bonne que la meilleure (inertie).",
    hint: "Tire de nouvelles initialisations jusqu'à ce que deux centres démarrent dans le même groupe, puis lance la convergence.",
    check: (s: KMeansState) => s.k === 4 && s.mode === "random" && s.converged && s.inertia >= s.best * 1.25,
  } satisfies Challenge<KMeansState>,
  "kmeans-elbow": {
    id: "kmeans-elbow",
    title: "Le coude",
    goal: "Choisis le k indiqué par le coude de la courbe, puis converge vers la meilleure solution (inertie à 1 % du minimum).",
    hint: "Le coude est le dernier k qui fait vraiment baisser l'inertie. k-means++ évite la plupart des mauvais départs.",
    check: (s: KMeansState) => s.k === 4 && s.converged && s.inertia <= s.best * 1.01,
  } satisfies Challenge<KMeansState>,
  // ---------------------------------------------------------------- Deep learning
  "nn-collapse": {
    id: "nn-collapse",
    title: "L'empilement inutile",
    goal: "Avec l'activation linéaire, entraîne un réseau d'au moins 16 neurones et constate qu'il ne fait pas mieux que le hasard (moins de 60 %).",
    hint: "Choisis « linéaire », pousse le nombre de neurones, puis lance l'entraînement jusqu'au bout.",
    check: (s: NnState) => s.act === "linear" && s.H >= 16 && s.trained && s.testAcc < 0.6,
  } satisfies Challenge<NnState>,
  "nn-minimal": {
    id: "nn-minimal",
    title: "Le plus petit réseau",
    goal: "Atteins au moins 95 % de précision de test avec 3 neurones cachés ou moins.",
    hint: "Combien de droites faut-il au minimum pour enfermer le disque central ? Essaie aussi les deux activations non linéaires.",
    check: (s: NnState) => s.trained && s.H <= 3 && s.act !== "linear" && s.testAcc >= 0.95,
  } satisfies Challenge<NnState>,
  "bp-descend": {
    id: "bp-descend",
    title: "Trois gestes",
    goal: "Fais descendre la loss sous 0,05 en au plus 10 mises à jour, en enchaînant forward, backward et step.",
    hint: "Le gradient indique la direction ; le learning rate, la longueur du pas. Avec un pas trop petit, 10 mises à jour ne suffiront pas.",
    check: (s: BackpropState) => s.loss <= 0.05 && s.updates <= 10,
  } satisfies Challenge<BackpropState>,
  "loop-mystery": {
    id: "loop-mystery",
    title: "La courbe mystère",
    goal: "Identifie le bug caché derrière la courbe de loss mystère.",
    hint: "Compare-la aux courbes de chaque bug ci-dessus : pics qui s'amplifient, plateau, dents de scie ou chaos initial ?",
    check: (s: MysteryState) => s.guessed,
  } satisfies Challenge<MysteryState>,

  // ---------------------------------------------------------------- LLM
  "bpe-compress": {
    id: "bpe-compress",
    title: "Compresser le texte",
    goal: "Atteins en moyenne 2,5 caractères par token sur le corpus, avec 150 fusions au plus.",
    hint: "Chaque fusion crée un token plus long ; les premières sont les plus rentables.",
    check: (s: BpeState) => s.merges <= 150 && s.ratio >= 2.5,
  } satisfies Challenge<BpeState>,
  "bpe-rare": {
    id: "bpe-rare",
    title: "Le mot qui coûte cher",
    goal: "Avec toutes les fusions, tape un seul mot qui se découpe en au moins 8 tokens.",
    hint: "Un mot long, rare, absent du corpus. Le plus long mot du dictionnaire français fera l'affaire.",
    check: (s: BpeState) => s.allMerges && s.words === 1 && s.tokens >= 8,
  } satisfies Challenge<BpeState>,
  "attn-focus": {
    id: "attn-focus",
    title: "À qui renvoie « il » ?",
    goal: "Oriente la query de « il » pour qu'au moins 80 % de son attention se porte sur « chat ».",
    hint: "La direction choisit vers quelle clé regarder ; la norme rend le softmax plus ou moins tranché.",
    check: (s: AttnState) => s.weight >= 0.8,
  } satisfies Challenge<AttnState>,
  // ---------------------------------------------------------------- ML en pratique
  "pandas-mean": {
    id: "pandas-mean",
    title: "La question du manager",
    goal: "Affiche le panier moyen par ville pour la catégorie Tech, du plus élevé au plus faible.",
    hint: "Filtre d'abord sur la catégorie, puis groupe par ville et choisis l'agrégation qui donne une moyenne.",
    check: (s: PandasState) => s.categorie === "Tech" && s.minMontant === 0 && s.group === "ville" && s.agg === "mean" && s.sortDesc,
  } satisfies Challenge<PandasState>,
  "broadcast-error": {
    id: "broadcast-error",
    title: "Le piège de l'axe",
    goal: "Trouve un tableau B qui ne peut pas être soustrait à X de forme (4, 3).",
    hint: "NumPy aligne les formes par la droite. Que donne X.mean(axis=1) ?",
    check: (s: BroadcastState) => s.a === "4,3" && !s.ok,
  } satisfies Challenge<BroadcastState>,
  "pipe-best": {
    id: "pipe-best",
    title: "Le pipeline de production",
    goal: "Atteins au moins 76 % de précision en validation croisée sans supprimer de lignes.",
    hint: "La ville n'est pas un nombre ordonné, et certains modèles sont très sensibles à l'échelle des variables.",
    check: (s: PipeState) => s.impute !== "drop" && s.acc >= 0.76,
  } satisfies Challenge<PipeState>,
  "feat-r2": {
    id: "feat-r2",
    title: "Les bonnes variables",
    goal: "Avec un découpage temporel, atteins un R² de validation d'au moins 0,95.",
    hint: "Regarde la courbe : des pics réguliers, et des ventes qui baissent quand il fait trop chaud ou trop froid.",
    check: (s: FeatState) => s.split === "temporel" && s.valR2 >= 0.95,
  } satisfies Challenge<FeatState>,
  "sql-filter": {
    id: "sql-filter",
    title: "Les grosses commandes",
    goal: "Liste l'id, la date et le montant des commandes Tech de plus de 100 €, de la plus chère à la moins chère.",
    hint: "WHERE avec deux conditions reliées par AND, puis ORDER BY … DESC.",
    check: (s: SqlState) => s.match,
  } satisfies Challenge<SqlState>,
  "sql-group": {
    id: "sql-group",
    title: "Les catégories qui comptent",
    goal: "Pour chaque catégorie ayant au moins 15 commandes, donne le nombre de commandes et le chiffre d'affaires total (arrondi à 2 décimales).",
    hint: "GROUP BY categorie ; un filtre sur un agrégat va dans HAVING, pas dans WHERE.",
    check: (s: SqlState) => s.match,
  } satisfies Challenge<SqlState>,
  "sql-join": {
    id: "sql-join",
    title: "Tous les clients",
    goal: "Pour chaque client (même sans commande), donne son prénom et son nombre de commandes, du plus grand au plus petit puis par prénom.",
    hint: "Un INNER JOIN ferait disparaître les clients sans commande. COUNT(une colonne de commandes) compte 0 pour eux.",
    check: (s: SqlState) => s.match,
  } satisfies Challenge<SqlState>,
  "sql-window": {
    id: "sql-window",
    title: "La plus grosse commande de chaque ville",
    goal: "Pour chaque ville, donne la commande au montant le plus élevé : ville, id de la commande, montant.",
    hint: "ROW_NUMBER() OVER (PARTITION BY … ORDER BY … DESC) dans une sous-requête, puis ne garde que le rang 1.",
    check: (s: SqlState) => s.match,
  } satisfies Challenge<SqlState>,
  "drift-keep": {
    id: "drift-keep",
    title: "Tenir l'année",
    goal: "Garde une précision d'au moins 70 % chaque mois pendant un an, avec au plus 4 réentraînements.",
    hint: "Un modèle réentraîné apprend sur le mois précédent : il est déjà un peu en retard. Combien de mois tient-il au-dessus de 70 % ? Espace les réentraînements régulièrement, sans attendre la chute.",
    check: (s: DriftState) => s.retrains <= 4 && s.minAcc >= 0.7,
  } satisfies Challenge<DriftState>,
  // ---------------------------------------------------------------- LLM (suite)
  "tf-gpt2": {
    id: "tf-gpt2",
    title: "Recompter GPT-2",
    goal: "Règle l'architecture de GPT-2 small (12 blocs, d = 768, vocabulaire de 50 257, contexte 1 024, positions apprises, MLP GELU 4d, embeddings partagés) et retrouve ses 124 millions de paramètres.",
    hint: "Pars de zéro sans préréglage. Les embeddings partagés évitent de compter deux fois la matrice du vocabulaire.",
    check: (s: ArchState) => !s.usedPreset && Math.abs(s.total - 124.44e6) < 0.5e6,
  } satisfies Challenge<ArchState>,
  "lora-rank": {
    id: "lora-rank",
    title: "Le bon rang",
    goal: "Trouve le plus petit rang r qui reconstruit la mise à jour ΔW avec moins de 5 % d'erreur.",
    hint: "Regarde les valeurs singulières : à partir de quand deviennent-elles négligeables ?",
    check: (s: LoraState) => s.r === s.minR,
  } satisfies Challenge<LoraState>,
  "samp-topp": {
    id: "samp-topp",
    title: "Le noyau",
    goal: "Sans top-k et à température 1, règle top-p pour que seuls 3 mots restent possibles.",
    hint: "top-p garde les mots les plus probables jusqu'à ce que leur probabilité cumulée atteigne p.",
    check: (s: SamplingState) => s.topK === 0 && Math.abs(s.T - 1) < 1e-9 && s.kept === 3,
  } satisfies Challenge<SamplingState>,
  "inf-fit": {
    id: "inf-fit",
    title: "70 milliards sur un GPU",
    goal: "Fais tenir le modèle 70B avec au moins 32 000 tokens de contexte sur un seul GPU de 80 Go.",
    hint: "Deux leviers : la précision des poids, et le nombre de têtes de key/value qui détermine la taille du KV cache.",
    check: (s: InfState) => s.model === "70B" && s.ctx >= 32000 && s.gpu === "80 Go" && s.fits,
  } satisfies Challenge<InfState>,
  "rag-recall": {
    id: "rag-recall",
    title: "Tout retrouver, sans noyer le modèle",
    goal: "Retrouve le passage qui répond aux 4 questions (rappel 100 %) avec un contexte moyen de 60 tokens au plus.",
    hint: "Les gros morceaux coûtent cher, les tout petits se font battre par des phrases courtes. Et une question mal formulée rate les bons mots.",
    check: (s: RagState) => s.recall === 1 && s.avgTokens <= 60,
  } satisfies Challenge<RagState>,
  // ---------------------------------------------------------------- Deep learning (suite)
  "reg-val": {
    id: "reg-val",
    title: "Dompter le sur-apprentissage",
    goal: "Le réseau de 64 neurones apprend 60 points par cœur. Ramène la loss de validation du modèle retenu sous 0,35.",
    hint: "Trois leviers : éteindre des neurones au hasard, rétrécir les poids, ou simplement s'arrêter au bon moment.",
    check: (s: RegState) => s.valLoss <= 0.35,
  } satisfies Challenge<RegState>,
  "cnn-diag": {
    id: "cnn-diag",
    title: "Un détecteur de diagonales",
    goal: "Compose ton propre filtre qui réagit au moins deux fois plus à la diagonale qu'à la barre verticale et à la barre horizontale.",
    hint: "Un filtre ressemble à ce qu'il détecte : des valeurs positives le long de la forme cherchée, négatives autour.",
    check: (s: ConvState) => s.custom && s.diagonal >= 2 * Math.max(s.vertical, s.horizontal) && s.diagonal > 0,
  } satisfies Challenge<ConvState>,
  "transfer-8": {
    id: "transfer-8",
    title: "Huit exemples suffisent",
    goal: "Avec seulement 8 exemples de la nouvelle tâche, atteins au moins 95 % de précision.",
    hint: "Un réseau qui part de zéro n'a pas assez de données. Un réseau qui a déjà appris une tâche voisine, si.",
    check: (s: TransferState) => s.n === 8 && s.acc >= 0.95,
  } satisfies Challenge<TransferState>,
  "emb-analogy": {
    id: "emb-analogy",
    title: "L'arithmétique des mots",
    goal: "Construis une analogie « capitale − son pays + un autre pays » dont le premier résultat est la bonne capitale.",
    hint: "Choisis une capitale et son propre pays en A et B, puis un autre pays en C. Toutes les combinaisons ne marchent pas sur un si petit corpus.",
    check: (s: EmbState) => s.expected !== null && s.top === s.expected,
  } satisfies Challenge<EmbState>,
  "rnn-memory": {
    id: "rnn-memory",
    title: "Se souvenir de 100 pas",
    goal: "Garde un gradient d'au moins 0,1 après 100 pas de temps, sans qu'il explose (au plus 10).",
    hint: "Pour le RNN, le gradient est multiplié par le même facteur à chaque pas. Le LSTM a une autre route.",
    check: (s: RnnState) => s.T >= 100 && s.grad >= 0.1 && s.grad <= 10,
  } satisfies Challenge<RnnState>,
};
