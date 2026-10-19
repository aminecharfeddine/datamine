import type { MDXComponents } from "mdx/types";
import { Predict } from "@/components/pedago/Predict";
import { Quiz } from "@/components/pedago/Quiz";
import { Callout } from "@/components/pedago/Callout";
import { Exercise } from "@/components/pedago/Exercise";
import { Interview } from "@/components/pedago/Interview";
import { Recap } from "@/components/pedago/Recap";
import { FicheSection } from "@/components/fiche/FicheSection";
import { LessonComplete } from "@/components/pedago/LessonComplete";
import { ThresholdLab } from "@/components/viz/ThresholdLab";
import { BayesLab } from "@/components/viz/BayesLab";
import { GradientLab } from "@/components/viz/GradientLab";
import { CltLab } from "@/components/viz/CltLab";
import { PolyFitLab } from "@/components/viz/PolyFitLab";
import { AbLab } from "@/components/viz/AbLab";
import { CiLab } from "@/components/viz/CiLab";
import { RidgeLab } from "@/components/viz/RidgeLab";
import { CvLab } from "@/components/viz/CvLab";
import { LeakLab } from "@/components/viz/LeakLab";
import { KnnLab } from "@/components/viz/KnnLab";
import { TreeLab } from "@/components/viz/TreeLab";
import { SigmoidLab, LogRegLab } from "@/components/viz/LogisticLab";
import { ForestLab, BoostLab } from "@/components/viz/EnsembleLab";
import { KMeansLab } from "@/components/viz/KMeansLab";
import { NeuralLab } from "@/components/viz/NeuralLab";
import { BackpropLab } from "@/components/viz/BackpropLab";
import { TrainLoopLab } from "@/components/viz/TrainLoopLab";
import { BpeLab } from "@/components/viz/BpeLab";
import { AttentionLab, AttentionMatrixLab } from "@/components/viz/AttentionLab";
import { CodeBlock, MdxPre } from "@/components/code/Code";
import { CodeChoice } from "@/components/code/CodeChoice";
import { Parsons } from "@/components/code/Parsons";
import { PandasLab, BroadcastLab, PipelineLab, FeatureLab, DriftLab } from "@/components/viz/PracticeLabs";
import { SqlLab } from "@/components/viz/SqlLab";
import { TransformerSizeLab, LoraLab, SamplingLab, InferenceLab, RagLab } from "@/components/viz/LlmLabs";
import { RegLab, ConvLab, TransferLab, EmbeddingLab, RnnLab } from "@/components/viz/DlLabs";
import { NormBalls } from "@/components/viz/NormBalls";
import { LearningCurves } from "@/components/viz/LearningCurves";

// Composants disponibles dans toutes les leçons MDX, sans import.
const components: MDXComponents = { Predict, Quiz, Callout, Exercise, Interview, Recap, FicheSection, LessonComplete, ThresholdLab, BayesLab, GradientLab, CltLab, PolyFitLab, AbLab, CiLab, RidgeLab, CvLab, LeakLab, KnnLab, TreeLab, SigmoidLab, LogRegLab, ForestLab, BoostLab, KMeansLab, NeuralLab, BackpropLab, TrainLoopLab, BpeLab, AttentionLab, AttentionMatrixLab, PandasLab, BroadcastLab, PipelineLab, FeatureLab, DriftLab, SqlLab, TransformerSizeLab, LoraLab, SamplingLab, InferenceLab, RagLab, RegLab, ConvLab, TransferLab, EmbeddingLab, RnnLab, CodeBlock, CodeChoice, Parsons, pre: MdxPre, NormBalls, LearningCurves };

export function useMDXComponents(): MDXComponents {
  return components;
}
