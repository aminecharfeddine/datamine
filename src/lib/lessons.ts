// Registre des contenus MDX (import dynamique → un chunk par leçon).
export const LESSON_CONTENT: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  bayes: () => import("@/content/lessons/bayes.mdx"),
  "descente-de-gradient": () => import("@/content/lessons/descente-de-gradient.mdx"),
  "theoreme-central-limite": () => import("@/content/lessons/theoreme-central-limite.mdx"),
  "biais-variance": () => import("@/content/lessons/biais-variance.mdx"),
  "matrice-de-confusion": () => import("@/content/lessons/matrice-de-confusion.mdx"),
  "roc-et-pr": () => import("@/content/lessons/roc-et-pr.mdx"),
};
