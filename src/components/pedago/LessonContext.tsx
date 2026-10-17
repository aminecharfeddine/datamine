"use client";
import { createContext, useContext, useEffect } from "react";
import { useProgress } from "@/lib/store";

type Ctx = { slug: string; concepts: string[] };
const LessonCtx = createContext<Ctx>({ slug: "sandbox", concepts: [] });

export function LessonProvider({ slug, concepts, children }: Ctx & { children: React.ReactNode }) {
  const markDiscovered = useProgress((s) => s.markDiscovered);
  const explore = useProgress((s) => s.explore);
  useEffect(() => {
    markDiscovered(concepts);
    // Revenir sur une leçon terminée il y a plus d'un mois : succès secret « Retour aux sources ».
    const done = useProgress.getState().completedLessons[slug];
    if (done && Date.now() - new Date(done).getTime() > 30 * 86_400_000) explore("revisit");
  }, [concepts, markDiscovered, explore, slug]);
  return <LessonCtx.Provider value={{ slug, concepts }}>{children}</LessonCtx.Provider>;
}

export const useLesson = () => useContext(LessonCtx);
