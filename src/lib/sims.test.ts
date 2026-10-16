import { describe, expect, it } from "vitest";
import { bayes, errorCurve, gdSteps, makeBvData, mse, polyFit, roundCounts, sampleMeans, DISTS, meanSd, W_GLOBAL, W_LOCAL, W_PEAK, trueFn } from "./sims";
import { CHALLENGES } from "./challenges";
import { mulberry32 } from "./metrics";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("Bayes", () => {
  it("test médical classique : 1 %, 90 %, 95 % → PPV ≈ 15 %", () => {
    expect(bayes({ prevalence: 0.01, sensitivity: 0.9, specificity: 0.95 }).ppv).toBeCloseTo(0.1538, 3);
  });
  it("roundCounts conserve le total", () => {
    expect(roundCounts([1.4, 2.4, 3.2], 7).reduce((a, b) => a + b)).toBe(7);
  });
  it("défis : départ non résolu, solutions atteignables avec les pas des curseurs", () => {
    const start = { prevalence: 0.01, sensitivity: 0.9, specificity: 0.95 };
    expect(C("ppv-90", start)).toBe(false);
    expect(C("ppv-50", start)).toBe(false);
    expect(C("ppv-90", { prevalence: 0.01, sensitivity: 0.99, specificity: 0.999 })).toBe(true);
    // curseur prévalence : pas de 0,001
    const ok = Array.from({ length: 300 }, (_, i) => (i + 1) / 1000).some((p) =>
      C("ppv-50", { prevalence: p, sensitivity: 0.9, specificity: 0.95 }),
    );
    expect(ok).toBe(true);
  });
});

describe("descente de gradient", () => {
  it("points critiques", () => {
    expect(W_GLOBAL).toBeCloseTo(-1.48, 1);
    expect(W_LOCAL).toBeCloseTo(1.33, 1);
    expect(W_PEAK).toBeGreaterThan(W_GLOBAL);
    expect(W_PEAK).toBeLessThan(W_LOCAL);
  });
  const lrs = Array.from({ length: 120 }, (_, i) => (i + 1) / 100); // curseur : 0,01 → 1,20
  it("gd-converge faisable depuis w0 = -0,3 et pas avec lr 0,05", () => {
    const run = (lr: number) => ({ w0: -0.3, lr, path: gdSteps({ ws: [-0.3], diverged: false }, lr, 10) });
    expect(lrs.some((lr) => C("gd-converge", run(lr)))).toBe(true);
    expect(C("gd-converge", run(0.05))).toBe(false);
  });
  it("gd-diverge faisable", () => {
    expect(lrs.some((lr) => C("gd-diverge", { w0: -0.3, lr, path: gdSteps({ ws: [-0.3], diverged: false }, lr, 30) }))).toBe(true);
  });
  it("gd-escape : impossible avec un petit lr, possible avec un grand", () => {
    const run = (lr: number) => ({ w0: 2, lr, path: gdSteps({ ws: [2], diverged: false }, lr, 30) });
    expect(C("gd-escape", run(0.1))).toBe(false);
    expect(lrs.some((lr) => C("gd-escape", run(lr)))).toBe(true);
  });
});

describe("TCL", () => {
  it("l'écart-type des moyennes ≈ σ/√n", () => {
    const xs = sampleMeans(DISTS.exponentielle, 16, 4000, mulberry32(3));
    const { mean, sd } = meanSd(xs);
    expect(mean).toBeCloseTo(1, 1);
    expect(sd).toBeCloseTo(0.25, 1);
  });
});

describe("bias-variance", () => {
  it("un polynôme de degré 1 retrouve une droite", () => {
    const pts = [-1, -0.5, 0, 0.5, 1].map((x) => ({ x, y: 2 * x + 1 }));
    expect(polyFit(pts, 1)(0.3)).toBeCloseTo(1.6, 6);
  });
  it("forme en U de l'erreur de test, train décroissante", () => {
    const { train, test } = makeBvData(20, 0.3);
    const e = errorCurve(train, test);
    expect(e[15].train).toBeLessThan(e[1].train);
    const best = e.reduce((a, b) => (b.test < a.test ? b : a));
    expect(best.degree).toBeGreaterThan(1);
    expect(best.degree).toBeLessThan(12);
    expect(e[14].test).toBeGreaterThan(best.test * 1.5);
  });
  const state = (degree: number, n: number, noise: number) => {
    const { train, test } = makeBvData(n, noise);
    const f = polyFit(train, degree);
    return { degree, n, noise, train, test, trainMse: mse(f, train), testMse: mse(f, test) };
  };
  it("défis : départ (degré 1, n 20, bruit 0,3) non résolu, solutions atteignables", () => {
    expect(C("bv-best", state(1, 20, 0.3))).toBe(false);
    expect(C("bv-overfit", state(1, 20, 0.3))).toBe(false);
    expect(C("bv-data", state(12, 20, 0.3))).toBe(false);
    expect([...Array(16).keys()].some((d) => C("bv-best", state(d, 20, 0.3)))).toBe(true);
    expect([...Array(16).keys()].some((d) => C("bv-overfit", state(d, 20, 0.3)))).toBe(true);
    const ns = [40, 60, 80, 100, 150, 200];
    expect(ns.some((n) => C("bv-data", state(12, n, 0.3)))).toBe(true);
  });
  it("le vrai modèle a une erreur proche du bruit", () => {
    const { test } = makeBvData(20, 0.3);
    expect(mse(trueFn, test)).toBeCloseTo(0.09, 1);
  });
});
