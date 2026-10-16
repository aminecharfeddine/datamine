import type { MDXComponents } from "mdx/types";
import { Predict } from "@/components/pedago/Predict";
import { Quiz } from "@/components/pedago/Quiz";
import { Callout } from "@/components/pedago/Callout";
import { LessonComplete } from "@/components/pedago/LessonComplete";
import { ThresholdLab } from "@/components/viz/ThresholdLab";
import { BayesLab } from "@/components/viz/BayesLab";
import { GradientLab } from "@/components/viz/GradientLab";
import { CltLab } from "@/components/viz/CltLab";
import { PolyFitLab } from "@/components/viz/PolyFitLab";

// Composants disponibles dans toutes les leçons MDX, sans import.
const components: MDXComponents = { Predict, Quiz, Callout, LessonComplete, ThresholdLab, BayesLab, GradientLab, CltLab, PolyFitLab };

export function useMDXComponents(): MDXComponents {
  return components;
}
