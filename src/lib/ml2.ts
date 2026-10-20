// Modules 2 et 3 (suite) : fonctions de perte robustes, SVM (SMO simplifié), DBSCAN.
import { mulberry32, normals } from "./metrics";

// ============================================================ Fonctions de perte

export type Pt = { x: number; y: number };
export const TRUE_SLOPE = 0.5;
export const TRUE_INTERCEPT = 2;

export const LOSS_POINTS: Pt[] = (() => {
  const z = normals(30, 515);
  return Array.from({ length: 30 }, (_, i) => {
    const x = (i / 29) * 10;
    return { x, y: TRUE_INTERCEPT + TRUE_SLOPE * x + 0.5 * z[i] };
  });
})();
/** Quelques mesures aberrantes (capteur défaillant) en fin de plage. */
export const OUTLIERS: Pt[] = [
  { x: 8.2, y: 14 },
  { x: 8.9, y: 15.5 },
  { x: 9.4, y: 14.8 },
  { x: 9.9, y: 16.2 },
];

export type LossKind = "mse" | "mae" | "huber";

export const lossValue = (kind: LossKind, r: number, delta = 1) =>
  kind === "mse" ? r * r : kind === "mae" ? Math.abs(r) : Math.abs(r) <= delta ? 0.5 * r * r : delta * (Math.abs(r) - 0.5 * delta);

/** Moindres carrés pondérés pour une droite. */
function wls(pts: Pt[], w: number[]) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  pts.forEach((p, i) => {
    sw += w[i];
    sx += w[i] * p.x;
    sy += w[i] * p.y;
    sxx += w[i] * p.x * p.x;
    sxy += w[i] * p.x * p.y;
  });
  const slope = (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
  return { slope, intercept: (sy - slope * sx) / sw };
}

/** Ajuste une droite en minimisant la perte choisie (moindres carrés repondérés itératifs pour MAE et Huber). */
export function fitLine(pts: Pt[], kind: LossKind, delta = 1) {
  let fit = wls(pts, pts.map(() => 1));
  if (kind === "mse") return fit;
  for (let it = 0; it < 200; it++) {
    const w = pts.map((p) => {
      const r = Math.abs(p.y - (fit.intercept + fit.slope * p.x));
      if (kind === "mae") return 1 / Math.max(r, 1e-4);
      return r <= delta ? 1 : delta / r;
    });
    fit = wls(pts, w);
  }
  return fit;
}

// ============================================================ SVM

export type Labeled = { x: number; y: number; c: 1 | -1 };

/** Deux classes en cercles concentriques : impossibles à séparer par une droite. */
function rings(n: number, seed: number): Labeled[] {
  const u = mulberry32(seed);
  const z = normals(2 * n, seed + 1);
  return Array.from({ length: n }, (_, i) => {
    const inner = i % 2 === 0;
    const a = u() * 2 * Math.PI;
    const r = inner ? 0.9 * Math.sqrt(u()) : 1.5 + 0.6 * u();
    return { x: r * Math.cos(a) + 0.12 * z[2 * i], y: r * Math.sin(a) + 0.12 * z[2 * i + 1], c: inner ? 1 : -1 };
  });
}
export const SVM_TRAIN = rings(90, 71);
export const SVM_TEST = rings(200, 1729);

export type Kernel = "lineaire" | "rbf";
export const kernelFn = (k: Kernel, gamma: number) => (a: { x: number; y: number }, b: { x: number; y: number }) =>
  k === "lineaire" ? a.x * b.x + a.y * b.y : Math.exp(-gamma * ((a.x - b.x) ** 2 + (a.y - b.y) ** 2));

/** SMO simplifié (Platt), déterministe. Renvoie une fonction de décision et les vecteurs de support. */
export function trainSvm(data: Labeled[], kernel: Kernel, C: number, gamma: number) {
  const K = kernelFn(kernel, gamma);
  const n = data.length;
  const G = data.map((a) => data.map((b) => K(a, b)));
  const alpha = new Array(n).fill(0);
  let b = 0;
  const tol = 1e-3;
  const u = mulberry32(3);
  const f = (i: number) => alpha.reduce((s, a, j) => (a ? s + a * data[j].c * G[j][i] : s), 0) + b;
  let passes = 0;
  let iter = 0;
  while (passes < 8 && iter < 400) {
    iter++;
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const Ei = f(i) - data[i].c;
      if ((data[i].c * Ei < -tol && alpha[i] < C) || (data[i].c * Ei > tol && alpha[i] > 0)) {
        let j = Math.floor(u() * (n - 1));
        if (j >= i) j++;
        const Ej = f(j) - data[j].c;
        const [ai, aj] = [alpha[i], alpha[j]];
        const [L, H] = data[i].c !== data[j].c ? [Math.max(0, aj - ai), Math.min(C, C + aj - ai)] : [Math.max(0, ai + aj - C), Math.min(C, ai + aj)];
        if (L === H) continue;
        const eta = 2 * G[i][j] - G[i][i] - G[j][j];
        if (eta >= 0) continue;
        alpha[j] = Math.min(H, Math.max(L, aj - (data[j].c * (Ei - Ej)) / eta));
        if (Math.abs(alpha[j] - aj) < 1e-5) continue;
        alpha[i] = ai + data[i].c * data[j].c * (aj - alpha[j]);
        const b1 = b - Ei - data[i].c * (alpha[i] - ai) * G[i][i] - data[j].c * (alpha[j] - aj) * G[i][j];
        const b2 = b - Ej - data[i].c * (alpha[i] - ai) * G[i][j] - data[j].c * (alpha[j] - aj) * G[j][j];
        b = alpha[i] > 0 && alpha[i] < C ? b1 : alpha[j] > 0 && alpha[j] < C ? b2 : (b1 + b2) / 2;
        changed++;
      }
    }
    passes = changed === 0 ? passes + 1 : 0;
  }
  const sv = data.map((d, i) => ({ ...d, a: alpha[i] })).filter((d) => d.a > 1e-6);
  const decision = (p: { x: number; y: number }) => sv.reduce((s, d) => s + d.a * d.c * K(d, p), 0) + b;
  const acc = (set: Labeled[]) => set.filter((p) => Math.sign(decision(p)) === p.c).length / set.length;
  return { decision, supportVectors: sv, trainAcc: acc(data), testAcc: acc(SVM_TEST) };
}

export const SVM_C = [0.1, 1, 10, 100];
export const SVM_GAMMA = [0.1, 1, 10, 100];

// ============================================================ Clustering par densité

/** Deux lunes imbriquées + points de bruit. truth : 0, 1 ou −1 (bruit). */
export const MOONS: { x: number; y: number; truth: number }[] = (() => {
  const z = normals(400, 909);
  const u = mulberry32(11);
  const pts = Array.from({ length: 200 }, (_, i) => {
    const m = i % 2;
    const t = Math.PI * u();
    const x = m === 0 ? Math.cos(t) : 1 - Math.cos(t);
    const y = m === 0 ? Math.sin(t) : 0.5 - Math.sin(t);
    return { x: x + 0.06 * z[2 * i], y: y + 0.06 * z[2 * i + 1], truth: m };
  });
  const noise = Array.from({ length: 16 }, () => ({ x: -1.4 + 3.9 * u(), y: -0.9 + 2.1 * u(), truth: -1 }));
  // On ne garde comme bruit que des points éloignés des lunes.
  const far = noise.filter((p) => pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 0.3));
  return [...pts, ...far];
})();

export function dbscan(pts: { x: number; y: number }[], eps: number, minPts: number): number[] {
  const n = pts.length;
  const labels = new Array(n).fill(-2); // −2 : non visité, −1 : bruit
  const neigh = (i: number) => pts.map((_, j) => j).filter((j) => Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) <= eps);
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue;
    const nb = neigh(i);
    if (nb.length < minPts) {
      labels[i] = -1;
      continue;
    }
    labels[i] = c;
    const queue = [...nb];
    while (queue.length) {
      const j = queue.shift()!;
      if (labels[j] === -1) labels[j] = c;
      if (labels[j] !== -2) continue;
      labels[j] = c;
      const nj = neigh(j);
      if (nj.length >= minPts) queue.push(...nj);
    }
    c++;
  }
  return labels;
}

/** k-means (Lloyd, initialisation déterministe k-means++ simplifiée). */
export function kmeans(pts: { x: number; y: number }[], k: number): number[] {
  const u = mulberry32(5);
  const cent = [pts[Math.floor(u() * pts.length)]];
  while (cent.length < k) {
    const d = pts.map((p) => Math.min(...cent.map((c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2)));
    let r = u() * d.reduce((a, b) => a + b, 0);
    let i = 0;
    while (r > d[i]) r -= d[i++];
    cent.push(pts[Math.min(i, pts.length - 1)]);
  }
  let labels = pts.map(() => 0);
  let c = cent.map((p) => ({ ...p }));
  for (let it = 0; it < 50; it++) {
    labels = pts.map((p) => c.reduce((best, q, j) => ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 < (p.x - c[best].x) ** 2 + (p.y - c[best].y) ** 2 ? j : best), 0));
    c = c.map((q, j) => {
      const m = pts.filter((_, i) => labels[i] === j);
      return m.length ? { x: m.reduce((s, p) => s + p.x, 0) / m.length, y: m.reduce((s, p) => s + p.y, 0) / m.length } : q;
    });
  }
  return labels;
}

/** Indice de Rand ajusté entre deux partitions (le bruit prédit compte comme un groupe à part). */
export function adjustedRand(a: number[], b: number[]) {
  const n = a.length;
  const key = (x: number, y: number) => `${x}|${y}`;
  const nij = new Map<string, number>();
  const ai = new Map<number, number>();
  const bj = new Map<number, number>();
  a.forEach((x, i) => {
    nij.set(key(x, b[i]), (nij.get(key(x, b[i])) ?? 0) + 1);
    ai.set(x, (ai.get(x) ?? 0) + 1);
    bj.set(b[i], (bj.get(b[i]) ?? 0) + 1);
  });
  const c2 = (m: number) => (m * (m - 1)) / 2;
  const sumIJ = [...nij.values()].reduce((s, m) => s + c2(m), 0);
  const sumA = [...ai.values()].reduce((s, m) => s + c2(m), 0);
  const sumB = [...bj.values()].reduce((s, m) => s + c2(m), 0);
  const expected = (sumA * sumB) / c2(n);
  const max = (sumA + sumB) / 2;
  return (sumIJ - expected) / (max - expected);
}

export function clusterQuality(labels: number[]) {
  const moonIdx = MOONS.map((p, i) => (p.truth >= 0 ? i : -1)).filter((i) => i >= 0);
  const noiseIdx = MOONS.map((p, i) => (p.truth < 0 ? i : -1)).filter((i) => i >= 0);
  const ari = adjustedRand(moonIdx.map((i) => MOONS[i].truth), moonIdx.map((i) => labels[i]));
  const noiseFound = noiseIdx.length ? noiseIdx.filter((i) => labels[i] === -1).length / noiseIdx.length : 1;
  const clusters = new Set(labels.filter((l) => l >= 0)).size;
  return { ari, noiseFound, clusters, noiseCount: noiseIdx.length };
}
