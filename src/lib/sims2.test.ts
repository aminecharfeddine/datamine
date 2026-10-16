import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { mulberry32 } from "./metrics";
import { AB_BASE, ciHalfWidth, drawInterval, LOG_LAMBDAS, makeBvData, mse, normCdf, polyFit, ridgeCurve, RIDGE_DEGREE, runAb, twoPropTest } from "./sims";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("tests A/B", () => {
  it("normCdf", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
  });
  it("test z : valeurs connues", () => {
    const r = twoPropTest(100, 130, 1000);
    expect(r.p).toBeGreaterThan(0.03);
    expect(r.p).toBeLessThan(0.045);
  });
  it("sous H0, ~5 % de faux positifs", () => {
    const rand = mulberry32(1);
    let sig = 0;
    for (let i = 0; i < 1000; i++) if (runAb(1000, AB_BASE, AB_BASE, rand).p < 0.05) sig++;
    expect(sig / 1000).toBeGreaterThan(0.03);
    expect(sig / 1000).toBeLessThan(0.075);
  });
  it("puissance : n = 500 trop faible, n = 6000 suffisant pour +2 points", () => {
    const power = (n: number) => {
      const rand = mulberry32(n);
      let sig = 0;
      for (let i = 0; i < 200; i++) if (runAb(n, AB_BASE, AB_BASE + 0.02, rand).p < 0.05) sig++;
      return sig / 200;
    };
    expect(power(500)).toBeLessThan(0.4);
    expect(power(6000)).toBeGreaterThan(0.85);
    expect(C("pv-power", { n: 6000, effect: 0.02, runs: 30, significant: 26 })).toBe(true);
    expect(C("pv-false", { n: 1000, effect: 0, runs: 40, significant: 2 })).toBe(true);
    expect(C("pv-false", { n: 1000, effect: 0.02, runs: 40, significant: 2 })).toBe(false);
  });
});

describe("intervalles de confiance", () => {
  it("couverture ≈ niveau", () => {
    const rand = mulberry32(9);
    let hit = 0;
    for (let i = 0; i < 2000; i++) if (drawInterval(30, 0.95, rand).hit) hit++;
    expect(hit / 2000).toBeGreaterThan(0.93);
    expect(hit / 2000).toBeLessThan(0.97);
  });
  it("ci-narrow faisable avec le curseur n (pas de 5, max 300)", () => {
    expect(ciHalfWidth(20, 0.99)).toBeGreaterThan(2);
    const ok = Array.from({ length: 60 }, (_, i) => 5 + i * 5).some((n) => C("ci-narrow", { n, level: 0.99, count: 20, hits: 20 }));
    expect(ok).toBe(true);
  });
});

describe("régularisation", () => {
  const { train, test } = makeBvData(20, 0.3);
  const state = (l: number) => {
    const f = polyFit(train, RIDGE_DEGREE, 10 ** l);
    return { logLambda: l, train, test, trainMse: mse(f, train), testMse: mse(f, test) };
  };
  it("courbe en U en λ", () => {
    const c = ridgeCurve(train, test);
    const best = c.reduce((a, b) => (b.test < a.test ? b : a));
    expect(best.logLambda).toBeGreaterThan(-6);
    expect(best.logLambda).toBeLessThan(2);
    expect(c[0].test).toBeGreaterThan(best.test * 1.3);
  });
  it("défis : départ λ = 10⁻⁶ non résolu, solutions sur la grille", () => {
    expect(C("ridge-best", state(-6))).toBe(false);
    expect(C("ridge-under", state(-6))).toBe(false);
    expect(LOG_LAMBDAS.some((l) => C("ridge-best", state(l)))).toBe(true);
    expect(LOG_LAMBDAS.some((l) => C("ridge-under", state(l)))).toBe(true);
  });
  it("polyFit expose ses coefficients", () => {
    expect(polyFit(train, 3).coef).toHaveLength(4);
  });
});

describe("réglages de départ des leçons", () => {
  it("ridge-under non résolu à λ = 10⁻²", () => {
    const { train, test } = makeBvData(20, 0.3);
    const f = polyFit(train, RIDGE_DEGREE, 0.01);
    expect(C("ridge-under", { logLambda: -2, train, test, trainMse: mse(f, train), testMse: mse(f, test) })).toBe(false);
  });
});
