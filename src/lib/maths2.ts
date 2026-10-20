// Module 0 (suite) : espérance et variance d'une combinaison ; transformations linéaires du plan.

// ============================================================ Espérance et variance

/** Deux sources de rendement (ou deux modèles dont on moyenne les prédictions). */
export const ASSET_A = { mean: 0.04, sd: 0.1 };
export const ASSET_B = { mean: 0.06, sd: 0.15 };

/** Espérance et écart-type de w·A + (1 − w)·B, pour une corrélation ρ entre A et B. */
export function mix(w: number, rho: number) {
  const mean = w * ASSET_A.mean + (1 - w) * ASSET_B.mean;
  const v = w * w * ASSET_A.sd ** 2 + (1 - w) ** 2 * ASSET_B.sd ** 2 + 2 * w * (1 - w) * rho * ASSET_A.sd * ASSET_B.sd;
  return { mean, sd: Math.sqrt(Math.max(0, v)), variance: v };
}

export const W_GRID = Array.from({ length: 21 }, (_, i) => i / 20);
export const minSdOnGrid = (rho: number) => Math.min(...W_GRID.map((w) => mix(w, rho).sd));

/** Écart-type de la moyenne de k modèles d'écart-type σ, deux à deux corrélés à ρ. */
export const averagedSd = (k: number, sigma: number, rho: number) => Math.sqrt(rho * sigma * sigma + ((1 - rho) * sigma * sigma) / k);

// ============================================================ Matrices 2 × 2

export type M2 = [number, number, number, number]; // [a, b, c, d] = [[a, b], [c, d]]

export const apply = ([a, b, c, d]: M2, [x, y]: [number, number]): [number, number] => [a * x + b * y, c * x + d * y];
export const det = ([a, b, c, d]: M2) => a * d - b * c;
export const trace = ([a, , , d]: M2) => a + d;

/** Valeurs propres réelles (si elles existent) et vecteurs propres associés (normés). */
export function eigen(m: M2) {
  const [a, b, c, d] = m;
  const tr = trace(m);
  const disc = (tr * tr) / 4 - det(m);
  if (disc < -1e-12) return { real: false as const, values: [] as number[], vectors: [] as [number, number][] };
  const s = Math.sqrt(Math.max(0, disc));
  const values = [tr / 2 + s, tr / 2 - s];
  const vectors = values.map((l): [number, number] => {
    // (A − λI) v = 0
    let v: [number, number] = Math.abs(b) > 1e-12 ? [b, l - a] : Math.abs(c) > 1e-12 ? [l - d, c] : l === a ? [1, 0] : [0, 1];
    const n = Math.hypot(v[0], v[1]);
    v = [v[0] / n, v[1] / n];
    return v;
  });
  return { real: true as const, values, vectors };
}

export const isZero = (m: M2) => m.every((v) => v === 0);
