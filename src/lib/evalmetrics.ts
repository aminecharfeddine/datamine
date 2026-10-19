// Moteurs des labos du module Évaluation (suite) : régression, multiclasse, calibration, ranking.
// Tout est pur et déterministe.
import { mulberry32, normals } from "./metrics";

// ============================================================ Régression : prédiction constante

/** Délais de livraison (minutes), distribution asymétrique (log-normale), arrondis à la minute. */
export const DELAIS: number[] = normals(41, 2024).map((z) => Math.round(Math.exp(3.3 + 0.6 * z)));

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type RegMetrics = { mae: number; rmse: number; r2: number; mape: number; medae: number };

export function regMetrics(y: number[], pred: number[]): RegMetrics {
  const n = y.length;
  const err = y.map((v, i) => v - pred[i]);
  const mae = err.reduce((a, e) => a + Math.abs(e), 0) / n;
  const mse = err.reduce((a, e) => a + e * e, 0) / n;
  const my = mean(y);
  const sst = y.reduce((a, v) => a + (v - my) ** 2, 0);
  const r2 = 1 - (mse * n) / sst;
  const mape = y.reduce((a, v, i) => a + Math.abs(err[i]) / Math.abs(v), 0) / n;
  return { mae, rmse: Math.sqrt(mse), r2, mape, medae: median(err.map(Math.abs)) };
}

export const constMetrics = (c: number, y = DELAIS) => regMetrics(y, y.map(() => c));

export const CONST_MIN = 10;
export const CONST_MAX = 60;
export const CONST_STEP = 0.5;
export const CONST_GRID = Array.from({ length: (CONST_MAX - CONST_MIN) / CONST_STEP + 1 }, (_, i) => CONST_MIN + i * CONST_STEP);
export const BEST_MAE = Math.min(...CONST_GRID.map((c) => constMetrics(c).mae));
export const BEST_RMSE = Math.min(...CONST_GRID.map((c) => constMetrics(c).rmse));

// ============================================================ Multiclasse

export const MC_CLASSES = ["Facturation", "Livraison", "Technique", "Fraude"] as const;
export const MC_COUNTS = [400, 300, 220, 80];
const MC_TOTAL = MC_COUNTS.reduce((a, b) => a + b, 0);

type McSample = { y: number; s: number[] };

/** Scores d'un classifieur de tickets : la bonne classe a un score plus élevé, la fraude ressemble à la facturation. */
const MC_DATA: McSample[] = (() => {
  const z = normals(MC_TOTAL * 4, 77);
  const out: McSample[] = [];
  let k = 0;
  MC_COUNTS.forEach((count, y) => {
    for (let i = 0; i < count; i++) {
      const s = [0, 1, 2, 3].map((c) => (c === y ? 1.6 : 0) + z[k++]);
      if (y === 3) s[0] += 0.9; // une fraude ressemble souvent à un ticket de facturation
      s.forEach((_, c) => (s[c] += Math.log(MC_COUNTS[c] / MC_TOTAL))); // le modèle a appris les fréquences des classes
      out.push({ y, s });
    }
  });
  return out;
})();

export type ClassStats = { precision: number; recall: number; f1: number; support: number; tp: number; fp: number; fn: number };
export type McResult = { matrix: number[][]; perClass: ClassStats[]; accuracy: number; macroF1: number; weightedF1: number; microF1: number; macroRecall: number };

const f1of = (p: number, r: number) => (p + r ? (2 * p * r) / (p + r) : 0);

export function mcEvaluate(matrix: number[][]): McResult {
  const K = matrix.length;
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  const perClass = matrix.map((row, c) => {
    const tp = row[c];
    const support = row.reduce((a, b) => a + b, 0);
    const predicted = matrix.reduce((a, r) => a + r[c], 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    return { precision, recall, f1: f1of(precision, recall), support, tp, fp: predicted - tp, fn: support - tp };
  });
  const tp = perClass.reduce((a, s) => a + s.tp, 0);
  const fp = perClass.reduce((a, s) => a + s.fp, 0);
  const fn = perClass.reduce((a, s) => a + s.fn, 0);
  const microP = tp / (tp + fp);
  const microR = tp / (tp + fn);
  return {
    matrix,
    perClass,
    accuracy: tp / total,
    macroF1: perClass.reduce((a, s) => a + s.f1, 0) / K,
    weightedF1: perClass.reduce((a, s) => a + s.f1 * s.support, 0) / total,
    microF1: f1of(microP, microR),
    macroRecall: perClass.reduce((a, s) => a + s.recall, 0) / K,
  };
}

/** Matrice de confusion (lignes = vraie classe, colonnes = prédite) avec un poids w sur la classe Fraude. */
export function mcConfusion(fraudWeight: number): McResult {
  const b = Math.log(fraudWeight);
  const m = MC_CLASSES.map(() => MC_CLASSES.map(() => 0));
  for (const { y, s } of MC_DATA) {
    let best = 0;
    for (let c = 1; c < 4; c++) if (s[c] + (c === 3 ? b : 0) > s[best] + (best === 3 ? b : 0)) best = c;
    m[y][best]++;
  }
  return mcEvaluate(m);
}

export const MC_WEIGHTS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32];
export const MC_BEST_MACRO = Math.max(...MC_WEIGHTS.map((w) => mcConfusion(w).macroF1));

// ============================================================ Calibration

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export type CalModel = "boosting" | "regularise";
/** Facteur appliqué au vrai logit : > 1 surconfiant, < 1 sous-confiant. */
export const CAL_FACTOR: Record<CalModel, number> = { boosting: 2.2, regularise: 0.55 };

const CAL_N = 3000;
const CAL_DATA = (() => {
  const z = normals(CAL_N, 314);
  const u = mulberry32(2718);
  return z.map((v) => {
    const logit = 1.4 * v - 0.6;
    return { logit, y: u() < sigmoid(logit) ? 1 : 0 };
  });
})();

export type CalBin = { lo: number; hi: number; meanPred: number; freq: number; count: number };
export type CalResult = { bins: CalBin[]; ece: number; brier: number; logloss: number; auc: number; probs: number[] };

export function calibration(model: CalModel, temperature: number, nBins = 10): CalResult {
  const probs = CAL_DATA.map((d) => sigmoid((CAL_FACTOR[model] * d.logit) / temperature));
  const ys = CAL_DATA.map((d) => d.y);
  const bins: CalBin[] = Array.from({ length: nBins }, (_, i) => ({ lo: i / nBins, hi: (i + 1) / nBins, meanPred: 0, freq: 0, count: 0 }));
  probs.forEach((p, i) => {
    const b = bins[Math.min(nBins - 1, Math.floor(p * nBins))];
    b.count++;
    b.meanPred += p;
    b.freq += ys[i];
  });
  bins.forEach((b) => {
    if (b.count) {
      b.meanPred /= b.count;
      b.freq /= b.count;
    }
  });
  const n = probs.length;
  const ece = bins.reduce((a, b) => a + (b.count / n) * Math.abs(b.meanPred - b.freq), 0);
  const brier = probs.reduce((a, p, i) => a + (p - ys[i]) ** 2, 0) / n;
  const eps = 1e-12;
  const logloss = -probs.reduce((a, p, i) => a + (ys[i] ? Math.log(Math.max(p, eps)) : Math.log(Math.max(1 - p, eps))), 0) / n;
  return { bins, ece, brier, logloss, auc: aucOf(probs, ys), probs };
}

/** AUC par la statistique de Mann-Whitney (avec gestion des ex aequo). */
export function aucOf(scores: number[], ys: number[]) {
  const idx = scores.map((s, i) => [s, ys[i]] as const).sort((a, b) => a[0] - b[0]);
  let rankSum = 0;
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) if (idx[k][1]) rankSum += r;
    i = j + 1;
  }
  const nPos = ys.filter(Boolean).length;
  const nNeg = ys.length - nPos;
  return (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

export const CAL_ECE_TARGET = 0.02;

// ============================================================ Ranking

export type Doc = { id: string; title: string; grade: 0 | 1 | 2 | 3 };

export const RANK_QUERY = "rembourser une commande arrivée cassée";

/** Pertinence graduée : 3 = répond exactement, 2 = utile, 1 = vaguement lié, 0 = hors sujet. */
export const RANK_DOCS: Doc[] = [
  { id: "a", title: "Suivre une livraison en cours", grade: 0 },
  { id: "b", title: "Retourner un article : conditions générales", grade: 1 },
  { id: "c", title: "Produit endommagé à la réception : demander un remboursement", grade: 3 },
  { id: "d", title: "Moyens de paiement acceptés", grade: 0 },
  { id: "e", title: "Délais de remboursement selon le moyen de paiement", grade: 2 },
  { id: "f", title: "Photos à fournir pour un colis abîmé", grade: 2 },
  { id: "g", title: "Programme de fidélité", grade: 0 },
  { id: "h", title: "Contacter le service client", grade: 1 },
];

/** Classement produit par un moteur lexical naïf (ordre de départ du labo). */
export const RANK_START = ["b", "a", "e", "d", "c", "h", "f", "g"];

export const RANK_K = 5;

export type RankMetrics = { precision: number; recall: number; mrr: number; dcg: number; idcg: number; ndcg: number };

const gain = (g: number) => 2 ** g - 1;
const discount = (i: number) => Math.log2(i + 2);

export function rankMetrics(order: string[], docs = RANK_DOCS, k = RANK_K): RankMetrics {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const grades: number[] = order.map((id) => byId.get(id)!.grade);
  const relevant = (g: number) => g >= 2;
  const totalRel = docs.filter((d) => relevant(d.grade)).length;
  const top = grades.slice(0, k);
  const hits = top.filter(relevant).length;
  const first = grades.findIndex(relevant);
  const dcg = top.reduce((a, g, i) => a + gain(g) / discount(i), 0);
  const ideal = docs.map((d): number => d.grade).sort((a, b) => b - a).slice(0, k);
  const idcg = ideal.reduce((a, g, i) => a + gain(g) / discount(i), 0);
  return { precision: hits / k, recall: hits / totalRel, mrr: first < 0 ? 0 : 1 / (first + 1), dcg, idcg, ndcg: dcg / idcg };
}
