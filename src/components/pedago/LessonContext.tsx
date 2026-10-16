"use client";
import { createContext, useContext, useEffect } from "react";
import { useProgress } from "@/lib/store";

type Ctx = { slug: string; concepts: string[] };
const LessonCtx = createContext<Ctx>({ slug: "sandbox", concepts: [] });

export function LessonProvider({ slug, concepts, children }: Ctx & { children: React.ReactNode }) {
  const markDiscovered = useProgress((s) => s.markDiscovered);
  useEffect(() => markDiscovered(concepts), [concepts, markDiscovered]);
  return <LessonCtx.Provider value={{ slug, concepts }}>{children}</LessonCtx.Provider>;
}

export const useLesson = () => useContext(LessonCtx);
