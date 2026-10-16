// Cartes de révision (spaced repetition). Deux formats :
// - "flash" : question ouverte, on révèle la réponse puis on s'auto-évalue
// - "mcq"   : choix multiple, noté automatiquement

export type FlashCard = { id: string; concept: string; kind: "flash"; front: string; back: string };
export type McqCard = {
  id: string;
  concept: string;
  kind: "mcq";
  front: string;
  options: string[];
  answer: number;
  explain: string;
};
export type ReviewCard = FlashCard | McqCard;

export const CARDS: ReviewCard[] = [
  // --- cross-validation
  {
    id: "cv-1",
    concept: "cross-validation",
    kind: "flash",
    front: "Décris la validation croisée à k plis.",
    back: "On découpe les données en k plis. Pour chaque pli : entraîner sur les k−1 autres, mesurer l'erreur sur celui-ci. L'estimation est la moyenne des k erreurs ; chaque exemple sert une fois en validation.",
  },
  {
    id: "cv-2",
    concept: "cross-validation",
    kind: "mcq",
    front: "Pourquoi préférer la validation croisée à un seul découpage train / validation sur un petit dataset ?",
    options: [
      "Elle est plus rapide",
      "L'estimation dépend moins du hasard du découpage et utilise toutes les données",
      "Elle supprime l'overfitting",
      "Elle remplace le test set final",
    ],
    answer: 1,
    explain: "Un seul découpage est une loterie avec peu de données ; la moyenne sur k plis est plus stable.",
  },
  // --- leakage
  {
    id: "leak-1",
    concept: "leakage",
    kind: "flash",
    front: "Qu'est-ce qu'une fuite de données (data leakage) ?",
    back: "Quand une information issue des données de validation ou de test (ou du futur) influence l'entraînement. L'évaluation devient trop optimiste. Ex. : sélection de variables ou standardisation faites sur tout le dataset avant le découpage.",
  },
  {
    id: "leak-2",
    concept: "leakage",
    kind: "mcq",
    front: "Quelle étape peut se faire sur tout le dataset AVANT la validation croisée sans créer de fuite ?",
    options: [
      "Standardiser avec la moyenne globale",
      "Sélectionner les variables les plus corrélées à la cible",
      "Supprimer une colonne d'identifiant inutile",
      "Imputer les valeurs manquantes par la moyenne globale",
    ],
    answer: 2,
    explain: "Retirer une colonne sans regarder la cible ni les statistiques des données n'apprend rien des données. Les trois autres apprennent quelque chose et doivent être faites dans chaque pli.",
  },
  // --- knn
  {
    id: "knn-1",
    concept: "knn",
    kind: "flash",
    front: "Comment le k-NN classe-t-il un nouveau point ?",
    back: "Il calcule la distance à tous les exemples d'entraînement, garde les k plus proches et prédit la classe majoritaire parmi eux (la moyenne en régression).",
  },
  {
    id: "knn-2",
    concept: "knn",
    kind: "mcq",
    front: "Avec k = 1, précision d'entraînement 100 %, précision de test 85 %. Que faire ?",
    options: ["Diminuer k", "Augmenter k", "Ajouter des variables", "Rien, c'est optimal"],
    answer: 1,
    explain: "k = 1 overfitte : augmenter k lisse la frontière et réduit la variance.",
  },
  {
    id: "knn-3",
    concept: "knn",
    kind: "flash",
    front: "Pourquoi standardiser les variables avant un k-NN ?",
    back: "Les distances sont dominées par les variables aux plus grandes valeurs numériques. Sans standardisation, une variable en milliers écrase une variable en unités.",
  },
  // --- arbres
  {
    id: "tree-1",
    concept: "arbres",
    kind: "mcq",
    front: "Indice de Gini d'un groupe avec 50 % de chaque classe (2 classes) ?",
    options: ["0", "0,25", "0,5", "1"],
    answer: 2,
    explain: "G = 1 − 0,5² − 0,5² = 0,5 : impureté maximale pour deux classes.",
  },
  {
    id: "tree-2",
    concept: "arbres",
    kind: "flash",
    front: "Comment régularise-t-on un arbre de décision ?",
    back: "En limitant sa croissance : profondeur maximale, nombre minimal d'exemples par feuille, élagage. Ou en moyennant de nombreux arbres (forêt aléatoire).",
  },
  {
    id: "tree-3",
    concept: "arbres",
    kind: "mcq",
    front: "Quelle forme ont les régions de décision d'un arbre sur deux variables numériques ?",
    options: ["Des cercles", "Des rectangles alignés sur les axes", "Des droites obliques", "Des formes quelconques"],
    answer: 1,
    explain: "Chaque question porte sur une seule variable (x ≤ seuil) : elle coupe le plan verticalement ou horizontalement.",
  },
  // --- ic
  {
    id: "ic-1",
    concept: "ic",
    kind: "mcq",
    front: "Que signifie « intervalle de confiance à 95 % » ?",
    options: [
      "95 % de chances que μ soit dans cet intervalle précis",
      "La méthode produit des intervalles qui contiennent μ dans 95 % des échantillons",
      "95 % des données sont dans l'intervalle",
      "L'estimation est juste à 95 %",
    ],
    answer: 1,
    explain: "μ est fixe ; c'est l'intervalle qui varie d'un échantillon à l'autre. Le 95 % décrit la procédure.",
  },
  {
    id: "ic-2",
    concept: "ic",
    kind: "flash",
    front: "Formule d'un intervalle de confiance pour une moyenne (σ connu) ?",
    back: "x̄ ± z · σ/√n, avec z = 1,96 à 95 % et 2,58 à 99 %. Si σ est estimé par s, on utilise le quantile de Student t(n−1).",
  },
  {
    id: "ic-3",
    concept: "ic",
    kind: "mcq",
    front: "Pour diviser par 2 la marge d'un intervalle de confiance, à niveau égal, il faut…",
    options: ["2 fois plus de données", "4 fois plus de données", "Passer de 95 % à 90 %", "8 fois plus de données"],
    answer: 1,
    explain: "La marge est proportionnelle à 1/√n. Baisser le niveau réduit aussi la marge, mais on perd en confiance.",
  },
  // --- tests
  {
    id: "test-1",
    concept: "tests",
    kind: "flash",
    front: "Définition exacte de la p-value ?",
    back: "La probabilité, en supposant H₀ vraie, d'observer un résultat au moins aussi extrême que celui mesuré. Ce n'est pas la probabilité que H₀ soit vraie.",
  },
  {
    id: "test-2",
    concept: "tests",
    kind: "mcq",
    front: "Erreur de type I et erreur de type II ?",
    options: [
      "I : rater un vrai effet ; II : voir un effet inexistant",
      "I : voir un effet inexistant (faux positif) ; II : rater un vrai effet (faux négatif)",
      "Ce sont deux noms de la p-value",
      "I : mauvais seuil ; II : mauvais échantillon",
    ],
    answer: 1,
    explain: "α contrôle le taux d'erreur de type I ; la puissance vaut 1 − taux d'erreur de type II.",
  },
  {
    id: "test-3",
    concept: "tests",
    kind: "flash",
    front: "Qu'est-ce que la puissance d'un test, et comment l'augmenter ?",
    back: "La probabilité de détecter un effet qui existe vraiment. Elle augmente avec la taille d'échantillon, la taille de l'effet et un α plus permissif.",
  },
  // --- regularisation
  {
    id: "reg-1",
    concept: "regularisation",
    kind: "flash",
    front: "Fonction objectif de la régression ridge ?",
    back: "Σ (yᵢ − ŷᵢ)² + λ Σ wⱼ². Le second terme pénalise les grands coefficients ; λ règle l'arbitrage entre ajustement et simplicité.",
  },
  {
    id: "reg-2",
    concept: "regularisation",
    kind: "mcq",
    front: "Quelle régularisation met des coefficients exactement à zéro ?",
    options: ["L2 (ridge)", "L1 (lasso)", "Dropout", "Aucune"],
    answer: 1,
    explain: "La pénalité |w| de L1 crée de la parcimonie : sélection de variables automatique.",
  },
  {
    id: "reg-3",
    concept: "regularisation",
    kind: "mcq",
    front: "Pourquoi standardiser les variables avant une régression ridge ?",
    options: [
      "Pour accélérer le calcul",
      "Parce que la pénalité dépend de l'échelle des coefficients, donc des variables",
      "Pour éviter les valeurs négatives",
      "Ce n'est pas nécessaire",
    ],
    answer: 1,
    explain: "Sans standardisation, une variable exprimée en petites unités est injustement pénalisée.",
  },
  // --- proba (Bayes)
  {
    id: "proba-1",
    concept: "proba",
    kind: "flash",
    front: "Énonce le théorème de Bayes et nomme chaque terme.",
    back: "P(A|B) = P(B|A)·P(A) / P(B). P(A) : a priori (prior). P(B|A) : vraisemblance. P(B) : probabilité totale de B. P(A|B) : a posteriori (posterior).",
  },
  {
    id: "proba-2",
    concept: "proba",
    kind: "mcq",
    front: "Prévalence 1 %, sensitivity 90 %, 5 % de faux positifs chez les sains. P(malade | test +) ≈ ?",
    options: ["90 %", "50 %", "15 %", "5 %"],
    answer: 2,
    explain: "Sur 2 000 personnes : 18 vrais positifs contre 99 faux positifs → 18/117 ≈ 15 %. Les sains sont 99 fois plus nombreux.",
  },
  {
    id: "proba-3",
    concept: "proba",
    kind: "flash",
    front: "Maladie rare : quel paramètre du test améliore le plus P(malade | +) ?",
    back: "La specificity. Les faux positifs viennent de l'immense population des sains : réduire leur taux réduit le dénominateur bien plus qu'améliorer la détection des rares malades.",
  },
  // --- gradient
  {
    id: "grad-1",
    concept: "gradient",
    kind: "flash",
    front: "Règle de mise à jour de la descente de gradient ?",
    back: "w ← w − η · ∇L(w). On fait un pas opposé au gradient (direction de plus forte montée), de taille proportionnelle au learning rate η.",
  },
  {
    id: "grad-2",
    concept: "gradient",
    kind: "mcq",
    front: "La perte oscille de plus en plus fort et finit en NaN. Cause la plus probable ?",
    options: ["Learning rate trop petit", "Learning rate trop grand", "Trop de données", "Minimum local"],
    answer: 1,
    explain: "Des pas trop grands enjambent le minimum et atterrissent plus haut : la perte diverge.",
  },
  {
    id: "grad-3",
    concept: "gradient",
    kind: "mcq",
    front: "L(w) = w². Quelle est la dérivée L′(3) ?",
    options: ["3", "6", "9", "2"],
    answer: 1,
    explain: "L′(w) = 2w, donc L′(3) = 6. Avec η = 0,1, le pas suivant serait w = 3 − 0,6 = 2,4.",
  },
  // --- distributions
  {
    id: "dist-1",
    concept: "distributions",
    kind: "flash",
    front: "Pour une loi normale, quelle proportion des valeurs tombe dans μ ± 2σ ?",
    back: "Environ 95 % (68 % dans μ ± σ, 99,7 % dans μ ± 3σ).",
  },
  {
    id: "dist-2",
    concept: "distributions",
    kind: "flash",
    front: "Quelle différence entre variance et écart-type ?",
    back: "La variance σ² est la moyenne des carrés des écarts à la moyenne. L'écart-type σ est sa racine : il s'exprime dans la même unité que les données, donc plus lisible.",
  },
  // --- tcl
  {
    id: "tcl-1",
    concept: "tcl",
    kind: "flash",
    front: "Que dit le théorème central limite ?",
    back: "Pour des tirages indépendants de variance finie, la moyenne d'un échantillon de taille n suit approximativement N(μ, σ/√n) quand n est grand, quelle que soit la distribution de départ.",
  },
  {
    id: "tcl-2",
    concept: "tcl",
    kind: "mcq",
    front: "Pour diviser par 3 l'erreur standard d'une moyenne, il faut multiplier la taille de l'échantillon par…",
    options: ["3", "6", "9", "√3"],
    answer: 2,
    explain: "L'erreur standard vaut σ/√n : la diviser par 3 demande √n × 3, donc n × 9.",
  },
  // --- generalisation
  {
    id: "gen-1",
    concept: "generalisation",
    kind: "flash",
    front: "Pourquoi ne faut-il pas choisir ses hyperparamètres sur le test set ?",
    back: "Le test set deviendrait une donnée d'entraînement indirecte : son erreur ne mesurerait plus la généralisation. On choisit sur un validation set (ou par cross-validation) et on n'utilise le test qu'une fois, à la fin.",
  },
  {
    id: "gen-2",
    concept: "generalisation",
    kind: "mcq",
    front: "Erreur d'entraînement très basse, erreur de validation élevée. Diagnostic ?",
    options: ["Underfitting", "Overfitting", "Fuite de données", "Modèle optimal"],
    answer: 1,
    explain: "Le modèle a mémorisé ses données d'entraînement au lieu d'en extraire la structure.",
  },
  // --- biais-variance
  {
    id: "bv-1",
    concept: "biais-variance",
    kind: "flash",
    front: "Décomposition de l'erreur de test (MSE) ?",
    back: "Erreur = Biais² + Variance + bruit irréductible σ². Biais : erreur systématique d'un modèle trop simple. Variance : sensibilité au jeu d'entraînement d'un modèle trop flexible.",
  },
  {
    id: "bv-2",
    concept: "biais-variance",
    kind: "mcq",
    front: "Ajouter beaucoup de données d'entraînement réduit surtout…",
    options: ["Le biais", "La variance", "Le bruit irréductible", "Les trois également"],
    answer: 1,
    explain: "Plus d'exemples stabilisent l'estimation : le modèle dépend moins des particularités de l'échantillon. Le biais, lui, tient à la forme du modèle.",
  },
  {
    id: "bv-3",
    concept: "biais-variance",
    kind: "mcq",
    front: "Erreurs d'entraînement et de validation hautes et proches. Quel levier ?",
    options: ["Plus de régularisation", "Plus de données", "Un modèle plus complexe", "Early stopping plus tôt"],
    answer: 2,
    explain: "C'est un problème de biais (underfitting) : il faut plus de capacité, pas moins.",
  },
  // --- confusion-matrix
  {
    id: "cm-1",
    concept: "confusion-matrix",
    kind: "flash",
    front: "Un modèle prédit « positif » pour un exemple réellement négatif. Quelle case de la confusion matrix ?",
    back: "False Positive (FP) : une fausse alerte. « False » = la prédiction est fausse, « Positive » = ce qui a été prédit.",
  },
  {
    id: "cm-2",
    concept: "confusion-matrix",
    kind: "mcq",
    front: "Sur 1 000 transactions dont 10 frauduleuses, un modèle qui prédit toujours « non-fraude » a une accuracy de…",
    options: ["1 %", "50 %", "99 %", "Indéfinie"],
    answer: 2,
    explain: "990/1000 = 99 %. L'accuracy est trompeuse quand les classes sont déséquilibrées : ce modèle ne détecte aucune fraude (recall = 0).",
  },
  // --- precision-recall
  {
    id: "pr-1",
    concept: "precision-recall",
    kind: "flash",
    front: "Formule et question à laquelle répond la precision ?",
    back: "Precision = TP / (TP + FP). « Quand le modèle dit positif, à quelle fréquence a-t-il raison ? »",
  },
  {
    id: "pr-2",
    concept: "precision-recall",
    kind: "flash",
    front: "Formule et question à laquelle répond le recall ?",
    back: "Recall = TP / (TP + FN). « Parmi les vrais positifs, quelle part le modèle retrouve-t-il ? » (aussi appelé sensitivity ou TPR)",
  },
  {
    id: "pr-3",
    concept: "precision-recall",
    kind: "mcq",
    front: "Dépistage d'un cancer : quelle erreur coûte le plus cher, donc quelle métrique prioriser ?",
    options: ["Les FP → precision", "Les FN → recall", "Les TN → specificity", "Aucune, l'accuracy suffit"],
    answer: 1,
    explain: "Rater un malade (FN) est bien plus grave qu'un examen complémentaire inutile (FP). On maximise le recall, quitte à perdre en precision.",
  },
  // --- f1
  {
    id: "f1-1",
    concept: "f1",
    kind: "flash",
    front: "Pourquoi le F1 utilise-t-il la moyenne harmonique plutôt que la moyenne arithmétique ?",
    back: "La moyenne harmonique est dominée par la plus petite valeur : precision = 1 et recall = 0,01 donnent F1 ≈ 0,02 (vs 0,505 en arithmétique). Impossible de « tricher » en sacrifiant une métrique.",
  },
  {
    id: "f1-2",
    concept: "f1",
    kind: "mcq",
    front: "Precision = 0,5 et recall = 1. Le F1 vaut…",
    options: ["0,50", "0,67", "0,75", "1,00"],
    answer: 1,
    explain: "F1 = 2·P·R / (P+R) = 2·0,5·1 / 1,5 ≈ 0,67.",
  },
  // --- threshold
  {
    id: "th-1",
    concept: "threshold",
    kind: "mcq",
    front: "On augmente le seuil de décision. En général…",
    options: [
      "Precision ↑, recall ↓",
      "Precision ↓, recall ↑",
      "Les deux augmentent",
      "Les deux baissent",
    ],
    answer: 0,
    explain: "Seuil plus strict → moins de prédictions positives : moins de FP (precision ↑) mais plus de FN (recall ↓). Le recall ne peut que baisser ; la precision monte en tendance mais pas forcément de façon monotone.",
  },
  {
    id: "th-2",
    concept: "threshold",
    kind: "flash",
    front: "Le seuil fait-il partie du modèle ?",
    back: "Non : le modèle produit un score, le seuil est une décision métier prise après coup, selon le coût relatif des FP et des FN. Changer de seuil ne nécessite pas de ré-entraîner.",
  },
  // --- roc-auc
  {
    id: "roc-1",
    concept: "roc-auc",
    kind: "flash",
    front: "Que représentent les axes d'une ROC curve ?",
    back: "x = False Positive Rate = FP / (FP + TN), y = True Positive Rate = recall. Chaque point correspond à un seuil.",
  },
  {
    id: "roc-2",
    concept: "roc-auc",
    kind: "mcq",
    front: "Interprétation probabiliste de l'AUC ROC ?",
    options: [
      "Proportion de prédictions correctes",
      "Probabilité qu'un positif tiré au hasard ait un score supérieur à un négatif tiré au hasard",
      "Recall moyen sur tous les seuils",
      "Precision au seuil 0,5",
    ],
    answer: 1,
    explain: "L'AUC mesure la qualité du classement (ranking), indépendamment du seuil. 0,5 = hasard, 1 = séparation parfaite.",
  },
  // --- pr-curve
  {
    id: "prc-1",
    concept: "pr-curve",
    kind: "mcq",
    front: "Classes très déséquilibrées (1 % de positifs). Quelle courbe est la plus informative ?",
    options: ["ROC", "Precision-Recall", "Les deux se valent", "Aucune"],
    answer: 1,
    explain: "Le FPR reste minuscule car TN est énorme, donc la ROC paraît flatteuse. La PR curve expose directement l'effondrement de la precision.",
  },
  {
    id: "prc-2",
    concept: "pr-curve",
    kind: "flash",
    front: "Quelle est la baseline d'une PR curve (modèle aléatoire) ?",
    back: "Une droite horizontale à y = prévalence (proportion de positifs). Pour la ROC, la baseline est la diagonale, quelle que soit la prévalence.",
  },
];

export const cardsForConcepts = (concepts: string[]) => CARDS.filter((c) => concepts.includes(c.concept));
export const cardById = (id: string) => CARDS.find((c) => c.id === id);
