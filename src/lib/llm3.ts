// Module 7 (suite) : évaluer un LLM avec un juge, et ses biais.
import { normals } from "./metrics";

export const JUDGE_N = 60;

/** Pour chaque prompt : qualité réelle de B par rapport à A (en log-odds), et écart de longueur (A est plus bavard). */
const PROMPTS = (() => {
  const z = normals(2 * JUDGE_N, 808);
  return Array.from({ length: JUDGE_N }, (_, i) => ({ delta: 0.35 + 1.2 * z[2 * i], longer: 0.6 + 0.3 * z[2 * i + 1] }));
})();

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Taux de victoire réel de B (ce que diraient des annotateurs humains attentifs, en moyenne). */
export const TRUE_WIN_B = PROMPTS.reduce((s, p) => s + sigmoid(p.delta), 0) / JUDGE_N;

export type JudgeOrder = "A-first" | "B-first" | "both";
export type JudgeSetup = { order: JudgeOrder; lengthControl: boolean; positionBias: number; lengthBias: number };

/**
 * Taux de victoire de B estimé par un juge LLM (espérance, pas de tirage) :
 * logit = vraie préférence + biais de position (favorise la réponse placée en premier) − biais de longueur (favorise A, plus long).
 */
export function judgeWinRate({ order, lengthControl, positionBias, lengthBias }: JudgeSetup) {
  const lb = lengthControl ? lengthBias * 0.15 : lengthBias;
  const pB = (bFirst: boolean) => PROMPTS.reduce((s, p) => s + sigmoid(p.delta + (bFirst ? positionBias : -positionBias) - lb * p.longer), 0) / JUDGE_N;
  if (order === "A-first") return pB(false);
  if (order === "B-first") return pB(true);
  return (pB(true) + pB(false)) / 2;
}

/** Nombre de jugements nécessaires (appels au juge) pour la configuration. */
export const judgeCalls = (order: JudgeOrder) => (order === "both" ? 2 * JUDGE_N : JUDGE_N);

export const JUDGE_TOLERANCE = 0.02;
export const JUDGE_POSITION_BIAS = 0.6;
export const JUDGE_LENGTH_BIAS = 0.5;
