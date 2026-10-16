// Registre des contenus MDX (import dynamique → un chunk par leçon).
export const LESSON_CONTENT: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "matrice-de-confusion": () => import("@/content/lessons/matrice-de-confusion.mdx"),
  "roc-et-pr": () => import("@/content/lessons/roc-et-pr.mdx"),
};
