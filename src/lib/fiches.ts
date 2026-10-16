// Registre des fiches récap (une par leçon, débloquée quand la leçon est terminée).
export const FICHE_CONTENT: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "matrice-de-confusion": () => import("@/content/fiches/matrice-de-confusion.mdx"),
  "roc-et-pr": () => import("@/content/fiches/roc-et-pr.mdx"),
  bayes: () => import("@/content/fiches/bayes.mdx"),
  "descente-de-gradient": () => import("@/content/fiches/descente-de-gradient.mdx"),
  "theoreme-central-limite": () => import("@/content/fiches/theoreme-central-limite.mdx"),
  "intervalles-de-confiance": () => import("@/content/fiches/intervalles-de-confiance.mdx"),
  "tests-et-p-values": () => import("@/content/fiches/tests-et-p-values.mdx"),
  "biais-variance": () => import("@/content/fiches/biais-variance.mdx"),
  regularisation: () => import("@/content/fiches/regularisation.mdx"),
  "validation-croisee": () => import("@/content/fiches/validation-croisee.mdx"),
  knn: () => import("@/content/fiches/knn.mdx"),
  "arbres-de-decision": () => import("@/content/fiches/arbres-de-decision.mdx"),
};
