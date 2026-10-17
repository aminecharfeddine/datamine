// Registre des contenus MDX (import dynamique → un chunk par leçon).
export const LESSON_CONTENT: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "validation-croisee": () => import("@/content/lessons/validation-croisee.mdx"),
  knn: () => import("@/content/lessons/knn.mdx"),
  "regression-logistique": () => import("@/content/lessons/regression-logistique.mdx"),
  "forets-et-boosting": () => import("@/content/lessons/forets-et-boosting.mdx"),
  "k-means": () => import("@/content/lessons/k-means.mdx"),
  "arbres-de-decision": () => import("@/content/lessons/arbres-de-decision.mdx"),
  "intervalles-de-confiance": () => import("@/content/lessons/intervalles-de-confiance.mdx"),
  "tests-et-p-values": () => import("@/content/lessons/tests-et-p-values.mdx"),
  regularisation: () => import("@/content/lessons/regularisation.mdx"),
  bayes: () => import("@/content/lessons/bayes.mdx"),
  "descente-de-gradient": () => import("@/content/lessons/descente-de-gradient.mdx"),
  "theoreme-central-limite": () => import("@/content/lessons/theoreme-central-limite.mdx"),
  "biais-variance": () => import("@/content/lessons/biais-variance.mdx"),
  "matrice-de-confusion": () => import("@/content/lessons/matrice-de-confusion.mdx"),
  "roc-et-pr": () => import("@/content/lessons/roc-et-pr.mdx"),
};
