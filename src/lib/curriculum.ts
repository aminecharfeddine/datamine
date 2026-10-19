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
  /** Couleur d'identité du module (et sa variante foncée pour les ombres de bouton). */
  color: string;
  deep: string;
  title: string;
  tagline: string;
  prereqs: string[]; // ids de modules
  concepts: Concept[];
  lessons: LessonMeta[];
};

export const MODULES: Module[] = [
  {
    id: "maths",
    color: "#4f46e5",
    deep: "#3730a3",
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
    color: "#7c3aed",
    deep: "#5b21b6",
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
      {
        slug: "intervalles-de-confiance",
        title: "Intervalles de confiance",
        summary: "Ce que « 95 % » promet vraiment, et pourquoi la précision coûte cher.",
        minutes: 15,
        concepts: ["ic"],
        available: true,
      },
      {
        slug: "tests-et-p-values",
        title: "Tests A/B et p-values",
        summary: "Faux positifs garantis, puissance, et ce qu'une p-value ne dit pas.",
        minutes: 20,
        concepts: ["tests"],
        available: true,
      },
    ],
  },
  {
    id: "fondamentaux",
    color: "#0d9488",
    deep: "#0f766e",
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
      {
        slug: "regularisation",
        title: "Régularisation : ridge, lasso et compagnie",
        summary: "Garder un modèle flexible, mais l'obliger à rester sage.",
        minutes: 15,
        concepts: ["regularisation"],
        available: true,
      },
      {
        slug: "validation-croisee",
        title: "Validation croisée et data leakage",
        summary: "Mesurer honnêtement la performance, et le piège qui fausse tant d'études.",
        minutes: 20,
        concepts: ["cross-validation", "leakage"],
        available: true,
      },
    ],
  },
  {
    id: "modeles",
    color: "#0284c7",
    deep: "#075985",
    index: 3,
    title: "Modèles classiques",
    tagline: "Régressions, arbres, ensembles, clustering.",
    prereqs: ["fondamentaux"],
    concepts: [
      { id: "lineaire", title: "Régression linéaire & logistique" },
      { id: "knn", title: "k-NN" },
      { id: "arbres", title: "Decision trees" },
      { id: "ensembles", title: "Random forest & boosting" },
      { id: "clustering", title: "Clustering (k-means)" },
      { id: "pca", title: "PCA" },
    ],
    lessons: [
      {
        slug: "regression-logistique",
        title: "De la régression linéaire à la logistique",
        summary: "Une droite, une sigmoïde, et une perte qui punit surtout les certitudes fausses.",
        minutes: 18,
        concepts: ["lineaire"],
        available: true,
      },
      {
        slug: "knn",
        title: "Les k plus proches voisins",
        summary: "Dis-moi qui sont tes voisins, je te dirai qui tu es. À condition que tes unités soient cohérentes.",
        minutes: 15,
        concepts: ["knn"],
        available: true,
      },
      {
        slug: "arbres-de-decision",
        title: "Arbres de décision",
        summary: "Vingt questions pour classer le monde, et pourquoi il faut savoir s'arrêter.",
        minutes: 15,
        concepts: ["arbres"],
        available: true,
      },
      {
        slug: "forets-et-boosting",
        title: "Forêts aléatoires et boosting",
        summary: "Cent arbres médiocres valent mieux qu'un bon : deux façons très différentes de le faire.",
        minutes: 18,
        concepts: ["ensembles"],
        available: true,
      },
      {
        slug: "k-means",
        title: "k-means : trouver des groupes sans étiquettes",
        summary: "Pas de réponse à prédire, seulement des données. Deux étapes répétées jusqu'à ce que rien ne bouge.",
        minutes: 15,
        concepts: ["clustering"],
        available: true,
      },
    ],
  },
  {
    id: "evaluation",
    color: "#f43f5e",
    deep: "#be123c",
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
        summary: "Évaluer un modèle sur tous les seuils à la fois, et le piège des classes rares.",
        minutes: 15,
        concepts: ["roc-auc", "pr-curve"],
        available: true,
      },
    ],
  },
  {
    id: "pratique",
    color: "#0e7490",
    deep: "#164e63",
    index: 5,
    title: "ML en pratique",
    tagline: "pandas, scikit-learn, SQL, mise en production : le quotidien du métier.",
    prereqs: ["evaluation"],
    concepts: [
      { id: "pandas", title: "NumPy & pandas" },
      { id: "sklearn-pipeline", title: "Pipelines scikit-learn" },
      { id: "feature-engineering", title: "Feature engineering" },
      { id: "sql", title: "SQL pour la data" },
      { id: "mlops", title: "MLOps : déployer et surveiller" },
    ],
    lessons: [
      {
        slug: "numpy-et-pandas",
        title: "NumPy et pandas",
        summary: "Penser en colonnes : vectorisation, broadcasting, groupby et merge, sans une seule boucle.",
        minutes: 18,
        concepts: ["pandas"],
        available: true,
      },
      {
        slug: "pipelines-scikit-learn",
        title: "Pipelines scikit-learn",
        summary: "fit, transform, predict : préparer les données sans fuite, et livrer un seul objet déployable.",
        minutes: 18,
        concepts: ["sklearn-pipeline"],
        available: true,
      },
      {
        slug: "feature-engineering",
        title: "Feature engineering",
        summary: "Le jour de la semaine, la température au carré, la promo du samedi : les variables qui font le score.",
        minutes: 18,
        concepts: ["feature-engineering"],
        available: true,
      },
      {
        slug: "sql-pour-la-data",
        title: "SQL pour la data",
        summary: "Un vrai SQLite dans le navigateur : filtres, agrégats, jointures et fonctions de fenêtre.",
        minutes: 25,
        concepts: ["sql"],
        available: true,
      },
      {
        slug: "mlops",
        title: "MLOps : déployer et surveiller",
        summary: "Batch ou API, versions, dérive et PSI : garder un modèle utile pendant un an.",
        minutes: 18,
        concepts: ["mlops"],
        available: true,
      },
    ],
  },
  {
    id: "deep-learning",
    color: "#db2777",
    deep: "#9d174d",
    index: 6,
    title: "Deep learning",
    tagline: "Neurones, backprop, PyTorch, CNN, embeddings.",
    prereqs: ["modeles"],
    concepts: [
      { id: "perceptron", title: "Neurone & MLP" },
      { id: "backprop", title: "Backpropagation & autograd" },
      { id: "entrainement", title: "Boucle d'entraînement PyTorch" },
      { id: "cnn", title: "CNN" },
      { id: "embeddings", title: "Embeddings" },
    ],
    lessons: [
      {
        slug: "reseaux-de-neurones",
        title: "Du neurone au réseau",
        summary: "Une régression logistique, puis cent, empilées : pourquoi la non-linéarité change tout.",
        minutes: 18,
        concepts: ["perceptron"],
        available: true,
      },
      {
        slug: "backpropagation",
        title: "Backpropagation et autograd",
        summary: "La règle de la chaîne, appliquée à l'envers sur un graphe de calcul. Ce que fait loss.backward().",
        minutes: 18,
        concepts: ["backprop"],
        available: true,
      },
      {
        slug: "entrainer-en-pytorch",
        title: "Entraîner un réseau en PyTorch",
        summary: "Les cinq lignes de la boucle d'entraînement, et les bugs qui se lisent sur une courbe de loss.",
        minutes: 20,
        concepts: ["entrainement"],
        available: true,
      },
    ],
  },
  {
    id: "transformers",
    color: "#d97706",
    deep: "#92400e",
    index: 7,
    title: "Transformers & LLM",
    tagline: "Tokens, attention, architecture, entraînement et inférence des LLM.",
    prereqs: ["deep-learning"],
    concepts: [
      { id: "tokenisation", title: "Tokenization (BPE)" },
      { id: "attention", title: "Self-attention" },
      { id: "architecture", title: "Architecture Transformer" },
      { id: "pretraining", title: "Pre-training, fine-tuning & LoRA" },
      { id: "sampling", title: "Décodage & sampling" },
      { id: "inference", title: "Inférence : KV cache, quantization" },
      { id: "rag", title: "RAG" },
    ],
    lessons: [
      {
        slug: "tokenisation",
        title: "Tokenisation : du texte aux nombres",
        summary: "Comment un LLM découpe le texte, pourquoi il compte mal les lettres, et ce que coûte un token.",
        minutes: 15,
        concepts: ["tokenisation"],
        available: true,
      },
      {
        slug: "self-attention",
        title: "Self-attention",
        summary: "Query, key, value : chaque token va chercher l'information dont il a besoin chez les autres.",
        minutes: 20,
        concepts: ["attention"],
        available: true,
      },
      {
        slug: "architecture-transformer",
        title: "L'architecture Transformer",
        summary: "Attention, MLP, résidus, normalisation : un LLM complet, bloc par bloc, et où vivent ses milliards de paramètres.",
        minutes: 20,
        concepts: ["architecture"],
        available: true,
      },
      {
        slug: "pre-entrainement-et-fine-tuning",
        title: "Pré-entraînement, fine-tuning et LoRA",
        summary: "Du modèle de base à l'assistant, et comment adapter un LLM avec 0,4 % de ses paramètres.",
        minutes: 20,
        concepts: ["pretraining"],
        available: true,
      },
      {
        slug: "decodage-et-sampling",
        title: "Décodage et sampling",
        summary: "Température, top-k, top-p : comment le modèle choisit chaque mot, et comment obtenir des sorties fiables.",
        minutes: 15,
        concepts: ["sampling"],
        available: true,
      },
      {
        slug: "inference-llm",
        title: "Inférence : KV cache et quantization",
        summary: "Pourquoi la génération est limitée par la mémoire, et comment faire tenir 70 milliards de paramètres sur un GPU.",
        minutes: 18,
        concepts: ["inference"],
        available: true,
      },
      {
        slug: "rag",
        title: "RAG : brancher un LLM sur tes documents",
        summary: "Découper, indexer, retrouver, citer. Et pourquoi tout se joue à l'étape de recherche.",
        minutes: 20,
        concepts: ["rag"],
        available: true,
      },
    ],
  },
  {
    id: "agents",
    color: "#16a34a",
    deep: "#166534",
    index: 8,
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

export const moduleById = (id: string) => MODULES.find((m) => m.id === id);

/** Module auquel appartient un concept. */
export const moduleOfConcept = (concept: string) => MODULES.find((m) => m.concepts.some((c) => c.id === concept));

/** Variables CSS qui colorent une zone aux couleurs d'un module. */
export const modStyle = (m?: Pick<Module, "color" | "deep">) =>
  (m ? { "--mod": m.color, "--mod-deep": m.deep, "--btn-shadow": m.deep } : {}) as React.CSSProperties;

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
