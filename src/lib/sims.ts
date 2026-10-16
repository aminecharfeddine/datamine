// Calculs purs des labos (Bayes, descente de gradient, TCL, régression polynomiale).
import { mulberry32, normals } from "./metrics";

// ============================================================ Bayes

export type BayesParams = { prevalence: number; sensitivity: number; specificity: number };

/** Effectifs attendus dans une population de taille n, et valeur prédictive positive. */
export function bayes({ prevalence, sensitivity, specificity }: BayesParams, n = 2000) {
  const sick = prevalence * n;
  const healthy = n - sick;
  const tp = sick * sensitivity;
  const fn = sick - tp;
  const tn = healthy * specificity;
  const fp = healthy - tn;
  const ppv = tp + fp === 0 ? 0 : tp / (tp + fp); // P(malade | test +)
  const npv = tn + fn === 0 ? 0 : tn / (tn + fn); // P(sain | test −)
  return { tp, fn, fp, tn, ppv, npv };
}

/** Arrondit des effectifs réels en entiers dont la somme vaut exactement n (méthode du plus grand reste). */
export function roundCounts(values: number[], n: number) {
  const floors = values.map(Math.floor);
  let rest = n - floors.reduce((a, b) => a + b, 0);
  const order = values.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floors[i]++;
    rest--;
  }
  return floors;
}

// ============================================================ Descente de gradient

/** Fonction de perte 1D non convexe : minimum global à gauche, minimum local à droite. */
export const loss = (w: number) => 0.25 * w ** 4 - w ** 2 + 0.3 * w + 1.5;
export const grad = (w: number) => w ** 3 - 2 * w + 0.3;
export const W_DOMAIN: [number, number] = [-2.5, 2.5];

/** Newton pour trouver les zéros de la dérivée près d'un point de départ. */
function criticalNear(w: number) {
  for (let i = 0; i < 50; i++) w -= grad(w) / (3 * w ** 2 - 2);
  return w;
}
export const W_GLOBAL = criticalNear(-1.5); // ≈ -1,48
export const W_LOCAL = criticalNear(1.3); // ≈ 1,33
export const W_PEAK = criticalNear(0.15); // maximum local qui sépare les deux bassins

export type GdPath = { ws: number[]; diverged: boolean };

/** Applique `steps` pas de descente de gradient à partir de la fin du chemin. */
export function gdSteps(path: GdPath, lr: number, steps: number): GdPath {
  if (path.diverged) return path;
  const ws = [...path.ws];
  for (let i = 0; i < steps; i++) {
    const w = ws[ws.length - 1];
    const next = w - lr * grad(w);
    if (!Number.isFinite(next) || Math.abs(next) > 3) return { ws: [...ws, Math.sign(next || 1) * 3], diverged: true };
    ws.push(next);
  }
  return { ws, diverged: false };
}

// ============================================================ Théorème central limite

export type DistId = "uniforme" | "exponentielle" | "bimodale" | "de";

export type Dist = {
  id: DistId;
  label: string;
  mean: number;
  sd: number;
  domain: [number, number];
  sample: (r: () => number) => number;
  discrete?: boolean;
};

export const DISTS: Record<DistId, Dist> = {
  uniforme: { id: "uniforme", label: "Uniforme", mean: 0.5, sd: Math.sqrt(1 / 12), domain: [0, 1], sample: (r) => r() },
  exponentielle: {
    id: "exponentielle",
    label: "Exponentielle",
    mean: 1,
    sd: 1,
    domain: [0, 5],
    sample: (r) => -Math.log(1 - r()),
  },
  bimodale: {
    id: "bimodale",
    label: "Bimodale",
    // mélange 50/50 de N(1, 0,5) et N(4, 0,5)
    mean: 2.5,
    sd: Math.sqrt(0.25 + 2.25),
    domain: [-0.5, 5.5],
    sample: (r) => {
      const u = Math.max(r(), 1e-12);
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
      return (r() < 0.5 ? 1 : 4) + 0.5 * z;
    },
  },
  de: {
    id: "de",
    label: "Dé à 6 faces",
    mean: 3.5,
    sd: Math.sqrt(35 / 12),
    domain: [0.5, 6.5],
    sample: (r) => 1 + Math.floor(r() * 6),
    discrete: true,
  },
};

export function sampleMeans(dist: Dist, n: number, count: number, rand: () => number) {
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += dist.sample(rand);
    out.push(s / n);
  }
  return out;
}

export function meanSd(xs: number[]) {
  if (xs.length === 0) return { mean: 0, sd: 0 };
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1);
  return { mean: m, sd: Math.sqrt(v) };
}

export function binCounts(xs: number[], [lo, hi]: [number, number], bins: number) {
  const c = new Array(bins).fill(0);
  for (const x of xs) {
    if (x < lo || x > hi) continue;
    c[Math.min(bins - 1, Math.floor(((x - lo) / (hi - lo)) * bins))]++;
  }
  return c;
}

export const normalPdf = (x: number, mu: number, sd: number) =>
  Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

// ============================================================ Régression polynomiale (bias-variance)

export const trueFn = (x: number) => Math.sin(Math.PI * x) + 0.3 * x;

export type Pt = { x: number; y: number };

export function makePoints(n: number, noise: number, seed: number): Pt[] {
  const r = mulberry32(seed);
  const z = normals(n, seed + 1);
  return Array.from({ length: n }, (_, i) => {
    const x = r() * 2 - 1;
    return { x, y: trueFn(x) + noise * z[i] };
  });
}

/** Base de Tchebychev T_0..T_d sur [-1, 1] : bien mieux conditionnée que 1, x, x², … */
function cheb(x: number, d: number) {
  const t = [1, x];
  for (let k = 2; k <= d; k++) t.push(2 * x * t[k - 1] - t[k - 2]);
  return t.slice(0, d + 1);
}

/** Moindres carrés (avec une ridge minuscule pour la stabilité numérique). Renvoie la fonction ajustée. */
export function polyFit(pts: Pt[], degree: number, ridge = 1e-6) {
  const p = degree + 1;
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const b = new Array(p).fill(0);
  for (const { x, y } of pts) {
    const t = cheb(x, degree);
    for (let i = 0; i < p; i++) {
      b[i] += t[i] * y;
      for (let j = 0; j < p; j++) A[i][j] += t[i] * t[j];
    }
  }
  for (let i = 0; i < p; i++) A[i][i] += ridge;
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
  const coef = new Array(p).fill(0);
  for (let r = p - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < p; k++) s -= A[r][k] * coef[k];
    coef[r] = s / A[r][r];
  }
  return (x: number) => cheb(x, degree).reduce((s, t, i) => s + t * coef[i], 0);
}

export const mse = (f: (x: number) => number, pts: Pt[]) =>
  pts.reduce((s, { x, y }) => s + (f(x) - y) ** 2, 0) / pts.length;

export const MAX_DEGREE = 15;

/** Erreurs train / test pour chaque degré 0..MAX_DEGREE. */
export function errorCurve(train: Pt[], test: Pt[]) {
  return Array.from({ length: MAX_DEGREE + 1 }, (_, d) => {
    const f = polyFit(train, d);
    return { degree: d, train: mse(f, train), test: mse(f, test) };
  });
}

/** Jeux train / test du labo bias-variance (le test est grand et fixe pour mesurer la généralisation). */
export function makeBvData(n: number, noise: number, seed = 11) {
  return { train: makePoints(n, noise, seed), test: makePoints(400, noise, 9001) };
}
