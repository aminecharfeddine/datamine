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
  // --- confusion-matrix
  {
    id: "cm-1",
    concept: "confusion-matrix",
    kind: "flash",
    front: "Un modèle prédit « positif » pour un exemple réellement négatif. Quelle case de la confusion matrix ?",
    back: "False Positive (FP) — une fausse alerte. « False » = la prédiction est fausse, « Positive » = ce qui a été prédit.",
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
