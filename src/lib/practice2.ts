// Module 5 (suite) : séries temporelles, interprétabilité, optimisation d'hyperparamètres.
import { mulberry32, normals } from "./metrics";

// ============================================================ Séries temporelles

/** Effet du jour de la semaine (lundi → dimanche), de somme nulle. */
export const WEEKLY = [-8, -6, -2, 3, 12, 20, -19];
export const TS_DAYS = 140;
export const TS_TEST = 28;

/** Ventes quotidiennes : niveau + tendance + saisonnalité hebdomadaire + bruit. */
export const SALES: number[] = (() => {
  const z = normals(TS_DAYS, 909);
  return Array.from({ length: TS_DAYS }, (_, t) => Math.round(100 + 0.4 * t + WEEKLY[t % 7] + 6 * z[t]));
})();

export type ForecastModel = "naive" | "saisonnier" | "moyenne" | "regression";

/** Prévoit les `h` jours qui suivent la série `train` (prévision faite une seule fois, à la fin du train). */
export function forecast(model: ForecastModel, train: number[], h: number): number[] {
  const n = train.length;
  if (model === "naive") return Array(h).fill(train[n - 1]);
  if (model === "saisonnier") return Array.from({ length: h }, (_, i) => train[n - 7 + (i % 7)]);
  if (model === "moyenne") {
    const m = train.slice(-7).reduce((a, b) => a + b, 0) / 7;
    return Array(h).fill(m);
  }
  // Régression : niveau + tendance + 6 indicatrices de jour (moindres carrés)
  const X = train.map((_, t) => feat(t));
  const beta = leastSquares(X, train);
  return Array.from({ length: h }, (_, i) => dot(feat(n + i), beta));
}

const feat = (t: number) => [1, t, ...[1, 2, 3, 4, 5, 6].map((d) => (t % 7 === d ? 1 : 0))];
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

function leastSquares(X: number[][], y: number[]) {
  const p = X[0].length;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const b = Array.from({ length: p }, (_, i) => X.reduce((s, r, k) => s + r[i] * y[k], 0));
  // Élimination de Gauss avec pivot partiel
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = c + 1; r < p; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < p; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = Array(p).fill(0);
  for (let r = p - 1; r >= 0; r--) x[r] = (b[r] - A[r].slice(r + 1).reduce((s, v, k) => s + v * x[r + 1 + k], 0)) / A[r][r];
  return x;
}

export const maeOf = (y: number[], p: number[]) => y.reduce((s, v, i) => s + Math.abs(v - p[i]), 0) / y.length;

export function backtest(model: ForecastModel, horizon: number) {
  const train = SALES.slice(0, TS_DAYS - TS_TEST);
  const test = SALES.slice(TS_DAYS - TS_TEST, TS_DAYS - TS_TEST + horizon);
  const pred = forecast(model, train, horizon);
  return { train, test, pred, mae: maeOf(test, pred) };
}

// ============================================================ Interprétabilité

export type CreditFeature = "endettement" | "revenu" | "anciennete" | "incidents";
export const CREDIT_FEATURES: { id: CreditFeature; label: string; unit: string }[] = [
  { id: "endettement", label: "Taux d'endettement", unit: "%" },
  { id: "revenu", label: "Revenu mensuel", unit: "k€" },
  { id: "anciennete", label: "Ancienneté professionnelle", unit: "ans" },
  { id: "incidents", label: "Incidents de paiement", unit: "" },
];
/** Poids du modèle (en log-odds d'accord). */
export const CREDIT_W: Record<CreditFeature, number> = { endettement: -0.09, revenu: 0.7, anciennete: 0.12, incidents: -1.1 };
const CREDIT_B = 0;

export type Applicant = Record<CreditFeature, number> & { id: number };

/** Population de référence (pour la valeur de base et l'importance par permutation). */
export const POPULATION: Applicant[] = (() => {
  const z = normals(4 * 2000, 31);
  const u = mulberry32(77);
  return Array.from({ length: 2000 }, (_, i) => ({
    id: i,
    endettement: Math.max(5, 30 + 9 * z[4 * i]),
    revenu: Math.max(1.2, 3 + 1 * z[4 * i + 1]),
    anciennete: Math.max(0, 6 + 4 * z[4 * i + 2]),
    incidents: u() < 0.75 ? 0 : u() < 0.7 ? 1 : 2,
  }));
})();

export const CLIENTS: (Applicant & { nom: string })[] = [
  { id: 1, nom: "Client A", endettement: 45, revenu: 3.2, anciennete: 4, incidents: 0 },
  { id: 2, nom: "Client B", endettement: 22, revenu: 2.4, anciennete: 1, incidents: 2 },
  { id: 3, nom: "Client C", endettement: 25, revenu: 4.5, anciennete: 12, incidents: 0 },
  { id: 4, nom: "Client D", endettement: 52, revenu: 5.5, anciennete: 15, incidents: 0 },
  { id: 5, nom: "Client E", endettement: 38, revenu: 1.6, anciennete: 2, incidents: 0 },
  { id: 6, nom: "Client F", endettement: 28, revenu: 1.6, anciennete: 5, incidents: 0 },
];

const logit = (a: Record<CreditFeature, number>) => CREDIT_B + CREDIT_FEATURES.reduce((s, f) => s + CREDIT_W[f.id] * a[f.id], 0);
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const MEANS = Object.fromEntries(CREDIT_FEATURES.map((f) => [f.id, POPULATION.reduce((s, p) => s + p[f.id], 0) / POPULATION.length])) as Record<CreditFeature, number>;
export const BASE_LOGIT = logit(MEANS);

/** Valeurs SHAP exactes en log-odds : pour un modèle additif, φ_i = w_i (x_i − E[x_i]). */
export function shapValues(a: Applicant) {
  const phi = Object.fromEntries(CREDIT_FEATURES.map((f) => [f.id, CREDIT_W[f.id] * (a[f.id] - MEANS[f.id])])) as Record<CreditFeature, number>;
  return { base: BASE_LOGIT, phi, logit: logit(a), proba: sigmoid(logit(a)) };
}

/** Étiquettes simulées à partir du modèle (sert à l'importance par permutation). */
const LABELS = (() => {
  const u = mulberry32(5);
  return POPULATION.map((p) => (u() < sigmoid(logit(p)) ? 1 : 0));
})();

const logloss = (ps: number[]) => -ps.reduce((s, p, i) => s + (LABELS[i] ? Math.log(p) : Math.log(1 - p)), 0) / ps.length;

/**
 * Importance par permutation : hausse de log loss quand on mélange une variable.
 * Avec `withCopy`, le modèle réentraîné répartit le poids du revenu entre le revenu et une copie très corrélée (revenu déclaré).
 */
export function permutationImportance(withCopy: boolean) {
  const order = (() => {
    const u = mulberry32(99);
    const idx = POPULATION.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(u() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  })();
  const zc = normals(POPULATION.length, 404);
  const copy = POPULATION.map((p, i) => p.revenu + 0.15 * zc[i]);
  const predict = (rows: Applicant[], cp: number[]) =>
    rows.map((r, i) => {
      const w = CREDIT_W.revenu;
      const l = CREDIT_B + CREDIT_W.endettement * r.endettement + CREDIT_W.anciennete * r.anciennete + CREDIT_W.incidents * r.incidents;
      return sigmoid(withCopy ? l + (w / 2) * r.revenu + (w / 2) * cp[i] : l + w * r.revenu);
    });
  const ref = logloss(predict(POPULATION, copy));
  const out: { id: string; label: string; importance: number }[] = CREDIT_FEATURES.map((f) => {
    const rows = POPULATION.map((r, i) => ({ ...r, [f.id]: POPULATION[order[i]][f.id] }));
    return { id: f.id, label: f.label, importance: logloss(predict(rows, copy)) - ref };
  });
  if (withCopy) out.push({ id: "copie", label: "Revenu déclaré (copie corrélée)", importance: logloss(predict(POPULATION, order.map((k) => copy[k]))) - ref });
  return out;
}

// ============================================================ Optimisation d'hyperparamètres

/** Score de validation (simulé, lisse) : le learning rate compte beaucoup, la profondeur peu. */
export const hpScore = (logLr: number, depth: number) => 0.9 - 0.08 * (logLr + 1.6) ** 2 - 0.0015 * (depth - 6) ** 2;
export const HP_LR: [number, number] = [-3, -0.5];
export const HP_DEPTH: [number, number] = [2, 12];
export const HP_BEST = hpScore(-1.6, 6);

export type HpMethod = "grille" | "aleatoire" | "bayesienne";
export type HpPoint = { logLr: number; depth: number; score: number };

export function hpSearch(method: HpMethod, budget: number, seed: number): HpPoint[] {
  const ev = (logLr: number, depth: number) => ({ logLr, depth, score: hpScore(logLr, depth) });
  if (method === "grille") {
    const side = Math.max(1, Math.floor(Math.sqrt(budget)));
    const lrs = Array.from({ length: side }, (_, i) => -3 + (i * 2) / Math.max(1, side - 1) * 1);
    const ds = Array.from({ length: side }, (_, i) => Math.round(HP_DEPTH[0] + (i * (HP_DEPTH[1] - HP_DEPTH[0])) / Math.max(1, side - 1)));
    return lrs.flatMap((l) => ds.map((d) => ev(l, d))).slice(0, budget);
  }
  const u = mulberry32(seed);
  const rand = () => ev(HP_LR[0] + u() * (HP_LR[1] - HP_LR[0]), Math.round(HP_DEPTH[0] + u() * (HP_DEPTH[1] - HP_DEPTH[0])));
  if (method === "aleatoire") return Array.from({ length: budget }, rand);
  // Bayésienne (simplifiée) : 3 points aléatoires, puis le candidat qui maximise moyenne estimée + bonus d'exploration.
  const pts: HpPoint[] = Array.from({ length: Math.min(3, budget) }, rand);
  const cands = Array.from({ length: 300 }, () => ({ logLr: HP_LR[0] + u() * (HP_LR[1] - HP_LR[0]), depth: Math.round(HP_DEPTH[0] + u() * (HP_DEPTH[1] - HP_DEPTH[0])) }));
  while (pts.length < budget) {
    let best = cands[0];
    let bestA = -Infinity;
    for (const c of cands) {
      let wsum = 0;
      let msum = 0;
      let dmin = Infinity;
      for (const p of pts) {
        const d2 = ((c.logLr - p.logLr) / 0.5) ** 2 + ((c.depth - p.depth) / 4) ** 2;
        const w = Math.exp(-d2);
        wsum += w;
        msum += w * p.score;
        dmin = Math.min(dmin, Math.sqrt(d2));
      }
      if (dmin < 0.05) continue;
      const mean = wsum > 1e-9 ? msum / wsum : 0.8;
      const a = mean + 0.02 * Math.min(dmin, 2);
      if (a > bestA) {
        bestA = a;
        best = c;
      }
    }
    pts.push(ev(best.logLr, best.depth));
  }
  return pts;
}

export const bestOf = (pts: HpPoint[]) => pts.reduce((a, p) => (p.score > a.score ? p : a), pts[0]);
