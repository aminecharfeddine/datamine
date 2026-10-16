// Métriques de classification binaire + générateur de dataset synthétique.
// Tout est pur et déterministe : facile à tester et à réutiliser dans les viz.

export type Sample = { score: number; label: 0 | 1 };

export type Confusion = { tp: number; fp: number; fn: number; tn: number };

export type Metrics = Confusion & {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  specificity: number;
  fpr: number;
};

/** PRNG déterministe (mulberry32) pour que la viz soit identique à chaque visite. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Échantillons N(0,1) via Box-Muller. */
export function normals(n: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    out.push(r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v));
  }
  return out.slice(0, n);
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const POS_Z = normals(1000, 7);
const NEG_Z = normals(1000, 42);

/**
 * Dataset de scores d'un "modèle" fictif.
 * @param separation écart entre les deux classes (0 = modèle aléatoire, 4 = excellent)
 * @param prevalence proportion de positifs (0.5 = équilibré, 0.05 = rare)
 * @param n taille totale (≤ 1000)
 */
export function makeDataset(separation: number, prevalence: number, n = 500): Sample[] {
  const nPos = Math.max(1, Math.round(n * prevalence));
  const nNeg = Math.max(1, n - nPos);
  const half = separation / 2;
  const pos = POS_Z.slice(0, nPos).map((z) => ({ score: sigmoid(z + half), label: 1 as const }));
  const neg = NEG_Z.slice(0, nNeg).map((z) => ({ score: sigmoid(z - half), label: 0 as const }));
  return [...pos, ...neg];
}

/** Prédiction positive si score >= seuil. */
export function confusion(data: Sample[], threshold: number): Confusion {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const { score, label } of data) {
    const pred = score >= threshold;
    if (pred && label === 1) tp++;
    else if (pred && label === 0) fp++;
    else if (!pred && label === 1) fn++;
    else tn++;
  }
  return { tp, fp, fn, tn };
}

const safe = (num: number, den: number, fallback = 0) => (den === 0 ? fallback : num / den);

export function metricsFrom(c: Confusion): Metrics {
  // Convention : precision = 1 quand aucun positif n'est prédit (aucune fausse alerte).
  const precision = safe(c.tp, c.tp + c.fp, 1);
  const recall = safe(c.tp, c.tp + c.fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const total = c.tp + c.fp + c.fn + c.tn;
  return {
    ...c,
    precision,
    recall,
    f1,
    accuracy: safe(c.tp + c.tn, total),
    specificity: safe(c.tn, c.tn + c.fp),
    fpr: safe(c.fp, c.fp + c.tn),
  };
}

export function metricsAt(data: Sample[], threshold: number): Metrics {
  return metricsFrom(confusion(data, threshold));
}

export type CurvePoint = { threshold: number; x: number; y: number };

/** Seuils candidats : chaque score distinct + les bornes. */
function thresholds(data: Sample[]): number[] {
  const s = Array.from(new Set(data.map((d) => d.score))).sort((a, b) => b - a);
  return [Infinity, ...s, -Infinity];
}

/** Courbe ROC : x = FPR, y = TPR (recall), du seuil le plus strict au plus laxiste. */
export function rocCurve(data: Sample[]): CurvePoint[] {
  return thresholds(data).map((t) => {
    const m = metricsAt(data, t);
    return { threshold: t, x: m.fpr, y: m.recall };
  });
}

/** Courbe Precision-Recall : x = recall, y = precision. */
export function prCurve(data: Sample[]): CurvePoint[] {
  return thresholds(data)
    .filter((t) => t !== Infinity)
    .map((t) => {
      const m = metricsAt(data, t);
      return { threshold: t, x: m.recall, y: m.precision };
    });
}

/** Aire sous la courbe par la méthode des trapèzes (points triés par x croissant). */
export function auc(points: { x: number; y: number }[]): number {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  let area = 0;
  for (let i = 1; i < p.length; i++) area += ((p[i].x - p[i - 1].x) * (p[i].y + p[i - 1].y)) / 2;
  return area;
}

/** Histogramme des scores par classe sur [0,1]. */
export function histogram(data: Sample[], bins = 25) {
  const pos = new Array(bins).fill(0);
  const neg = new Array(bins).fill(0);
  for (const { score, label } of data) {
    const i = Math.min(bins - 1, Math.floor(score * bins));
    (label === 1 ? pos : neg)[i]++;
  }
  return { pos, neg, bins };
}
