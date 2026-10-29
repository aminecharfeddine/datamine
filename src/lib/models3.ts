// Leçons complémentaires : systèmes de recommandation, détection d'anomalies, données déséquilibrées,
// prompt engineering, alignement des LLM. Tout est pur et déterministe.
import { mulberry32, normals } from "./metrics";

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ============================================================ 1. Recommandation

export const FILMS = [
  "Le Casse", "Course-poursuite", "Opération Nuit", "Base lunaire", "Androïdes", "Signal perdu",
  "Un été à Lyon", "Lettres d'amour", "La Promesse", "Fou rire", "Colocs", "Le Mariage",
  "Le Dernier Duel", "Odyssée", "Planète rouge", "Bal masqué",
];
export const N_USERS = 60;
export const N_ITEMS = FILMS.length;

/** Profil caché des films sur trois goûts (action, science-fiction, romance / comédie). */
const ITEM_TASTE: number[][] = [
  [1, 0.2, 0], [1, 0, 0], [0.9, 0.3, 0], [0.2, 1, 0], [0.3, 1, 0], [0, 0.9, 0.1],
  [0, 0, 1], [0, 0.1, 1], [0.1, 0, 0.9], [0, 0, 0.8], [0, 0.2, 0.8], [0, 0, 1],
  [0.7, 0, 0.4], [0.5, 0.7, 0], [0.4, 0.8, 0], [0.2, 0, 0.7],
];
export const GENRES = ["Action", "Science-fiction", "Romance / comédie"] as const;
export const FILM_GENRE = ITEM_TASTE.map((t) => GENRES[t.indexOf(Math.max(...t))]);
const ITEM_BIAS = [0.3, -0.2, 0, 0.4, 0, -0.3, 0.2, -0.1, 0.1, -0.4, 0, 0.2, 0.3, -0.1, 0, -0.2];

export type Rating = { u: number; i: number; r: number };

export const RATINGS: { train: Rating[]; valid: Rating[] } = (() => {
  const z = normals(N_USERS * 3, 909);
  const noise = normals(N_USERS * N_ITEMS, 910);
  const u = mulberry32(911);
  const train: Rating[] = [];
  const valid: Rating[] = [];
  for (let a = 0; a < N_USERS; a++) {
    const pref = [z[3 * a], z[3 * a + 1], z[3 * a + 2]];
    for (let i = 0; i < N_ITEMS; i++) {
      const s = pref.reduce((acc, p, k) => acc + p * ITEM_TASTE[i][k], 0);
      const r = clamp(Math.round(3.1 + 1.1 * s + ITEM_BIAS[i] + 0.45 * noise[a * N_ITEMS + i]), 1, 5);
      const draw = u();
      if (draw < 0.55) train.push({ u: a, i, r });
      else if (draw < 0.72) valid.push({ u: a, i, r });
    }
  }
  return { train, valid };
})();

const rmse = (pred: (u: number, i: number) => number, set: Rating[]) =>
  Math.sqrt(set.reduce((s, x) => s + (pred(x.u, x.i) - x.r) ** 2, 0) / set.length);

const GLOBAL_MEAN = RATINGS.train.reduce((s, x) => s + x.r, 0) / RATINGS.train.length;

/** Popularité : la note moyenne du film (lissée vers la moyenne globale). */
export const popularity = (() => {
  const sum = new Array(N_ITEMS).fill(0);
  const cnt = new Array(N_ITEMS).fill(0);
  RATINGS.train.forEach((x) => {
    sum[x.i] += x.r;
    cnt[x.i]++;
  });
  const mean = sum.map((s, i) => (s + 3 * GLOBAL_MEAN) / (cnt[i] + 3));
  return (_u: number, i: number) => mean[i];
})();

/** Voisins : utilisateurs aux goûts proches (cosinus sur les notes centrées), moyenne pondérée de leurs écarts. */
export const neighbors = (() => {
  const M: (number | null)[][] = Array.from({ length: N_USERS }, () => new Array(N_ITEMS).fill(null));
  RATINGS.train.forEach((x) => (M[x.u][x.i] = x.r));
  const mean = M.map((row) => {
    const v = row.filter((r): r is number => r !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : GLOBAL_MEAN;
  });
  const C = M.map((row, a) => row.map((r) => (r === null ? 0 : r - mean[a])));
  const norm = C.map((row) => Math.hypot(...row) || 1);
  const sim = C.map((ra, a) => C.map((rb, b) => (a === b ? 0 : ra.reduce((s, v, i) => s + v * rb[i], 0) / (norm[a] * norm[b]))));
  return (a: number, i: number) => {
    const cands = sim[a]
      .map((s, b) => ({ s, b }))
      .filter((c) => M[c.b][i] !== null && c.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 8);
    const w = cands.reduce((s, c) => s + c.s, 0);
    if (w < 1e-9) return mean[a];
    return clamp(mean[a] + cands.reduce((s, c) => s + c.s * (M[c.b][i]! - mean[c.b]), 0) / w, 1, 5);
  };
})();

/** Factorisation matricielle par moindres carrés alternés (ALS), avec biais utilisateur et film. */
export function factorize(k: number, lambda: number, iters = 25) {
  const rnd = normals((N_USERS + N_ITEMS) * k, 4242 + k);
  const P = Array.from({ length: N_USERS }, (_, a) => Array.from({ length: k }, (_, f) => 0.1 * rnd[a * k + f]));
  const Q = Array.from({ length: N_ITEMS }, (_, i) => Array.from({ length: k }, (_, f) => 0.1 * rnd[(N_USERS + i) * k + f]));
  const bu = new Array(N_USERS).fill(0);
  const bi = new Array(N_ITEMS).fill(0);
  const byUser = Array.from({ length: N_USERS }, () => [] as Rating[]);
  const byItem = Array.from({ length: N_ITEMS }, () => [] as Rating[]);
  RATINGS.train.forEach((x) => {
    byUser[x.u].push(x);
    byItem[x.i].push(x);
  });
  const dot = (a: number[], b: number[]) => a.reduce((s, v, f) => s + v * b[f], 0);

  // Résout (AᵀA + λI) w = Aᵀy pour une petite dimension, par élimination de Gauss.
  const ridge = (rows: number[][], y: number[], lam: number) => {
    const d = rows[0]?.length ?? 0;
    const A = Array.from({ length: d }, (_, r) => Array.from({ length: d + 1 }, (_, c) => (c === d ? rows.reduce((s, x, n) => s + x[r] * y[n], 0) : rows.reduce((s, x) => s + x[r] * x[c], 0) + (r === c ? lam : 0))));
    for (let c = 0; c < d; c++) {
      let piv = c;
      for (let r = c + 1; r < d; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let r = 0; r < d; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let cc = c; cc <= d; cc++) A[r][cc] -= f * A[c][cc];
      }
    }
    return A.map((row, r) => row[d] / row[r]);
  };

  for (let t = 0; t < iters; t++) {
    for (let a = 0; a < N_USERS; a++) {
      const xs = byUser[a];
      if (!xs.length) continue;
      const w = ridge(xs.map((x) => [...Q[x.i], 1]), xs.map((x) => x.r - GLOBAL_MEAN - bi[x.i]), lambda);
      P[a] = w.slice(0, k);
      bu[a] = w[k];
    }
    for (let i = 0; i < N_ITEMS; i++) {
      const xs = byItem[i];
      if (!xs.length) continue;
      const w = ridge(xs.map((x) => [...P[x.u], 1]), xs.map((x) => x.r - GLOBAL_MEAN - bu[x.u]), lambda);
      Q[i] = w.slice(0, k);
      bi[i] = w[k];
    }
  }
  return (a: number, i: number) => clamp(GLOBAL_MEAN + bu[a] + bi[i] + dot(P[a], Q[i]), 1, 5);
}

export const MF_K = [1, 2, 3, 5, 8];
export const MF_LAMBDA = [0.01, 0.3, 1, 3, 10];
export type RecoMethod = "pop" | "knn" | "mf";

const MF_CACHE = new Map<string, (a: number, i: number) => number>();
export function mfModel(k: number, lambda: number) {
  const key = `${k}:${lambda}`;
  if (!MF_CACHE.has(key)) MF_CACHE.set(key, factorize(k, lambda));
  return MF_CACHE.get(key)!;
}

export function recoModel(method: RecoMethod, k: number, lambda: number) {
  return method === "pop" ? popularity : method === "knn" ? neighbors : mfModel(k, lambda);
}

export function recoScores(method: RecoMethod, k = 3, lambda = 1) {
  const m = recoModel(method, k, lambda);
  return { train: rmse(m, RATINGS.train), valid: rmse(m, RATINGS.valid) };
}

/** Les films non vus les mieux prédits pour un utilisateur. */
export function recommend(method: RecoMethod, user: number, k = 3, lambda = 1, n = 3) {
  const m = recoModel(method, k, lambda);
  const seen = new Set(RATINGS.train.filter((x) => x.u === user).map((x) => x.i));
  return Array.from({ length: N_ITEMS }, (_, i) => i)
    .filter((i) => !seen.has(i))
    .map((i) => ({ i, score: m(user, i) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

export function bestMf() {
  let best = { k: 0, lambda: 0, valid: Infinity };
  for (const k of MF_K) for (const lambda of MF_LAMBDA) {
    const v = recoScores("mf", k, lambda).valid;
    if (v < best.valid) best = { k, lambda, valid: v };
  }
  return best;
}

// ============================================================ 2. Détection d'anomalies

export type Pt2 = { x: number; y: number; anomaly: boolean };

/** Transactions : un grand groupe diffus, un petit groupe très dense, et des anomalies globales ou locales. */
export const TRANSACTIONS: Pt2[] = (() => {
  const z = normals(2000, 5150);
  let k = 0;
  const pts: Pt2[] = [];
  for (let n = 0; n < 420; n++) pts.push({ x: 3 + 1.3 * z[k++], y: 3 + 1.1 * z[k++], anomaly: false });
  for (let n = 0; n < 160; n++) pts.push({ x: 9 + 0.3 * z[k++], y: 7.5 + 0.3 * z[k++], anomaly: false });
  // anomalies globales : loin de tout
  const far: [number, number][] = [[11.5, 1], [0.2, 9.5], [12, 10.5], [6.5, 11], [-1.5, -1], [12.5, 4.5], [-1, 6.5], [7.5, -0.8]];
  far.forEach(([x, y]) => pts.push({ x, y, anomaly: true }));
  // anomalies locales : à 1,5 à 2 du petit groupe dense, mais dans l'étendue globale des données
  for (let n = 0; n < 12; n++) {
    const a = (n / 12) * 2 * Math.PI + 0.3;
    const r = 1.5 + 0.4 * ((n * 7) % 5) / 4;
    pts.push({ x: 9 + r * Math.cos(a), y: 7.5 + r * Math.sin(a), anomaly: true });
  }
  return pts;
})();

export const N_ANOMALIES = TRANSACTIONS.filter((p) => p.anomaly).length;
export type AnomalyMethod = "zscore" | "knn" | "iforest" | "lof";

function zscoreScores(pts: Pt2[]) {
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const sx = Math.sqrt(pts.reduce((s, p) => s + (p.x - mx) ** 2, 0) / pts.length);
  const sy = Math.sqrt(pts.reduce((s, p) => s + (p.y - my) ** 2, 0) / pts.length);
  return pts.map((p) => Math.max(Math.abs(p.x - mx) / sx, Math.abs(p.y - my) / sy));
}

const K_NEIGH = 10;
function kDistances(pts: Pt2[]) {
  return pts.map((p) =>
    pts
      .map((q) => Math.hypot(p.x - q.x, p.y - q.y))
      .sort((a, b) => a - b)
      .slice(1, K_NEIGH + 1),
  );
}

function knnScores(pts: Pt2[]) {
  return kDistances(pts).map((d) => d[K_NEIGH - 1]);
}

/** Local Outlier Factor simplifié : distance moyenne aux voisins, rapportée à celle des voisins. */
function lofScores(pts: Pt2[]) {
  const neigh = pts.map((p) =>
    pts
      .map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(1, K_NEIGH + 1),
  );
  const avg = neigh.map((ns) => ns.reduce((s, n) => s + n.d, 0) / ns.length);
  return neigh.map((ns, i) => avg[i] / (ns.reduce((s, n) => s + avg[n.j], 0) / ns.length));
}

const cFactor = (n: number) => (n <= 1 ? 0 : 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n);

/** Isolation Forest : une anomalie s'isole en peu de coupes aléatoires. */
function iforestScores(pts: Pt2[], trees = 100, sample = 128) {
  const rnd = mulberry32(777);
  const limit = Math.ceil(Math.log2(sample));
  type Node = { leaf: true; size: number } | { leaf: false; f: "x" | "y"; s: number; l: Node; r: Node };
  const build = (xs: Pt2[], depth: number): Node => {
    if (depth >= limit || xs.length <= 1) return { leaf: true, size: xs.length };
    const f = rnd() < 0.5 ? "x" : "y";
    const lo = Math.min(...xs.map((p) => p[f]));
    const hi = Math.max(...xs.map((p) => p[f]));
    if (hi - lo < 1e-12) return { leaf: true, size: xs.length };
    const s = lo + rnd() * (hi - lo);
    return { leaf: false, f, s, l: build(xs.filter((p) => p[f] < s), depth + 1), r: build(xs.filter((p) => p[f] >= s), depth + 1) };
  };
  const forest: Node[] = [];
  for (let t = 0; t < trees; t++) {
    const sub: Pt2[] = [];
    for (let n = 0; n < sample; n++) sub.push(pts[Math.floor(rnd() * pts.length)]);
    forest.push(build(sub, 0));
  }
  const path = (p: Pt2, node: Node, depth: number): number => (node.leaf ? depth + cFactor(node.size) : path(p, p[node.f] < node.s ? node.l : node.r, depth + 1));
  return pts.map((p) => 2 ** (-(forest.reduce((s, tr) => s + path(p, tr, 0), 0) / trees) / cFactor(sample)));
}

const SCORE_CACHE = new Map<AnomalyMethod, number[]>();
export function anomalyScores(method: AnomalyMethod) {
  if (!SCORE_CACHE.has(method)) {
    const f = { zscore: zscoreScores, knn: knnScores, lof: lofScores, iforest: (p: Pt2[]) => iforestScores(p) }[method];
    SCORE_CACHE.set(method, f(TRANSACTIONS));
  }
  return SCORE_CACHE.get(method)!;
}

export const CONTAMINATIONS = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1];

/** Signaler la part `share` des points les plus suspects. */
export function detect(method: AnomalyMethod, share: number) {
  const s = anomalyScores(method);
  const k = Math.round(share * TRANSACTIONS.length);
  const order = s.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const flagged = new Set(order.slice(0, k).map((o) => o.i));
  const tp = TRANSACTIONS.filter((p, i) => p.anomaly && flagged.has(i)).length;
  return { flagged, k, tp, precision: k ? tp / k : 0, recall: tp / N_ANOMALIES };
}

// ============================================================ 3. Données déséquilibrées

export const IMB = { n: 20000, rate: 0.01, sep: 3.2 };
export type ImbStrategy = "none" | "weights" | "under" | "smote";

/** Scores d'un modèle de fraude ; la stratégie de rééquilibrage décale les probabilités et, en jetant des données, dégrade le classement. */
export const IMB_DATA = (() => {
  const z = normals(IMB.n, 31337);
  const e = normals(IMB.n, 7331);
  const u = mulberry32(4711);
  return z.map((v, i) => {
    const y = (u() < IMB.rate ? 1 : 0) as 0 | 1;
    return { y, x: v + (y ? IMB.sep : 0), e: e[i] };
  });
})();

export const IMB_POS = IMB_DATA.filter((d) => d.y).length;
const PRIOR_LOGIT = Math.log(IMB.rate / (1 - IMB.rate));

export function imbProbas(strategy: ImbStrategy) {
  // Rééquilibrer revient à multiplier les cotes par (1 − π) / π ; le sous-échantillonnage jette 98 % des négatifs et le classement s'en ressent.
  const shift = strategy === "none" ? 0 : -PRIOR_LOGIT;
  const blur = strategy === "under" ? 0.55 : strategy === "smote" ? 0.25 : 0;
  return IMB_DATA.map((d) => {
    const k = Math.sqrt(1 + blur * blur);
    const t = (d.x + blur * d.e) / k; // variable dégradée, standardisée
    const s = IMB.sep / k;
    return sigmoid(PRIOR_LOGIT + shift + s * t - (s * s) / 2);
  });
}

const PROBA_CACHE = new Map<ImbStrategy, number[]>();
const probasOf = (s: ImbStrategy) => {
  if (!PROBA_CACHE.has(s)) PROBA_CACHE.set(s, imbProbas(s));
  return PROBA_CACHE.get(s)!;
};

export function averagePrecision(strategy: ImbStrategy) {
  const p = probasOf(strategy);
  const order = p.map((v, i) => ({ v, y: IMB_DATA[i].y })).sort((a, b) => b.v - a.v);
  let tp = 0;
  let ap = 0;
  order.forEach((o, n) => {
    if (o.y) {
      tp++;
      ap += tp / (n + 1);
    }
  });
  return ap / IMB_POS;
}

export function imbalance(strategy: ImbStrategy, threshold: number) {
  const p = probasOf(strategy);
  let tp = 0, fp = 0, fn = 0, tn = 0;
  p.forEach((v, i) => {
    const pred = v >= threshold;
    const y = IMB_DATA[i].y;
    if (pred && y) tp++;
    else if (pred) fp++;
    else if (y) fn++;
    else tn++;
  });
  const meanProba = p.reduce((s, v) => s + v, 0) / p.length;
  return {
    tp, fp, fn, tn,
    precision: tp + fp ? tp / (tp + fp) : 0,
    recall: tp / IMB_POS,
    accuracy: (tp + tn) / p.length,
    meanProba,
    realRate: IMB_POS / p.length,
    calibrationGap: Math.abs(meanProba - IMB_POS / p.length),
  };
}

export const IMB_THRESHOLDS = Array.from({ length: 99 }, (_, i) => (i + 1) / 100);

// ============================================================ 4. Prompt engineering

export type PromptConfig = {
  instructions: "vague" | "precise";
  examples: "0" | "3-biased" | "3" | "8";
  format: "free" | "json";
  reasoning: boolean;
};

export const CATEGORIES = ["Facturation", "Technique", "Compte", "Livraison"] as const;
export const EVAL_TICKETS = 60;

/** Simulation calibrée sur des ordres de grandeur réalistes d'un classifieur de tickets par LLM. */
export function promptEval(c: PromptConfig) {
  let acc = c.instructions === "precise" ? 0.8 : 0.64;
  acc += { "0": 0, "3-biased": 0.02, "3": 0.1, "8": 0.12 }[c.examples];
  if (c.reasoning) acc += 0.04;
  acc = Math.min(acc, 0.97);
  const parse = c.format === "json" ? 1 : c.reasoning ? 0.75 : c.instructions === "precise" ? 0.9 : 0.82;
  const inputTokens = 120 + (c.instructions === "precise" ? 180 : 20) + { "0": 0, "3-biased": 330, "3": 330, "8": 880 }[c.examples] + (c.format === "json" ? 60 : 0);
  const outputTokens = (c.reasoning ? 350 : 0) + (c.format === "json" ? 15 : 10);
  const correct = Math.round(acc * EVAL_TICKETS);
  const errors = EVAL_TICKETS - correct;
  // Répartition des catégories prédites : les exemples tous « Technique » biaisent les erreurs vers cette classe.
  const per = EVAL_TICKETS / CATEGORIES.length;
  const split = (n: number) => CATEGORIES.map((_, k) => Math.floor(n / CATEGORIES.length) + (k < n % CATEGORIES.length ? 1 : 0));
  const right = split(correct);
  const wrong = c.examples === "3-biased" ? CATEGORIES.map((cat) => (cat === "Technique" ? errors : 0)) : split(errors).reverse();
  const predicted = CATEGORIES.map((cat, k) => ({ cat, n: right[k] + wrong[k], truth: per }));
  return { accuracy: acc, parse, usable: acc * parse, inputTokens, outputTokens, tokens: inputTokens + outputTokens, predicted };
}

export function promptText(c: PromptConfig) {
  const parts: string[] = [];
  parts.push(
    c.instructions === "precise"
      ? "Tu classes des tickets de support client dans exactement une catégorie : Facturation (paiement, remboursement, facture), Technique (bug, connexion, application), Compte (identifiants, profil, suppression), Livraison (colis, retard, adresse). Si un ticket en mentionne plusieurs, choisis le problème que le client veut voir résolu."
      : "Classe ce ticket de support.",
  );
  if (c.examples !== "0") {
    const ex =
      c.examples === "3-biased"
        ? ["« L'appli plante au démarrage » → Technique", "« Écran blanc après la mise à jour » → Technique", "« Impossible de me connecter » → Technique"]
        : ["« Mon colis n'est jamais arrivé » → Livraison", "« J'ai été prélevé deux fois » → Facturation", "« L'appli plante au démarrage » → Technique"];
    if (c.examples === "8") ex.push("« Je veux supprimer mon compte » → Compte", "… 4 autres exemples, 2 par catégorie");
    parts.push("Exemples :\n" + ex.join("\n"));
  }
  if (c.reasoning) parts.push("Réfléchis étape par étape avant de répondre.");
  parts.push(c.format === "json" ? 'Réponds avec le schéma JSON : {"categorie": "Facturation" | "Technique" | "Compte" | "Livraison"}' : "Réponds avec la catégorie.");
  parts.push("Ticket : « Le livreur a laissé le colis chez le voisin et on me facture des frais de retour. »");
  return parts.join("\n\n");
}

// ============================================================ 5. Alignement

export const KL_STEPS = [0, 1, 2, 4, 8, 16, 32, 64, 100];
export type RmSize = "small" | "large";
const GOLD = { small: { a: 1.0, b: 0.12 }, large: { a: 1.1, b: 0.07 } };

/** Courbes de sur-optimisation : le score du reward model monte toujours, la qualité jugée par des humains finit par baisser. */
export function alignment(kl: number, rm: RmSize) {
  const d = Math.sqrt(kl);
  const proxy = d * (1.2 - 0.02 * d);
  const g = GOLD[rm];
  const gold = d * (g.a - g.b * d);
  const length = Math.round(180 * (1 + 0.06 * d * d));
  const optimum = g.a / (2 * g.b);
  const regime: "base" | "aligned" | "hacking" = kl === 0 ? "base" : d <= optimum * 1.15 ? "aligned" : "hacking";
  return { d, proxy, gold, length, regime };
}

export const BEST_GOLD = Math.max(...(["small", "large"] as RmSize[]).flatMap((rm) => KL_STEPS.map((kl) => alignment(kl, rm).gold)));
