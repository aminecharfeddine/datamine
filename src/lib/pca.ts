// ACP : projection 2D interactive et éboulis des valeurs propres.
import { normals } from "./metrics";

export type P2 = [number, number];

/** Appartements : surface (m²) et nombre de pièces, très corrélés mais d'échelles très différentes. */
export const APPARTS: P2[] = (() => {
  const z = normals(400, 61);
  return Array.from({ length: 200 }, (_, i) => {
    const taille = z[2 * i];
    const surface = 65 + 28 * taille + 6 * z[2 * i + 1];
    const pieces = 3 + 1.1 * (0.85 * taille + 0.53 * z[(2 * i + 7) % 400]);
    return [surface, pieces] as P2;
  });
})();

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

/** Données centrées, et réduites si `standardize`. */
export function prepare(data: P2[], standardize: boolean): P2[] {
  const xs = data.map((d) => d[0]);
  const ys = data.map((d) => d[1]);
  const [mx, my, sx, sy] = [mean(xs), mean(ys), standardize ? sd(xs) : 1, standardize ? sd(ys) : 1];
  return data.map(([x, y]) => [(x - mx) / sx, (y - my) / sy]);
}

/** Matrice de covariance 2 × 2 : [[a, b], [b, c]]. */
export function cov2(pts: P2[]) {
  const n = pts.length - 1;
  const a = pts.reduce((s, p) => s + p[0] * p[0], 0) / n;
  const b = pts.reduce((s, p) => s + p[0] * p[1], 0) / n;
  const c = pts.reduce((s, p) => s + p[1] * p[1], 0) / n;
  return { a, b, c };
}

/** Valeurs propres et angle (degrés, dans [0, 180[) du premier axe principal. */
export function pca2(pts: P2[]) {
  const { a, b, c } = cov2(pts);
  const tr = a + c;
  const det = a * c - b * b;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;
  const angle = ((Math.atan2(l1 - a, b) * 180) / Math.PI + 180) % 180;
  return { l1, l2, total: tr, angle };
}

/** Variance des projections sur la direction d'angle `deg`, et erreur de reconstruction (variance perdue). */
export function projection(pts: P2[], deg: number) {
  const t = (deg * Math.PI) / 180;
  const u: P2 = [Math.cos(t), Math.sin(t)];
  const proj = pts.map((p) => p[0] * u[0] + p[1] * u[1]);
  const v = proj.reduce((s, x) => s + x * x, 0) / (pts.length - 1);
  const { total } = pca2(pts);
  return { variance: v, lost: total - v, share: v / total, proj, u };
}

// ------------------------------------------------------------ Éboulis

/** Valeurs propres d'une matrice symétrique (méthode de Jacobi). */
export function eigenvalues(M: number[][]): number[] {
  const n = M.length;
  const A: number[][] = M.map((r) => [...r]);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-14) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
      }
  }
  return A.map((r, i) => r[i]).sort((x, y) => y - x);
}

export const SUBJECTS = ["Maths", "Physique", "SVT", "Français", "Histoire", "Anglais", "Philo", "Sport"];

/** Notes de 300 élèves dans 8 matières : deux facteurs latents (scientifique, littéraire) + bruit propre à chaque matière. */
export const SCREE: number[] = (() => {
  const z = normals(300 * 11, 88);
  const load = [
    [0.9, 0.1], [0.85, 0.15], [0.7, 0.2], [0.15, 0.85], [0.2, 0.8], [0.25, 0.7], [0.3, 0.75], [0.1, 0.05],
  ];
  const rows = Array.from({ length: 300 }, (_, i) => {
    const f1 = z[11 * i];
    const f2 = 0.3 * f1 + 0.95 * z[11 * i + 1];
    return load.map(([a, b], j) => a * f1 + b * f2 + 0.55 * z[11 * i + 2 + (j % 9)]);
  });
  const p = load.length;
  const cols = Array.from({ length: p }, (_, j) => rows.map((r) => r[j]));
  const std = cols.map((c) => {
    const m = mean(c);
    const s = sd(c);
    return c.map((x) => (x - m) / s);
  });
  const C = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => std[i].reduce((s, x, k) => s + x * std[j][k], 0) / (rows.length - 1)));
  return eigenvalues(C);
})();
