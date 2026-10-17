// Petit réseau de neurones (2 → H → 1) entraîné dans le navigateur, avec rétropropagation écrite à la main.
// Sert aux labos du module Deep learning ; les « bugs » simulent des erreurs classiques de boucle d'entraînement.
import { mulberry32, normals } from "./metrics";
import type { P2 } from "./ml";

export type Act = "linear" | "relu" | "tanh";

const act = (a: Act, z: number) => (a === "relu" ? Math.max(0, z) : a === "tanh" ? Math.tanh(z) : z);
const dact = (a: Act, z: number, h: number) => (a === "relu" ? (z > 0 ? 1 : 0) : a === "tanh" ? 1 - h * h : 1);
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export type Net = { H: number; act: Act; W1: Float64Array; b1: Float64Array; W2: Float64Array; b2: number };

/** Initialisation de He (ReLU) ou de Xavier (tanh, linéaire) : variance adaptée au nombre d'entrées. */
export function initNet(H: number, a: Act, seed = 1): Net {
  const z = normals(3 * H, seed);
  const s1 = a === "relu" ? Math.sqrt(2 / 2) : Math.sqrt(1 / 2);
  const s2 = a === "relu" ? Math.sqrt(2 / H) : Math.sqrt(1 / H);
  return {
    H,
    act: a,
    W1: Float64Array.from({ length: 2 * H }, (_, i) => z[i] * s1),
    b1: new Float64Array(H),
    W2: Float64Array.from({ length: H }, (_, i) => z[2 * H + i] * s2),
    b2: 0,
  };
}

export const cloneNet = (n: Net): Net => ({ ...n, W1: n.W1.slice(), b1: n.b1.slice(), W2: n.W2.slice() });

/** Probabilité de la classe 1. */
export function forward(n: Net, x: number, y: number) {
  let out = n.b2;
  for (let j = 0; j < n.H; j++) out += n.W2[j] * act(n.act, n.W1[2 * j] * x + n.W1[2 * j + 1] * y + n.b1[j]);
  return sigmoid(out);
}

export type Grads = { W1: Float64Array; b1: Float64Array; W2: Float64Array; b2: number };
export const zeroGrads = (H: number): Grads => ({ W1: new Float64Array(2 * H), b1: new Float64Array(H), W2: new Float64Array(H), b2: 0 });

/** Ajoute à g le gradient de la log-loss moyenne sur `batch` (équivalent de loss.backward()). Renvoie la loss. */
export function backward(n: Net, batch: P2[], g: Grads, xScale = 1) {
  const z = new Float64Array(n.H), h = new Float64Array(n.H);
  let loss = 0;
  for (const p of batch) {
    const x = p.x * xScale, y = p.y * xScale;
    let out = n.b2;
    for (let j = 0; j < n.H; j++) {
      z[j] = n.W1[2 * j] * x + n.W1[2 * j + 1] * y + n.b1[j];
      h[j] = act(n.act, z[j]);
      out += n.W2[j] * h[j];
    }
    const pr = sigmoid(out);
    loss -= p.c ? Math.log(Math.max(pr, 1e-12)) : Math.log(Math.max(1 - pr, 1e-12));
    const dout = (pr - p.c) / batch.length; // dL/d(logit) = p − y
    g.b2 += dout;
    for (let j = 0; j < n.H; j++) {
      g.W2[j] += dout * h[j];
      const dz = dout * n.W2[j] * dact(n.act, z[j], h[j]);
      g.W1[2 * j] += dz * x;
      g.W1[2 * j + 1] += dz * y;
      g.b1[j] += dz;
    }
  }
  return loss / batch.length;
}

export function sgdStep(n: Net, g: Grads, lr: number) {
  for (let i = 0; i < n.W1.length; i++) n.W1[i] -= lr * g.W1[i];
  for (let j = 0; j < n.H; j++) {
    n.b1[j] -= lr * g.b1[j];
    n.W2[j] -= lr * g.W2[j];
  }
  n.b2 -= lr * g.b2;
}

export const netAccuracy = (n: Net, pts: P2[], xScale = 1) => pts.filter((p) => (forward(n, p.x * xScale, p.y * xScale) >= 0.5 ? 1 : 0) === p.c).length / pts.length;

export function meanLoss(n: Net, pts: P2[], xScale = 1) {
  let s = 0;
  for (const p of pts) {
    const pr = forward(n, p.x * xScale, p.y * xScale);
    s -= p.c ? Math.log(Math.max(pr, 1e-12)) : Math.log(Math.max(1 - pr, 1e-12));
  }
  return s / pts.length;
}

// ============================================================ Données : deux cercles concentriques

/** Classe 1 au centre, classe 0 en anneau : aucune droite ne peut les séparer. */
export function circles(n: number, noise: number, seed: number): P2[] {
  const r = mulberry32(seed);
  const z = normals(2 * n, seed + 1);
  return Array.from({ length: n }, (_, i) => {
    const c = (i % 2) as 0 | 1;
    const t = 2 * Math.PI * r();
    const rad = c === 1 ? 0.45 * Math.sqrt(r()) : 0.85 + 0.3 * r();
    return { x: rad * Math.cos(t) + noise * z[2 * i], y: rad * Math.sin(t) + noise * z[2 * i + 1], c };
  });
}
export const CIRCLE_TRAIN = circles(200, 0.08, 31);
export const CIRCLE_TEST = circles(400, 0.08, 57);
export const CIRCLE_DOMAIN = { x: [-1.45, 1.45] as [number, number], y: [-1.45, 1.45] as [number, number] };

/** Adam : moyenne mobile du gradient (momentum) et de son carré (pas adaptatif par paramètre). */
export function makeAdam(H: number, lr = 0.05, b1 = 0.9, b2 = 0.999) {
  const m = zeroGrads(H), v = zeroGrads(H);
  let t = 0;
  const upd = (p: Float64Array, g: Float64Array, mm: Float64Array, vv: Float64Array, c1: number, c2: number) => {
    for (let i = 0; i < p.length; i++) {
      mm[i] = b1 * mm[i] + (1 - b1) * g[i];
      vv[i] = b2 * vv[i] + (1 - b2) * g[i] * g[i];
      p[i] -= (lr * (mm[i] / c1)) / (Math.sqrt(vv[i] / c2) + 1e-8);
    }
  };
  return (n: Net, g: Grads) => {
    t++;
    const c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
    upd(n.W1, g.W1, m.W1, v.W1, c1, c2);
    upd(n.b1, g.b1, m.b1, v.b1, c1, c2);
    upd(n.W2, g.W2, m.W2, v.W2, c1, c2);
    m.b2 = b1 * m.b2 + (1 - b1) * g.b2;
    v.b2 = b2 * v.b2 + (1 - b2) * g.b2 * g.b2;
    n.b2 -= (lr * (m.b2 / c1)) / (Math.sqrt(v.b2 / c2) + 1e-8);
  };
}

// ============================================================ Boucle d'entraînement (et ses bugs)

export type Bug = "none" | "zero-grad" | "lr" | "scale" | "shuffle";

export const BUGS: { id: Bug; label: string; code: string }[] = [
  { id: "none", label: "Aucun bug", code: "" },
  { id: "zero-grad", label: "Oubli de optimizer.zero_grad()", code: "# optimizer.zero_grad()  ← oublié" },
  { id: "lr", label: "Learning rate 20 fois trop grand", code: "optimizer = SGD(model.parameters(), lr=10.0)" },
  { id: "scale", label: "Entrées non normalisées (× 50)", code: "X = X_raw  # au lieu de (X_raw - mu) / sigma" },
  { id: "shuffle", label: "Mini-batches non mélangés (triés par classe)", code: "DataLoader(ds, batch_size=20, shuffle=False)" },
];

export const LOOP = { H: 16, act: "tanh" as Act, lr: 0.5, batch: 20, epochs: 40 };

export type Run = { loss: number[]; valAcc: number[]; net: Net; xScale: number; stepsPerEpoch: number };

/**
 * Entraîne le réseau comme le ferait une boucle PyTorch : mini-batches, zero_grad, backward, step.
 * Chaque bug modifie une seule chose, comme dans du vrai code.
 */
export function trainLoop(train: P2[], val: P2[], bug: Bug, epochs = LOOP.epochs, seed = 3): Run {
  const net = initNet(LOOP.H, LOOP.act, seed);
  const lr = bug === "lr" ? LOOP.lr * 20 : LOOP.lr;
  const xScale = bug === "scale" ? 50 : 1;
  const rand = mulberry32(seed + 100);
  let g = zeroGrads(LOOP.H);
  const loss: number[] = [], valAcc: number[] = [];
  const sorted = [...train].sort((a, b) => a.c - b.c);
  for (let e = 0; e < epochs; e++) {
    let order: P2[];
    if (bug === "shuffle") order = sorted;
    else {
      order = [...train];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    for (let s = 0; s < order.length; s += LOOP.batch) {
      if (bug !== "zero-grad") g = zeroGrads(LOOP.H);
      backward(net, order.slice(s, s + LOOP.batch), g, xScale);
      sgdStep(net, g, lr);
      // Loss sur tout le jeu d'entraînement après chaque pas : on voit les oscillations.
      const l = meanLoss(net, train, xScale);
      loss.push(Number.isFinite(l) ? Math.min(l, 3) : 3);
    }
    valAcc.push(netAccuracy(net, val, xScale));
  }
  return { loss, valAcc, net, xScale, stepsPerEpoch: Math.ceil(train.length / LOOP.batch) };
}

// ============================================================ Labo « du neurone au réseau »

export const NEURONS = [1, 2, 3, 4, 6, 8, 16, 32];
export const NN_EPOCHS = 400;

/** Entraînement plein batch (descente de gradient classique), pour le labo d'architecture. */
export function makeTrainer(train: P2[], H: number, a: Act, seed = 7) {
  const net = initNet(H, a, seed);
  const adam = makeAdam(H, 0.05);
  const losses: number[] = [];
  return {
    net,
    losses,
    /** Fait `n` époques de plus (plein batch). */
    run(n: number) {
      for (let e = 0; e < n && losses.length < NN_EPOCHS; e++) {
        const g = zeroGrads(H);
        losses.push(backward(net, train, g));
        adam(net, g);
      }
      return losses.length >= NN_EPOCHS;
    },
  };
}

export function trainFull(train: P2[], H: number, a: Act) {
  const t = makeTrainer(train, H, a);
  t.run(NN_EPOCHS);
  return { net: t.net, losses: t.losses };
}
