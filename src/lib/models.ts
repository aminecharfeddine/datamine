// Calculs purs des labos « modèles » (suite) : régression logistique, forêts, boosting, k-means.
import { mulberry32, normals } from "./metrics";
import { MOON_TRAIN, type P2 } from "./ml";

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clip = (p: number) => Math.min(1 - 1e-9, Math.max(1e-9, p));

/** Résout A x = b (élimination de Gauss avec pivot partiel). A et b sont recopiés. */
export function solve(A0: number[][], b0: number[]) {
  const n = b0.length;
  const A = A0.map((r) => [...r]);
  const b = [...b0];
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

/**
 * Régression logistique par la méthode de Newton (IRLS), avec une petite pénalité L2
 * (jamais sur la constante, en colonne 0). X contient déjà la colonne de 1.
 */
export function fitLogistic(X: number[][], y: number[], l2 = 1e-4, iters = 40) {
  const p = X[0].length;
  let w = new Array(p).fill(0);
  for (let it = 0; it < iters; it++) {
    const H = Array.from({ length: p }, () => new Array(p).fill(0));
    const g = new Array(p).fill(0);
    X.forEach((xi, i) => {
      const pi = sigmoid(xi.reduce((s, v, j) => s + v * w[j], 0));
      const s = pi * (1 - pi) + 1e-9;
      for (let a = 0; a < p; a++) {
        g[a] += (pi - y[i]) * xi[a];
        for (let b = 0; b < p; b++) H[a][b] += s * xi[a] * xi[b];
      }
    });
    for (let a = 1; a < p; a++) {
      g[a] += l2 * X.length * w[a];
      H[a][a] += l2 * X.length;
    }
    const step = solve(H, g);
    w = w.map((v, j) => v - step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-9) break;
  }
  return w;
}

// ============================================================ Régression logistique, 1 variable

export type Study = { x: number; y: 0 | 1 };

/** Heures de révision (0 à 10) et réussite à l'examen : plus on révise, plus on réussit, sans garantie. */
export function studyData(n = 40, seed = 5): Study[] {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const x = Math.round(r() * 100) / 10;
    return { x, y: (r() < sigmoid(1.1 * (x - 5)) ? 1 : 0) as 0 | 1 };
  });
}
export const STUDY = studyData();

/** p(réussite | x) avec une pente w et un point de bascule x0 (là où p = 0,5). */
export const logit1 = (w: number, x0: number) => (x: number) => sigmoid(w * (x - x0));

export const logLoss = (f: (x: number) => number, pts: Study[]) =>
  pts.reduce((s, p) => s - (p.y ? Math.log(clip(f(p.x))) : Math.log(1 - clip(f(p.x)))), 0) / pts.length;

export const accuracy1 = (f: (x: number) => number, pts: Study[]) => pts.filter((p) => (f(p.x) >= 0.5 ? 1 : 0) === p.y).length / pts.length;

/** Meilleurs (w, x0) au sens de la log-loss. */
export function fitStudy(pts: Study[]) {
  const [b, a] = fitLogistic(
    pts.map((p) => [1, p.x]),
    pts.map((p) => p.y),
    0,
  );
  return { w: a, x0: -b / a };
}

// ============================================================ Régression logistique 2D, variables polynomiales

/** Monômes x^i y^j avec 1 ≤ i + j ≤ degré. */
export function monomials(degree: number) {
  const out: [number, number][] = [];
  for (let d = 1; d <= degree; d++) for (let i = d; i >= 0; i--) out.push([i, d - i]);
  return out;
}

export type LogRegModel = { degree: number; w: number[]; mu: number[]; sd: number[]; terms: [number, number][] };

export function fitPolyLogistic(train: P2[], degree: number, l2 = 1e-3): LogRegModel {
  const terms = monomials(degree);
  const raw = train.map((p) => terms.map(([i, j]) => p.x ** i * p.y ** j));
  const mu = terms.map((_, k) => raw.reduce((s, r) => s + r[k], 0) / raw.length);
  const sd = terms.map((_, k) => Math.sqrt(raw.reduce((s, r) => s + (r[k] - mu[k]) ** 2, 0) / raw.length) || 1);
  const X = raw.map((r) => [1, ...r.map((v, k) => (v - mu[k]) / sd[k])]);
  return { degree, terms, mu, sd, w: fitLogistic(X, train.map((p) => p.c), l2) };
}

export function polyLogitProba(m: LogRegModel) {
  return (x: number, y: number) => {
    let z = m.w[0];
    m.terms.forEach(([i, j], k) => (z += (m.w[k + 1] * (x ** i * y ** j - m.mu[k])) / m.sd[k]));
    return sigmoid(z);
  };
}

// ============================================================ Forêt aléatoire

type Node = { leaf: true; v: number } | { leaf: false; feat: "x" | "y"; thr: number; left: Node; right: Node };

export const predictNode = (n: Node, x: number, y: number) => {
  while (!n.leaf) n = (n.feat === "x" ? x : y) <= n.thr ? n.left : n.right;
  return n.v;
};

const giniOf = (n1: number, n: number) => (n === 0 ? 0 : 1 - (n1 / n) ** 2 - ((n - n1) / n) ** 2);

/** Meilleure coupe de Gini sur une variable, ou null si aucune coupe n'améliore. */
function bestGiniSplit(pts: P2[], feat: "x" | "y") {
  const n = pts.length;
  const n1 = pts.reduce((s, p) => s + p.c, 0);
  const sorted = [...pts].sort((a, b) => a[feat] - b[feat]);
  let best = { score: giniOf(n1, n) - 1e-12, thr: NaN };
  let left1 = 0;
  for (let i = 1; i < n; i++) {
    left1 += sorted[i - 1].c;
    if (sorted[i][feat] === sorted[i - 1][feat]) continue;
    const score = (i / n) * giniOf(left1, i) + ((n - i) / n) * giniOf(n1 - left1, n - i);
    if (score < best.score) best = { score, thr: (sorted[i][feat] + sorted[i - 1][feat]) / 2 };
  }
  return Number.isNaN(best.thr) ? null : best.thr;
}

/** Arbre complet, mais à chaque nœud une seule variable tirée au hasard (max_features = 1). */
function randomTree(pts: P2[], rand: () => number, depth = 0): Node {
  const n1 = pts.reduce((s, p) => s + p.c, 0);
  const major = n1 * 2 >= pts.length ? 1 : 0;
  if (n1 === 0 || n1 === pts.length || pts.length < 2 || depth >= 20) return { leaf: true, v: major };
  const first = rand() < 0.5 ? "x" : "y";
  for (const feat of [first, first === "x" ? "y" : "x"] as const) {
    const thr = bestGiniSplit(pts, feat);
    if (thr === null) continue;
    return {
      leaf: false,
      feat,
      thr,
      left: randomTree(pts.filter((p) => p[feat] <= thr), rand, depth + 1),
      right: randomTree(pts.filter((p) => p[feat] > thr), rand, depth + 1),
    };
  }
  return { leaf: true, v: major };
}

export const FOREST_MAX = 100;

/** Forêt : chaque arbre voit un échantillon bootstrap (tirage avec remise) du jeu d'entraînement. */
export function buildForest(train: P2[] = MOON_TRAIN, count = FOREST_MAX, seed = 9): Node[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const boot = Array.from({ length: train.length }, () => train[Math.floor(rand() * train.length)]);
    return randomTree(boot, rand);
  });
}

/** Votes cumulés : pour chaque requête, prédiction de la forêt de t arbres, t = 1..count. */
export function forestVotes(forest: Node[], queries: { x: number; y: number }[]) {
  return queries.map((q) => {
    const out = new Uint8Array(forest.length);
    let votes = 0;
    const first = predictNode(forest[0], q.x, q.y);
    forest.forEach((t, i) => {
      votes += predictNode(t, q.x, q.y);
      const n = i + 1;
      out[i] = votes * 2 > n ? 1 : votes * 2 < n ? 0 : first;
    });
    return out;
  });
}

/** Précision de la forêt selon le nombre d'arbres. */
export const forestCurve = (votes: Uint8Array[], pts: P2[]) =>
  Array.from({ length: votes[0].length }, (_, t) => votes.filter((v, i) => v[t] === pts[i].c).length / pts.length);

// ============================================================ Gradient boosting (log-loss, arbres de profondeur 2)

/** Arbre de régression sur les résidus r ; feuille = pas de Newton Σr / Σp(1−p). */
function regTree(pts: P2[], r: number[], h: number[], idx: number[], depth: number): Node {
  const leaf = (): Node => {
    const sr = idx.reduce((s, i) => s + r[i], 0);
    const sh = idx.reduce((s, i) => s + h[i], 0);
    return { leaf: true, v: sr / (sh + 1e-6) };
  };
  if (depth === 0 || idx.length < 4) return leaf();
  let best = { gain: 1e-12, feat: "x" as "x" | "y", thr: NaN };
  const total = idx.reduce((s, i) => s + r[i], 0);
  for (const feat of ["x", "y"] as const) {
    const sorted = [...idx].sort((a, b) => pts[a][feat] - pts[b][feat]);
    let left = 0;
    for (let k = 1; k < sorted.length; k++) {
      left += r[sorted[k - 1]];
      if (pts[sorted[k]][feat] === pts[sorted[k - 1]][feat]) continue;
      const right = total - left;
      // Réduction de la somme des carrés des résidus : on maximise Σ²/n de chaque côté.
      const gain = (left * left) / k + (right * right) / (sorted.length - k) - (total * total) / sorted.length;
      if (gain > best.gain) best = { gain, feat, thr: (pts[sorted[k]][feat] + pts[sorted[k - 1]][feat]) / 2 };
    }
  }
  if (Number.isNaN(best.thr)) return leaf();
  const f = best.feat, t = best.thr;
  return {
    leaf: false,
    feat: f,
    thr: t,
    left: regTree(pts, r, h, idx.filter((i) => pts[i][f] <= t), depth - 1),
    right: regTree(pts, r, h, idx.filter((i) => pts[i][f] > t), depth - 1),
  };
}

export const BOOST_MAX = 300;
export const BOOST_LRS = [0.05, 0.3, 1] as const;

export type Booster = { f0: number; lr: number; trees: Node[] };

export function trainBoosting(train: P2[], lr: number, rounds = BOOST_MAX, depth = 2): Booster {
  const n1 = train.reduce((s, p) => s + p.c, 0);
  const f0 = Math.log(n1 / (train.length - n1));
  const F = new Array(train.length).fill(f0);
  const idx = train.map((_, i) => i);
  const trees: Node[] = [];
  for (let m = 0; m < rounds; m++) {
    const p = F.map(sigmoid);
    const r = train.map((q, i) => q.c - p[i]);
    const h = p.map((v) => v * (1 - v));
    const t = regTree(train, r, h, idx, depth);
    trees.push(t);
    train.forEach((q, i) => (F[i] += lr * predictNode(t, q.x, q.y)));
  }
  return { f0, lr, trees };
}

/** Score F après m arbres pour chaque requête : tableau [requête][m-1]. */
export function boostScores(b: Booster, queries: { x: number; y: number }[]) {
  return queries.map((q) => {
    const out = new Float32Array(b.trees.length);
    let F = b.f0;
    b.trees.forEach((t, m) => {
      F += b.lr * predictNode(t, q.x, q.y);
      out[m] = F;
    });
    return out;
  });
}

export const boostCurve = (scores: Float32Array[], pts: P2[]) =>
  Array.from({ length: scores[0].length }, (_, m) => scores.filter((s, i) => (s[m] > 0 ? 1 : 0) === pts[i].c).length / pts.length);

// ============================================================ k-means

export type XY = { x: number; y: number };

/** Quatre groupes de tailles et d'étalements différents, sans étiquettes. */
export function blobs(seed = 4): XY[] {
  const centers = [
    { x: -2.2, y: 1.6, s: 0.5, n: 60 },
    { x: 1.8, y: 2.1, s: 0.6, n: 70 },
    { x: -0.6, y: -1.8, s: 0.55, n: 60 },
    { x: 2.6, y: -1.2, s: 0.45, n: 50 },
  ];
  const total = centers.reduce((s, c) => s + c.n, 0);
  const z = normals(2 * total, seed);
  let k = 0;
  return centers.flatMap((c) => Array.from({ length: c.n }, () => ({ x: c.x + c.s * z[k++], y: c.y + c.s * z[k++] })));
}
export const BLOBS = blobs();
export const BLOB_DOMAIN = { x: [-4, 4.5] as [number, number], y: [-3.6, 3.8] as [number, number] };
export const KMEANS_MAX_K = 8;

const d2 = (a: XY, b: XY) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function nearest(p: XY, cs: XY[]) {
  let best = 0;
  for (let j = 1; j < cs.length; j++) if (d2(p, cs[j]) < d2(p, cs[best])) best = j;
  return best;
}

export type InitMode = "random" | "pp";

/** Initialisation : k points tirés au hasard, ou k-means++ (chaque nouveau centre loin des précédents). */
export function initCentroids(pts: XY[], k: number, seed: number, mode: InitMode): XY[] {
  const rand = mulberry32(seed * 7919 + k);
  if (mode === "random") {
    const chosen = new Set<number>();
    while (chosen.size < k) chosen.add(Math.floor(rand() * pts.length));
    return [...chosen].map((i) => ({ ...pts[i] }));
  }
  const cs = [{ ...pts[Math.floor(rand() * pts.length)] }];
  while (cs.length < k) {
    const w = pts.map((p) => Math.min(...cs.map((c) => d2(p, c))));
    let t = rand() * w.reduce((a, b) => a + b, 0);
    let i = 0;
    while (t > w[i] && i < pts.length - 1) t -= w[i++];
    cs.push({ ...pts[i] });
  }
  return cs;
}

export const assignAll = (pts: XY[], cs: XY[]) => pts.map((p) => nearest(p, cs));

/** Chaque centre va au barycentre de ses points (un centre sans point ne bouge pas). */
export function recenter(pts: XY[], labels: number[], cs: XY[]): XY[] {
  return cs.map((c, j) => {
    const mine = pts.filter((_, i) => labels[i] === j);
    if (!mine.length) return c;
    return { x: mine.reduce((s, p) => s + p.x, 0) / mine.length, y: mine.reduce((s, p) => s + p.y, 0) / mine.length };
  });
}

export const inertia = (pts: XY[], labels: number[], cs: XY[]) => pts.reduce((s, p, i) => s + d2(p, cs[labels[i]]), 0);

/** Algorithme de Lloyd jusqu'à convergence. */
export function lloyd(pts: XY[], init: XY[], maxIter = 100) {
  let cs = init;
  let labels = assignAll(pts, cs);
  for (let it = 0; it < maxIter; it++) {
    const next = recenter(pts, labels, cs);
    const nl = assignAll(pts, next);
    const moved = next.some((c, j) => d2(c, cs[j]) > 1e-12);
    cs = next;
    labels = nl;
    if (!moved) break;
  }
  return { centroids: cs, labels, inertia: inertia(pts, labels, cs) };
}

/** Meilleure inertie connue pour chaque k (10 essais k-means++) : la courbe du coude. */
export function elbowCurve(pts: XY[] = BLOBS, maxK = KMEANS_MAX_K, tries = 10) {
  return Array.from({ length: maxK }, (_, i) => {
    const k = i + 1;
    let best = Infinity;
    for (let s = 1; s <= tries; s++) best = Math.min(best, lloyd(pts, initCentroids(pts, k, 1000 + s, "pp")).inertia);
    return best;
  });
}
