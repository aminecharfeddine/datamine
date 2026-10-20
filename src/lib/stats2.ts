// Module 1 (suite) : lois de probabilité et vraisemblance ; corrélation, confusion et paradoxe de Simpson.
import { mulberry32 } from "./metrics";

// ============================================================ Lois et vraisemblance

/** Nombre d'appels reçus par un service client en une heure, sur 200 heures (tirés d'une loi de Poisson). */
export const CALLS: number[] = (() => {
  const u = mulberry32(4242);
  const lambda = 3.6;
  return Array.from({ length: 200 }, () => {
    // Inversion de la fonction de répartition
    let k = 0;
    let p = Math.exp(-lambda);
    let s = p;
    const r = u();
    while (r > s && k < 30) {
      k++;
      p *= lambda / k;
      s += p;
    }
    return k;
  });
})();

export const CALLS_MAX = 12;

const logFact = (k: number) => {
  let s = 0;
  for (let i = 2; i <= k; i++) s += Math.log(i);
  return s;
};
export const poissonPmf = (k: number, l: number) => Math.exp(k * Math.log(l) - l - logFact(k));

export function normCdf(x: number) {
  // Approximation d'Abramowitz et Stegun (erreur < 1e-7)
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
/** Loi normale discrétisée : probabilité de [k − 0,5 ; k + 0,5]. */
export const normalPmf = (k: number, mu: number, sigma: number) => Math.max(1e-12, normCdf((k + 0.5 - mu) / sigma) - normCdf((k - 0.5 - mu) / sigma));

export type DistModel = { law: "poisson"; lambda: number } | { law: "normale"; mu: number; sigma: number };

export const pmfOf = (m: DistModel, k: number) => (m.law === "poisson" ? poissonPmf(k, m.lambda) : normalPmf(k, m.mu, m.sigma));

/** Log-vraisemblance moyenne par observation. */
export const avgLogLik = (m: DistModel, data = CALLS) => data.reduce((s, k) => s + Math.log(Math.max(1e-12, pmfOf(m, k))), 0) / data.length;

export const sampleMean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const sampleVar = (xs: number[]) => {
  const m = sampleMean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
};

export const LAMBDA_GRID = Array.from({ length: 71 }, (_, i) => Math.round((1 + i * 0.1) * 10) / 10);
export const BEST_POISSON_LL = Math.max(...LAMBDA_GRID.map((l) => avgLogLik({ law: "poisson", lambda: l })));

// ============================================================ Paradoxe de Simpson

/** Taux de guérison réels : le traitement A est meilleur dans chaque groupe de gravité. */
export const RATES = { A: { leger: 0.93, grave: 0.73 }, B: { leger: 0.87, grave: 0.69 } };
export const GROUP_SIZE = 500; // 500 patients légers, 500 graves

/**
 * `shareGraveA` : part des patients graves qui reçoivent A ; `shareLegerA` : part des patients légers qui reçoivent A.
 * Avec une répartition aléatoire, les deux valent 0,5.
 */
export function simpson(shareGraveA: number, shareLegerA: number) {
  const nA = { leger: GROUP_SIZE * shareLegerA, grave: GROUP_SIZE * shareGraveA };
  const nB = { leger: GROUP_SIZE - nA.leger, grave: GROUP_SIZE - nA.grave };
  const cured = (t: "A" | "B", n: { leger: number; grave: number }) => n.leger * RATES[t].leger + n.grave * RATES[t].grave;
  const globalA = cured("A", nA) / (nA.leger + nA.grave);
  const globalB = cured("B", nB) / (nB.leger + nB.grave);
  // Standardisation : taux qu'on observerait si chaque traitement était donné à toute la population (50 % graves)
  const adjA = (RATES.A.leger + RATES.A.grave) / 2;
  const adjB = (RATES.B.leger + RATES.B.grave) / 2;
  return { nA, nB, globalA, globalB, adjA, adjB, reversed: globalA < globalB };
}

/** Coefficient de corrélation de Pearson. */
export function pearson(x: number[], y: number[]) {
  const mx = sampleMean(x);
  const my = sampleMean(y);
  let sxy = 0, sxx = 0, syy = 0;
  x.forEach((v, i) => {
    sxy += (v - mx) * (y[i] - my);
    sxx += (v - mx) ** 2;
    syy += (y[i] - my) ** 2;
  });
  return sxy / Math.sqrt(sxx * syy);
}

/** Rangs (moyens en cas d'égalité), pour la corrélation de Spearman. */
function ranks(x: number[]) {
  const idx = x.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array(x.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r as number[];
}
export const spearman = (x: number[], y: number[]) => pearson(ranks(x), ranks(y));
