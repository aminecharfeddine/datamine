// Source de vérité du parcours : modules → concepts → leçons.
// Ajouter une leçon = 1 entrée ici + 1 fichier MDX dans src/content/lessons + l'import dans lessons.ts.

export type Concept = { id: string; title: string };

export type LessonMeta = {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  concepts: string[]; // ids de concepts travaillés (et cartes de révision ajoutées)
  available: boolean;
};

export type Module = {
  id: string;
  index: number;
  title: string;
  tagline: string;
  prereqs: string[]; // ids de modules
  concepts: Concept[];
  lessons: LessonMeta[];
};

export const MODULES: Module[] = [
  {
    id: "maths",
    index: 0,
    title: "Rappels maths",
    tagline: "Les outils minimaux, revus au moment où on en a besoin.",
    prereqs: [],
    concepts: [
      { id: "proba", title: "Probabilités & Bayes" },
      { id: "esperance", title: "Espérance & variance" },
      { id: "algebre", title: "Vecteurs & matrices" },
      { id: "gradient", title: "Dérivées & gradient" },
    ],
    lessons: [
      {
        slug: "bayes",
        title: "Bayes et le paradoxe du test médical",
        summary: "Pourquoi un test positif à « 90 % fiable » ne signifie souvent presque rien.",
        minutes: 15,
        concepts: ["proba"],
        available: true,
      },
      {
        slug: "descente-de-gradient",
        title: "Dérivée, gradient et descente",
        summary: "Descendre une colline dans le brouillard : l'algorithme qui entraîne tous les modèles.",
        minutes: 15,
        concepts: ["gradient"],
        available: true,
      },
    ],
  },
  {
    id: "stats",
    index: 1,
    title: "Statistiques",
    tagline: "Distributions, échantillonnage, incertitude.",
    prereqs: ["maths"],
    concepts: [
      { id: "distributions", title: "Distributions" },
      { id: "tcl", title: "Théorème central limite" },
      { id: "tests", title: "Tests & p-values" },
      { id: "ic", title: "Intervalles de confiance" },
    ],
    lessons: [
      {
        slug: "theoreme-central-limite",
        title: "Le théorème central limite",
        summary: "Pourquoi la loi normale est partout, et pourquoi la précision coûte √n.",
        minutes: 15,
        concepts: ["distributions", "tcl"],
        available: true,
      },
    ],
  },
  {
    id: "fondamentaux",
    index: 2,
    title: "Fondamentaux ML",
    tagline: "Pourquoi un modèle généralise (ou pas).",
    prereqs: ["stats"],
    concepts: [
      { id: "generalisation", title: "Train / test & généralisation" },
      { id: "biais-variance", title: "Bias-variance tradeoff" },
      { id: "regularisation", title: "Régularisation" },
      { id: "cross-validation", title: "Cross-validation" },
      { id: "leakage", title: "Data leakage" },
    ],
    lessons: [
      {
        slug: "biais-variance",
        title: "Overfitting et bias-variance tradeoff",
        summary: "Apprendre par cœur ou comprendre : la courbe en U qui gouverne tout le ML.",
        minutes: 20,
        concepts: ["generalisation", "biais-variance"],
        available: true,
      },
    ],
  },
  {
    id: "modeles",
    index: 3,
    title: "Modèles classiques",
    tagline: "Régressions, arbres, ensembles, clustering.",
    prereqs: ["fondamentaux"],
    concepts: [
      { id: "lineaire", title: "Régression linéaire & logistique" },
      { id: "knn", title: "k-NN" },
      { id: "arbres", title: "Decision trees" },
      { id: "ensembles", title: "Random forest & boosting" },
      { id: "clustering", title: "k-means & PCA" },
    ],
    lessons: [],
  },
  {
    id: "evaluation",
    index: 4,
    title: "Évaluation",
    tagline: "Mesurer ce qui compte vraiment.",
    prereqs: ["fondamentaux"],
    concepts: [
      { id: "confusion-matrix", title: "Confusion matrix" },
      { id: "precision-recall", title: "Precision & recall" },
      { id: "f1", title: "F1-score" },
      { id: "threshold", title: "Choix du seuil" },
      { id: "roc-auc", title: "ROC & AUC" },
      { id: "pr-curve", title: "PR curve & déséquilibre" },
    ],
    lessons: [
      {
        slug: "matrice-de-confusion",
        title: "Confusion matrix, precision & recall",
        summary: "Un seuil, quatre cases, deux métriques qui tirent en sens opposé.",
        minutes: 15,
        concepts: ["confusion-matrix", "precision-recall", "f1", "threshold"],
        available: true,
      },
      {
        slug: "roc-et-pr",
        title: "ROC, AUC et PR curve",
        summary: "Évaluer un modèle sur tous les seuils à la fois — et le piège des classes rares.",
        minutes: 15,
        concepts: ["roc-auc", "pr-curve"],
        available: true,
      },
    ],
  },
  {
    id: "deep-learning",
    index: 5,
    title: "Deep learning",
    tagline: "Neurones, backprop, CNN, embeddings.",
    prereqs: ["modeles"],
    concepts: [
      { id: "perceptron", title: "Perceptron & MLP" },
      { id: "backprop", title: "Backpropagation" },
      { id: "optimiseurs", title: "Gradient descent & optimizers" },
      { id: "cnn", title: "CNN" },
      { id: "embeddings", title: "Embeddings" },
    ],
    lessons: [],
  },
  {
    id: "transformers",
    index: 6,
    title: "Transformers & LLM",
    tagline: "Attention, pré-entraînement, sampling, RAG.",
    prereqs: ["deep-learning"],
    concepts: [
      { id: "tokenisation", title: "Tokenization" },
      { id: "attention", title: "Self-attention" },
      { id: "pretraining", title: "Pre-training & fine-tuning" },
      { id: "sampling", title: "Temperature & sampling" },
      { id: "rag", title: "RAG" },
    ],
    lessons: [],
  },
  {
    id: "agents",
    index: 7,
    title: "IA agentique",
    tagline: "Tool use, boucles, planification, évaluation.",
    prereqs: ["transformers"],
    concepts: [
      { id: "tool-use", title: "Tool use" },
      { id: "react-loop", title: "ReAct loop" },
      { id: "memoire", title: "Mémoire & contexte" },
      { id: "eval-agents", title: "Évaluer un agent" },
    ],
    lessons: [],
  },
];

export const ALL_LESSONS = MODULES.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })));

export function findLesson(slug: string) {
  return ALL_LESSONS.find((l) => l.slug === slug);
}

export function conceptTitle(id: string) {
  for (const m of MODULES) {
    const c = m.concepts.find((c) => c.id === id);
    if (c) return c.title;
  }
  return id;
}
