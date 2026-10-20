// Module 6 (suite) : modèles de diffusion (2D) et détection d'objets (IoU, NMS).
import { mulberry32, normals } from "./metrics";

// ============================================================ Diffusion

export type P2 = [number, number];

/** Données d'entraînement : une spirale (n = 160), centrée et réduite. */
export const SPIRAL: P2[] = (() => {
  const z = normals(320, 12);
  return Array.from({ length: 160 }, (_, i) => {
    const t = 0.6 + (i / 160) * 3.2 * Math.PI;
    const r = 0.18 * t;
    return [r * Math.cos(t) + 0.03 * z[2 * i], r * Math.sin(t) + 0.03 * z[2 * i + 1]] as P2;
  });
})();

/** Planning cosinus : ᾱ(s) pour s ∈ [0, 1] (1 = bruit pur). */
export const alphaBar = (s: number) => {
  const f = (x: number) => Math.cos(((x + 0.008) / 1.008) * (Math.PI / 2)) ** 2;
  return Math.min(0.9999, Math.max(1e-4, f(s) / f(0)));
};

/** Processus direct : x_s = √ᾱ x₀ + √(1 − ᾱ) ε. */
export function noisy(s: number, seed = 3): P2[] {
  const z = normals(2 * SPIRAL.length, seed);
  const a = alphaBar(s);
  return SPIRAL.map(([x, y], i) => [Math.sqrt(a) * x + Math.sqrt(1 - a) * z[2 * i], Math.sqrt(a) * y + Math.sqrt(1 - a) * z[2 * i + 1]]);
}

/**
 * Débruiteur « idéal » : E[x₀ | x_s] pour la distribution des données lissée.
 * Un vrai modèle apprend une approximation de cette fonction (il prédit le bruit ε).
 */
function denoise(p: P2, a: number): P2 {
  const sa = Math.sqrt(a);
  const v = 1 - a;
  let wmax = -Infinity;
  const logw = SPIRAL.map(([x, y]) => -((p[0] - sa * x) ** 2 + (p[1] - sa * y) ** 2) / (2 * v));
  for (const l of logw) wmax = Math.max(wmax, l);
  let sw = 0;
  let mx = 0;
  let my = 0;
  logw.forEach((l, i) => {
    const w = Math.exp(l - wmax);
    sw += w;
    mx += w * SPIRAL[i][0];
    my += w * SPIRAL[i][1];
  });
  return [mx / sw, my / sw];
}

/** Échantillonnage DDIM (déterministe) en `steps` étapes, depuis du bruit pur. */
export function sample(steps: number, n = 200, seed = 21): P2[] {
  const z = normals(2 * n, seed);
  return Array.from({ length: n }, (_, i) => {
    let p: P2 = [z[2 * i], z[2 * i + 1]];
    for (let k = steps; k >= 1; k--) {
      const a = alphaBar(k / steps);
      const aPrev = k > 1 ? alphaBar((k - 1) / steps) : 1;
      const x0 = denoise(p, a);
      // bruit estimé, puis on se replace au niveau de bruit précédent
      const ex = (p[0] - Math.sqrt(a) * x0[0]) / Math.sqrt(1 - a);
      const ey = (p[1] - Math.sqrt(a) * x0[1]) / Math.sqrt(1 - a);
      p = [Math.sqrt(aPrev) * x0[0] + Math.sqrt(1 - aPrev) * ex, Math.sqrt(aPrev) * x0[1] + Math.sqrt(1 - aPrev) * ey];
    }
    return p;
  });
}

/** Qualité : distance moyenne de chaque échantillon au point réel le plus proche. Couverture : part des points réels qui ont un échantillon à moins de r. */
export function sampleQuality(samples: P2[], r = 0.08) {
  const d = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const dist = samples.reduce((s, p) => s + Math.min(...SPIRAL.map((q) => d(p, q))), 0) / samples.length;
  const coverage = SPIRAL.filter((q) => samples.some((p) => d(p, q) < r)).length / SPIRAL.length;
  return { dist, coverage };
}

export const DIFF_STEPS = [1, 2, 3, 5, 10, 20, 50];
export const DIFF_TARGET = 0.03;

// ============================================================ Détection

export type Box = { x1: number; y1: number; x2: number; y2: number };
export type Pred = Box & { id: string; score: number };

export function iou(a: Box, b: Box) {
  const w = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const h = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = w * h;
  const area = (r: Box) => (r.x2 - r.x1) * (r.y2 - r.y1);
  return inter / (area(a) + area(b) - inter);
}

/** Vérité terrain : deux personnes côte à côte (qui se chevauchent) et un vélo. */
export const GT: (Box & { label: string })[] = [
  { label: "personne", x1: 60, y1: 50, x2: 160, y2: 230 },
  { label: "personne", x1: 125, y1: 60, x2: 225, y2: 235 },
  { label: "vélo", x1: 290, y1: 140, x2: 400, y2: 220 },
];

/** Sorties brutes du détecteur, avant seuil et NMS. */
export const PREDS: Pred[] = [
  { id: "p1", score: 0.95, x1: 62, y1: 54, x2: 158, y2: 228 },
  { id: "p2", score: 0.86, x1: 70, y1: 45, x2: 168, y2: 222 },
  { id: "p3", score: 0.91, x1: 128, y1: 63, x2: 228, y2: 232 },
  { id: "p4", score: 0.74, x1: 120, y1: 70, x2: 215, y2: 245 },
  { id: "p5", score: 0.58, x1: 292, y1: 138, x2: 396, y2: 224 },
  { id: "p6", score: 0.45, x1: 300, y1: 150, x2: 385, y2: 212 },
  { id: "p7", score: 0.52, x1: 420, y1: 40, x2: 470, y2: 110 },
  { id: "p8", score: 0.3, x1: 40, y1: 30, x2: 250, y2: 250 },
];

/** Seuil de confiance, puis NMS glouton : on garde la boîte la plus sûre, on supprime celles qui la chevauchent au-delà du seuil d'IoU. */
export function nms(preds: Pred[], conf: number, iouThr: number): Pred[] {
  const cand = preds.filter((p) => p.score >= conf).sort((a, b) => b.score - a.score);
  const kept: Pred[] = [];
  for (const p of cand) if (kept.every((k) => iou(k, p) <= iouThr)) kept.push(p);
  return kept;
}

/** Appariement glouton aux vérités terrain (IoU ≥ 0,5) : TP, FP, FN. */
export function matchDetections(kept: Pred[], gt = GT, thr = 0.5) {
  const used = new Set<number>();
  let tp = 0;
  const status: Record<string, "tp" | "fp"> = {};
  for (const p of [...kept].sort((a, b) => b.score - a.score)) {
    let best = -1;
    let bestIou = thr;
    gt.forEach((g, i) => {
      const v = iou(p, g);
      if (!used.has(i) && v >= bestIou) {
        best = i;
        bestIou = v;
      }
    });
    if (best >= 0) {
      used.add(best);
      tp++;
      status[p.id] = "tp";
    } else status[p.id] = "fp";
  }
  return { tp, fp: kept.length - tp, fn: gt.length - tp, status };
}
