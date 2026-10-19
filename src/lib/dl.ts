// Calculs du module Deep learning (suite) : régularisation, transfer learning, convolutions, embeddings.
import { mulberry32 } from "./metrics";
import type { P2 } from "./ml";
import { circles, CIRCLE_TRAIN, cloneNet, forward, initNet, makeAdam, meanLoss, netAccuracy, zeroGrads, backward, type Grads, type Net } from "./nn";
import { symEig } from "./llm2";

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

// ============================================================ Régularisation : dropout, weight decay, early stopping

/** Peu de données, beaucoup de bruit : le terrain idéal pour sur-apprendre. */
export const SMALL_TRAIN = circles(60, 0.22, 91);
export const SMALL_VAL = circles(400, 0.22, 92);

/** Rétropropagation avec dropout « inversé » sur la couche cachée (tanh). */
function backwardDropout(n: Net, batch: P2[], g: Grads, p: number, rand: () => number) {
  const z = new Float64Array(n.H), h = new Float64Array(n.H), m = new Float64Array(n.H);
  for (const pt of batch) {
    let out = n.b2;
    for (let j = 0; j < n.H; j++) {
      z[j] = n.W1[2 * j] * pt.x + n.W1[2 * j + 1] * pt.y + n.b1[j];
      m[j] = rand() < p ? 0 : 1 / (1 - p);
      h[j] = Math.tanh(z[j]);
      out += n.W2[j] * h[j] * m[j];
    }
    const dout = (sigmoid(out) - pt.c) / batch.length;
    g.b2 += dout;
    for (let j = 0; j < n.H; j++) {
      g.W2[j] += dout * h[j] * m[j];
      const dz = dout * n.W2[j] * m[j] * (1 - h[j] * h[j]);
      g.W1[2 * j] += dz * pt.x;
      g.W1[2 * j + 1] += dz * pt.y;
      g.b1[j] += dz;
    }
  }
}

export type RegConfig = { dropout: 0 | 0.3 | 0.5; wd: 0 | 0.001 | 0.01; epochs?: number };
export const REG_EPOCHS = 600;
export const REG_H = 64;
export const REG_EVERY = 5;

/** Entraînement plein batch (AdamW) ; courbes de loss d'entraînement et de validation à chaque époque. */
export function trainRegularized(cfg: RegConfig, train: P2[] = SMALL_TRAIN, val: P2[] = SMALL_VAL, seed = 5) {
  const net = initNet(REG_H, "tanh", seed);
  const lr = 0.02;
  const adam = makeAdam(REG_H, lr);
  const rand = mulberry32(seed + 1);
  const trainLoss: number[] = [], valLoss: number[] = [], valAcc: number[] = [];
  const snapshots: Net[] = [];
  const epochs = cfg.epochs ?? REG_EPOCHS;
  for (let e = 0; e < epochs; e++) {
    const g = zeroGrads(REG_H);
    if (cfg.dropout > 0) backwardDropout(net, train, g, cfg.dropout, rand);
    else backward(net, train, g);
    adam(net, g);
    if (cfg.wd > 0) {
      // Weight decay découplé (AdamW) : on rétrécit les poids, pas les biais.
      for (let i = 0; i < net.W1.length; i++) net.W1[i] *= 1 - lr * cfg.wd * 50;
      for (let j = 0; j < net.H; j++) net.W2[j] *= 1 - lr * cfg.wd * 50;
    }
    // Mesures toutes les REG_EVERY époques (une courbe de 120 points suffit, et c'est 5 fois plus rapide).
    if (e % REG_EVERY === REG_EVERY - 1) {
      trainLoss.push(meanLoss(net, train));
      valLoss.push(meanLoss(net, val));
      valAcc.push(netAccuracy(net, val));
      snapshots.push(cloneNet(net));
    }
  }
  const best = valLoss.indexOf(Math.min(...valLoss)); // indice de mesure ; époque = (best + 1) × REG_EVERY
  return { trainLoss, valLoss, valAcc, net, best, snapshots };
}

// ============================================================ Transfer learning

/** La tâche cible : les mêmes cercles, déplacés et étirés (une autre caméra, un autre capteur). */
const warp = (p: P2): P2 => ({ x: 1.2 * p.x + 0.15, y: 0.85 * p.y - 0.1, c: p.c });
export const TARGET_TEST = circles(400, 0.12, 301).map(warp);
export const targetTrain = (n: number) => circles(n, 0.12, 300 + n).map(warp);
export const TRANSFER_SIZES = [8, 16, 32, 64, 128];

let pretrained: Net | null = null;
/** Réseau entraîné sur la tâche source (beaucoup de données). */
export function getPretrained() {
  if (!pretrained) {
    const net = initNet(16, "tanh", 7);
    const adam = makeAdam(16, 0.05);
    for (let e = 0; e < 400; e++) {
      const g = zeroGrads(16);
      backward(net, CIRCLE_TRAIN, g);
      adam(net, g);
    }
    pretrained = net;
  }
  return pretrained;
}

export type TransferMode = "scratch" | "frozen" | "finetune";

/** Pour « depuis zéro », la précision est moyennée sur 3 initialisations : avec si peu de données, une seule graine est trop bruitée. */
export function transferRun(mode: TransferMode, n: number, epochs = 300) {
  if (mode === "scratch") {
    const runs = [11, 12, 13].map((seed) => transferOne(mode, n, epochs, seed));
    return { ...runs[0], acc: runs.reduce((a, r) => a + r.acc, 0) / runs.length };
  }
  return transferOne(mode, n, epochs, 11);
}

function transferOne(mode: TransferMode, n: number, epochs: number, seed: number) {
  const train = targetTrain(n);
  const net = mode === "scratch" ? initNet(16, "tanh", seed) : cloneNet(getPretrained());
  const adam = makeAdam(16, mode === "finetune" ? 0.01 : 0.05);
  for (let e = 0; e < epochs; e++) {
    const g = zeroGrads(16);
    backward(net, train, g);
    if (mode === "frozen") {
      g.W1.fill(0);
      g.b1.fill(0);
    }
    const W1 = net.W1.slice(), b1 = net.b1.slice();
    adam(net, g);
    if (mode === "frozen") {
      net.W1.set(W1);
      net.b1.set(b1);
    }
  }
  return { net, acc: netAccuracy(net, TARGET_TEST), train };
}

// ============================================================ Convolutions

export const IMG = 20;
type Img = number[][];
const blank = (): Img => Array.from({ length: IMG }, () => new Array(IMG).fill(0));

export function vBar(): Img {
  const m = blank();
  for (let i = 3; i < 17; i++) for (let j = 3; j < 6; j++) m[i][j] = 1;
  return m;
}
export function hBar(): Img {
  const m = blank();
  for (let i = 14; i < 17; i++) for (let j = 8; j < 18; j++) m[i][j] = 1;
  return m;
}
/** Une diagonale « \ » (de haut à gauche vers le bas à droite), épaisse de 3 pixels. */
export function diag(): Img {
  const m = blank();
  for (let k = 0; k < 10; k++) for (let t = -1; t <= 1; t++) {
    const i = 2 + k, j = 8 + k + t;
    if (j >= 0 && j < IMG) m[i][j] = 1;
  }
  return m;
}
export const SCENE: Img = (() => {
  const a = vBar(), b = hBar(), c = diag();
  return a.map((row, i) => row.map((v, j) => Math.max(v, b[i][j], c[i][j])));
})();

/** Convolution 3 × 3 avec padding 1 (même taille) et pas de 1. (Comme en deep learning : sans retourner le noyau.) */
export function conv(img: Img, k: number[][]): Img {
  const n = img.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const x = img[i + a]?.[j + b] ?? 0;
        s += x * k[a + 1][b + 1];
      }
      return s;
    }),
  );
}
export const relu = (m: Img) => m.map((r) => r.map((v) => Math.max(0, v)));
export function maxPool(m: Img): Img {
  const n = Math.floor(m.length / 2);
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.max(m[2 * i][2 * j], m[2 * i][2 * j + 1], m[2 * i + 1][2 * j], m[2 * i + 1][2 * j + 1])));
}

const energy = (m: Img) => m.reduce((s, r) => s + r.reduce((t, v) => t + Math.max(0, v), 0), 0);

/** Réponse (après ReLU) du filtre à chacune des trois formes, isolée. */
export function kernelResponses(k: number[][]) {
  return { vertical: energy(conv(vBar(), k)), horizontal: energy(conv(hBar(), k)), diagonal: energy(conv(diag(), k)) };
}

export const KERNELS: Record<string, number[][]> = {
  identite: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
  flou: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
  verticaux: [[1, 0, -1], [2, 0, -2], [1, 0, -1]],
  horizontaux: [[1, 2, 1], [0, 0, 0], [-1, -2, -1]],
  nettete: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
};

// ============================================================ Embeddings (PPMI + SVD sur un petit corpus)

const GROUPS = {
  animaux: ["chat", "chien", "lapin", "cheval", "souris"],
  fruits: ["pomme", "poire", "banane", "cerise", "fraise"],
  pays: ["france", "italie", "espagne", "japon", "allemagne"],
  capitales: ["paris", "rome", "madrid", "tokyo", "berlin"],
} as const;
export const EMB_GROUPS = GROUPS;
export const EMB_WORDS: string[] = Object.values(GROUPS).flat();
export const groupOf = (w: string) => (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).find((g) => (GROUPS[g] as readonly string[]).includes(w))!;

/** Corpus généré : des phrases simples, où chaque mot apparaît dans des contextes typiques de sa catégorie. */
export function embCorpus(seed = 3) {
  const r = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const S: string[] = [];
  for (let rep = 0; rep < 12; rep++) {
    for (const a of GROUPS.animaux)
      S.push(pick([`le ${a} dort sur le canapé`, `mon ${a} court dans le jardin`, `le ${a} mange ses croquettes`, `le vétérinaire soigne le ${a}`, `le ${a} joue avec la balle`]));
    for (const f of GROUPS.fruits)
      S.push(pick([`je mange une ${f} bien mûre`, `la ${f} est sucrée et juteuse`, `une tarte à la ${f}`, `le jus de ${f} est frais`, `je cueille une ${f} au verger`]));
    GROUPS.pays.forEach((p, i) => {
      const c = GROUPS.capitales[i];
      S.push(
        pick([
          `${c} est la capitale de la ${p}`,
          `le gouvernement de la ${p} siège à ${c}`,
          `je voyage à ${c} en ${p}`,
          `la ${p} est un grand pays et ${c} sa capitale`,
          `les touristes visitent ${c} la capitale`,
          `la ${p} a une frontière et une économie`,
          `les habitants de la ${p} votent`,
          `le musée de ${c} est célèbre`,
        ]),
      );
    });
  }
  return S;
}

/** Matrice de co-occurrence (fenêtre de 2 mots), PPMI, puis SVD tronquée : chaque mot devient un vecteur dense. */
export function trainEmbeddings(dim = 6) {
  const sents = embCorpus().map((s) => s.split(" "));
  const vocab = [...new Set(sents.flat())];
  const idx = new Map(vocab.map((w, i) => [w, i]));
  const V = vocab.length;
  const C = Array.from({ length: V }, () => new Float64Array(V));
  for (const s of sents)
    s.forEach((w, i) => {
      for (let d = -2; d <= 2; d++) if (d && s[i + d]) C[idx.get(w)!][idx.get(s[i + d])!] += 1;
    });
  const total = C.reduce((a, row) => a + row.reduce((b, v) => b + v, 0), 0);
  const rowS = C.map((row) => row.reduce((b, v) => b + v, 0));
  const colS = vocab.map((_, j) => C.reduce((b, row) => b + row[j], 0));
  const P = C.map((row, i) => Array.from(row, (v, j) => (v > 0 ? Math.max(0, Math.log((v * total) / (rowS[i] * colS[j]))) : 0)));
  // Vecteurs propres de P·Pᵀ (= vecteurs singuliers gauches de P) restreints aux mots étudiés.
  const rows = EMB_WORDS.map((w) => P[idx.get(w)!]);
  const G = rows.map((a) => rows.map((b) => a.reduce((s, v, k) => s + v * b[k], 0)));
  const { values, vectors } = symEig(G);
  const vecs = EMB_WORDS.map((_, i) => Array.from({ length: dim }, (_, k) => vectors[k][i] * Math.sqrt(Math.max(values[k], 0))));
  return Object.fromEntries(EMB_WORDS.map((w, i) => [w, vecs[i]])) as Record<string, number[]>;
}

export const cosine = (a: number[], b: number[]) => {
  const d = a.reduce((s, v, i) => s + v * b[i], 0);
  return d / (Math.hypot(...a) * Math.hypot(...b) || 1);
};

export function neighbors(E: Record<string, number[]>, v: number[], exclude: string[] = [], k = 3) {
  return EMB_WORDS.filter((w) => !exclude.includes(w))
    .map((w) => ({ w, s: cosine(E[w], v) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k);
}

export const analogy = (E: Record<string, number[]>, a: string, b: string, c: string) =>
  neighbors(E, E[a].map((v, i) => v - E[b][i] + E[c][i]), [a, b, c], 3);

/** Projection 2D (ACP des vecteurs) pour la carte. */
export function project2d(E: Record<string, number[]>) {
  const X = EMB_WORDS.map((w) => E[w]);
  const d = X[0].length;
  const mu = Array.from({ length: d }, (_, k) => X.reduce((s, x) => s + x[k], 0) / X.length);
  const Z = X.map((x) => x.map((v, k) => v - mu[k]));
  const Cv = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => Z.reduce((s, z) => s + z[a] * z[b], 0)));
  const { vectors } = symEig(Cv);
  return Object.fromEntries(EMB_WORDS.map((w, i) => [w, [0, 1].map((k) => Z[i].reduce((s, v, j) => s + v * vectors[k][j], 0))])) as Record<string, [number, number]>;
}

// ============================================================ Réseaux récurrents : le gradient à travers le temps

/** Facteur par lequel le gradient est multiplié en remontant t pas, pour un RNN (poids récurrent w, dérivée moyenne de tanh d) et un LSTM (porte d'oubli f). */
export const rnnGradient = (w: number, t: number, d = 0.8) => Math.abs(w * d) ** t;
export const lstmGradient = (f: number, t: number) => f ** t;

export { forward };
