// Calculs purs des labos « modèles » : validation croisée, fuite de données, k-NN, arbres de décision.
import { mulberry32, normals } from "./metrics";
import { mse, polyFit, type Pt } from "./sims";

// ============================================================ Validation croisée

/** Permutation déterministe des indices 0..n-1 (Fisher-Yates). */
export function shuffledIndices(n: number, seed: number) {
  const r = mulberry32(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/** Affecte chaque exemple à un pli (0..k-1), après mélange. */
export function foldAssignment(n: number, k: number, seed = 3) {
  const order = shuffledIndices(n, seed);
  const fold = new Array(n).fill(0);
  order.forEach((idx, pos) => (fold[idx] = pos % k));
  return fold;
}

/** Erreur (MSE) de chaque pli pour un polynôme de degré donné. */
export function kfoldErrors(pts: Pt[], degree: number, k: number, seed = 3) {
  const fold = foldAssignment(pts.length, k, seed);
  return Array.from({ length: k }, (_, f) => {
    const train = pts.filter((_, i) => fold[i] !== f);
    const val = pts.filter((_, i) => fold[i] === f);
    return mse(polyFit(train, degree, 1e-6), val);
  });
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

export const CV_MAX_DEGREE = 12;

export function cvCurve(pts: Pt[], k: number, seed = 3) {
  return Array.from({ length: CV_MAX_DEGREE + 1 }, (_, d) => mean(kfoldErrors(pts, d, k, seed)));
}

/** Erreur de validation d'un seul découpage 70 / 30, pour chaque degré. */
export function holdoutCurve(pts: Pt[], seed: number) {
  const order = shuffledIndices(pts.length, seed);
  const cut = Math.round(pts.length * 0.7);
  const train = order.slice(0, cut).map((i) => pts[i]);
  const val = order.slice(cut).map((i) => pts[i]);
  return Array.from({ length: CV_MAX_DEGREE + 1 }, (_, d) => mse(polyFit(train, d, 1e-6), val));
}

export const argmin = (xs: number[]) => xs.reduce((best, v, i) => (v < xs[best] ? i : best), 0);

// ============================================================ Fuite de données (sélection de variables)

export type NoiseData = { X: number[][]; y: number[] };

/** n exemples, p variables de pur bruit, étiquettes aléatoires équilibrées : aucun signal à trouver. */
export function noiseDataset(n: number, p: number, seed: number): NoiseData {
  const z = normals(n * p, seed);
  const X = Array.from({ length: n }, (_, i) => z.slice(i * p, (i + 1) * p));
  const order = shuffledIndices(n, seed + 7);
  const y = new Array(n).fill(0);
  order.slice(0, Math.floor(n / 2)).forEach((i) => (y[i] = 1));
  return { X, y };
}

/** Les m variables les plus corrélées à l'étiquette, calculées sur les lignes `rows` seulement. */
export function topFeatures({ X, y }: NoiseData, rows: number[], m: number) {
  const p = X[0].length;
  const ym = mean(rows.map((r) => y[r]));
  const scores: [number, number][] = [];
  for (let j = 0; j < p; j++) {
    let xm = 0;
    for (const r of rows) xm += X[r][j];
    xm /= rows.length;
    let sxy = 0, sxx = 0;
    for (const r of rows) {
      const dx = X[r][j] - xm;
      sxy += dx * (y[r] - ym);
      sxx += dx * dx;
    }
    scores.push([Math.abs(sxy) / Math.sqrt(sxx + 1e-12), j]);
  }
  return scores.sort((a, b) => b[0] - a[0]).slice(0, m).map(([, j]) => j);
}

/** Classifieur du plus proche centroïde, restreint aux variables choisies. */
function nearestCentroidAccuracy(d: NoiseData, train: number[], test: number[], feats: number[]) {
  const centroid = (cls: number) => {
    const rows = train.filter((r) => d.y[r] === cls);
    return feats.map((j) => mean(rows.map((r) => d.X[r][j])));
  };
  const c0 = centroid(0), c1 = centroid(1);
  let ok = 0;
  for (const r of test) {
    let d0 = 0, d1 = 0;
    feats.forEach((j, k) => {
      d0 += (d.X[r][j] - c0[k]) ** 2;
      d1 += (d.X[r][j] - c1[k]) ** 2;
    });
    if ((d1 < d0 ? 1 : 0) === d.y[r]) ok++;
  }
  return ok / test.length;
}

/**
 * Validation croisée en 5 plis.
 * leaky = true : la sélection de variables voit TOUTES les données (y compris les plis de validation).
 * leaky = false : la sélection est refaite dans chaque pli, sur les seules données d'entraînement.
 */
export function leakageCv(d: NoiseData, m: number, leaky: boolean, k = 5) {
  const n = d.y.length;
  const all = Array.from({ length: n }, (_, i) => i);
  const fold = foldAssignment(n, k, 11);
  const globalFeats = leaky ? topFeatures(d, all, m) : null;
  return Array.from({ length: k }, (_, f) => {
    const train = all.filter((i) => fold[i] !== f);
    const test = all.filter((i) => fold[i] === f);
    const feats = globalFeats ?? topFeatures(d, train, m);
    return nearestCentroidAccuracy(d, train, test, feats);
  });
}

// ============================================================ Données 2D (« demi-lunes »)

export type P2 = { x: number; y: number; c: 0 | 1 };

export function moons(n: number, noise: number, seed: number): P2[] {
  const r = mulberry32(seed);
  const z = normals(2 * n, seed + 1);
  return Array.from({ length: n }, (_, i) => {
    const c = (i % 2) as 0 | 1;
    const t = Math.PI * r();
    const x = c === 0 ? Math.cos(t) : 1 - Math.cos(t);
    const y = c === 0 ? Math.sin(t) : 0.5 - Math.sin(t);
    return { x: x + noise * z[2 * i], y: y + noise * z[2 * i + 1], c };
  });
}

export const MOON_TRAIN = moons(150, 0.3, 21);
export const MOON_TEST = moons(400, 0.3, 77);
export const MOON_DOMAIN = { x: [-1.6, 2.6] as [number, number], y: [-1.2, 1.7] as [number, number] };

export type Classifier = (x: number, y: number) => 0 | 1;

export const accuracy = (f: Classifier, pts: P2[]) => pts.filter((p) => f(p.x, p.y) === p.c).length / pts.length;

// ============================================================ k plus proches voisins

/** k-NN ; `yScale` multiplie la 2ᵉ variable avant le calcul des distances (simule des unités différentes). */
export function knn(train: P2[], k: number, yScale = 1): Classifier {
  return (x, y) => {
    const d = train.map((p) => [(p.x - x) ** 2 + ((p.y - y) * yScale) ** 2, p.c] as const);
    d.sort((a, b) => a[0] - b[0]);
    let votes = 0;
    for (let i = 0; i < k; i++) votes += d[i][1];
    return votes * 2 > k ? 1 : 0;
  };
}

export const KNN_KS = Array.from({ length: 75 }, (_, i) => 2 * i + 1); // 1, 3, …, 149 (presque tout le jeu d'entraînement)

// ============================================================ Arbre de décision (CART, critère de Gini)

export type TreeNode =
  | { leaf: true; c: 0 | 1; n: number }
  | { leaf: false; feat: "x" | "y"; thr: number; left: TreeNode; right: TreeNode; n: number };

const gini = (n1: number, n: number) => (n === 0 ? 0 : 1 - (n1 / n) ** 2 - ((n - n1) / n) ** 2);

export function buildTree(pts: P2[], maxDepth: number, depth = 0): TreeNode {
  const n = pts.length;
  const n1 = pts.reduce((s, p) => s + p.c, 0);
  const majority: 0 | 1 = n1 * 2 >= n ? 1 : 0;
  if (depth >= maxDepth || n1 === 0 || n1 === n || n < 2) return { leaf: true, c: majority, n };

  let best = { score: gini(n1, n), feat: "x" as "x" | "y", thr: NaN };
  for (const feat of ["x", "y"] as const) {
    const sorted = [...pts].sort((a, b) => a[feat] - b[feat]);
    let left1 = 0;
    for (let i = 1; i < n; i++) {
      left1 += sorted[i - 1].c;
      if (sorted[i][feat] === sorted[i - 1][feat]) continue;
      const score = (i / n) * gini(left1, i) + ((n - i) / n) * gini(n1 - left1, n - i);
      if (score < best.score - 1e-12) best = { score, feat, thr: (sorted[i][feat] + sorted[i - 1][feat]) / 2 };
    }
  }
  if (Number.isNaN(best.thr)) return { leaf: true, c: majority, n };
  const left = pts.filter((p) => p[best.feat] <= best.thr);
  const right = pts.filter((p) => p[best.feat] > best.thr);
  return {
    leaf: false,
    feat: best.feat,
    thr: best.thr,
    left: buildTree(left, maxDepth, depth + 1),
    right: buildTree(right, maxDepth, depth + 1),
    n,
  };
}

export function treeClassifier(t: TreeNode): Classifier {
  return (x, y) => {
    let node = t;
    while (!node.leaf) node = (node.feat === "x" ? x : y) <= node.thr ? node.left : node.right;
    return node.c;
  };
}

export const countLeaves = (t: TreeNode): number => (t.leaf ? 1 : countLeaves(t.left) + countLeaves(t.right));
export const treeDepth = (t: TreeNode): number => (t.leaf ? 0 : 1 + Math.max(treeDepth(t.left), treeDepth(t.right)));
export const TREE_MAX_DEPTH = 12;

/** Pour chaque requête, les classes des points d'entraînement triés du plus proche au plus loin. */
export function neighborLabels(train: P2[], queries: { x: number; y: number }[], yScale = 1) {
  return queries.map((q) => {
    const d = train.map((p) => [(p.x - q.x) ** 2 + ((p.y - q.y) * yScale) ** 2, p.c] as const);
    d.sort((a, b) => a[0] - b[0]);
    return Uint8Array.from(d.map((e) => e[1]));
  });
}

/** Vote majoritaire des k premiers voisins (k impair). */
export const voteK = (labels: Uint8Array, k: number): 0 | 1 => {
  let s = 0;
  for (let i = 0; i < k; i++) s += labels[i];
  return s * 2 > k ? 1 : 0;
};

/** Précision pour chaque k de KNN_KS, à partir des voisins pré-triés. */
export function knnAccuracyCurve(neigh: Uint8Array[], pts: P2[]) {
  return KNN_KS.map((k) => neigh.filter((l, i) => voteK(l, k) === pts[i].c).length / pts.length);
}

/** Grille régulière sur le domaine des demi-lunes, pour colorier les régions de décision. */
export function moonGrid(cols = 64, rows = 44, domain: { x: [number, number]; y: [number, number] } = MOON_DOMAIN) {
  const { x, y } = domain;
  const cells: { x: number; y: number; i: number; j: number }[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      cells.push({ x: x[0] + ((i + 0.5) / cols) * (x[1] - x[0]), y: y[1] - ((j + 0.5) / rows) * (y[1] - y[0]), i, j });
  return { cells, cols, rows };
}
