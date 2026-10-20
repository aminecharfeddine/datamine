// Module 4 (suite) : comparer deux modèles, courbes de gain et lift, équité.
import { mulberry32, normals } from "./metrics";

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// ============================================================ Comparer deux modèles

/**
 * 4 000 exemples de test. Chaque exemple a une difficulté ; les deux modèles se trompent surtout sur les mêmes exemples
 * difficiles. B est réellement un peu meilleur que A.
 */
export const PAIRED: { a: boolean; b: boolean }[] = (() => {
  const z = normals(4000, 123);
  const u = mulberry32(321);
  const v = mulberry32(654);
  return z.map((diff) => {
    const pA = sigmoid(1.75 - 1.6 * diff);
    const pB = sigmoid(2.05 - 1.6 * diff);
    const r = u();
    const rB = v() < 0.8 ? r : v(); // erreurs très corrélées, mais pas identiques
    return { a: r < pA, b: rB < pB };
  });
})();

export const TEST_SIZES = [100, 200, 400, 800, 1600, 4000];

function normCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
const twoSided = (z: number) => 2 * (1 - normCdf(Math.abs(z)));

export function compareModels(n: number) {
  const s = PAIRED.slice(0, n);
  const accA = s.filter((e) => e.a).length / n;
  const accB = s.filter((e) => e.b).length / n;
  const diff = accB - accA;
  // Non apparié : comme deux échantillons indépendants
  const seU = Math.sqrt((accA * (1 - accA)) / n + (accB * (1 - accB)) / n);
  // Apparié : seuls les désaccords comptent (McNemar)
  const b = s.filter((e) => e.a && !e.b).length; // A juste, B faux
  const c = s.filter((e) => !e.a && e.b).length; // A faux, B juste
  const seP = Math.sqrt(b + c - (c - b) ** 2 / n) / n;
  const mcnemarZ = b + c > 0 ? (c - b) / Math.sqrt(b + c) : 0;
  return {
    accA, accB, diff, b, c,
    unpaired: { lo: diff - 1.96 * seU, hi: diff + 1.96 * seU, p: twoSided(diff / seU) },
    paired: { lo: diff - 1.96 * seP, hi: diff + 1.96 * seP, p: twoSided(mcnemarZ) },
  };
}

// ============================================================ Gain et lift

export const CAMPAIGN = { contactCost: 2, responseValue: 80, n: 10000 };

/** Scores d'un modèle de réponse à une campagne (3 % de répondants). */
export const CAMPAIGN_DATA: { score: number; y: 0 | 1 }[] = (() => {
  const z = normals(CAMPAIGN.n, 77);
  const u = mulberry32(78);
  return z
    .map((v) => {
      const y = (u() < 0.03 ? 1 : 0) as 0 | 1;
      return { score: sigmoid(v * 1.1 + (y ? 1.9 : 0) - 1.2), y };
    })
    .sort((a, b) => b.score - a.score);
})();

export const TOTAL_RESPONDERS = CAMPAIGN_DATA.filter((d) => d.y).length;
export const TARGET_SHARES = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.05);

/** Contacter les `share` clients les mieux notés. */
export function targeting(share: number) {
  const k = Math.round(share * CAMPAIGN.n);
  const caught = CAMPAIGN_DATA.slice(0, k).filter((d) => d.y).length;
  const gain = caught / TOTAL_RESPONDERS;
  const lift = share > 0 ? gain / share : 0;
  const profit = caught * CAMPAIGN.responseValue - k * CAMPAIGN.contactCost;
  return { k, caught, gain, lift, profit, rate: k ? caught / k : 0 };
}

export const BEST_PROFIT = Math.max(...TARGET_SHARES.map((s) => targeting(s).profit));

// ============================================================ Équité

export type Group = "A" | "B";
/** Deux groupes de candidats ; le groupe B est moins représenté dans les données et le modèle le note avec moins de précision. */
export const FAIR_DATA: { g: Group; y: 0 | 1; score: number }[] = (() => {
  const z = normals(3000, 2468);
  const u = mulberry32(1357);
  return z.map((v, i) => {
    const g: Group = i % 5 < 3 ? "A" : "B";
    const base = g === "A" ? 0.4 : 0.3;
    const y = (u() < base ? 1 : 0) as 0 | 1;
    const sep = g === "A" ? 2.2 : 1.4; // le modèle sépare moins bien le groupe B
    const shift = g === "B" ? -0.35 : 0; // et sous-note légèrement ses membres
    return { g, y, score: sigmoid(v + (y ? sep / 2 : -sep / 2) + shift) };
  });
})();

export function groupStats(g: Group, threshold: number) {
  const rows = FAIR_DATA.filter((r) => r.g === g);
  const sel = rows.filter((r) => r.score >= threshold);
  const pos = rows.filter((r) => r.y === 1);
  const tp = sel.filter((r) => r.y === 1).length;
  return {
    n: rows.length,
    selectionRate: sel.length / rows.length,
    tpr: pos.length ? tp / pos.length : 0,
    precision: sel.length ? tp / sel.length : 0,
    baseRate: pos.length / rows.length,
  };
}

export function fairness(tA: number, tB: number) {
  const a = groupStats("A", tA);
  const b = groupStats("B", tB);
  const sel = FAIR_DATA.filter((r) => r.score >= (r.g === "A" ? tA : tB));
  const tp = sel.filter((r) => r.y === 1).length;
  const totalPos = FAIR_DATA.filter((r) => r.y === 1).length;
  return {
    a,
    b,
    tprGap: Math.abs(a.tpr - b.tpr),
    selectionRatio: Math.min(a.selectionRate, b.selectionRate) / Math.max(a.selectionRate, b.selectionRate, 1e-9),
    precision: sel.length ? tp / sel.length : 0,
    recall: tp / totalPos,
  };
}
