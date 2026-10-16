import { describe, expect, it } from "vitest";
import { auc, makeDataset, metricsAt, rocCurve } from "./metrics";
import { CHALLENGES } from "./challenges";

// Chaque défi doit être faisable avec ses réglages par défaut (cf. MDX).
function solvable(id: string, sep: number, prevs: number[]) {
  for (const prevalence of prevs) {
    const data = makeDataset(sep, prevalence);
    const rocAuc = auc(rocCurve(data));
    for (let t = 0; t <= 1; t += 0.005) {
      const metrics = metricsAt(data, t);
      if (CHALLENGES[id].check({ data, threshold: t, separation: sep, prevalence, metrics, rocAuc })) return true;
    }
  }
  return false;
}

describe("défis faisables", () => {
  it("recall-90 (sep 2, prev 0.4)", () => expect(solvable("recall-90", 2, [0.4])).toBe(true));
  it("zero-fp (sep 3, prev 0.4)", () => expect(solvable("zero-fp", 3, [0.4])).toBe(true));
  it("best-f1", () => expect(solvable("best-f1", 3, [0.4])).toBe(true));
  it("random-model", () => {
    const ok = [0, 0.25, 0.5].some((s) => solvable("random-model", s, [0.3]));
    expect(ok).toBe(true);
  });
  it("imbalance-trap (sep 3, prévalence réglable)", () =>
    expect(solvable("imbalance-trap", 3, [0.02, 0.03, 0.05])).toBe(true));
  it("recall-90 non trivial (sep 2) : pas satisfait au seuil 0.5", () => {
    const data = makeDataset(2, 0.4);
    expect(metricsAt(data, 0.5).recall).toBeLessThan(0.9);
  });
});

describe("défis non résolus au départ (réglages du MDX)", () => {
  const start = (id: string, sep: number, prev: number, t: number) => {
    const data = makeDataset(sep, prev);
    const rocAuc = auc(rocCurve(data));
    return CHALLENGES[id].check({ data, threshold: t, separation: sep, prevalence: prev, metrics: metricsAt(data, t), rocAuc });
  };
  it("recall-90", () => expect(start("recall-90", 2, 0.4, 0.5)).toBe(false));
  it("zero-fp", () => expect(start("zero-fp", 3, 0.4, 0.5)).toBe(false));
  it("best-f1", () => expect(start("best-f1", 2, 0.4, 0.85)).toBe(false));
  it("random-model", () => expect(start("random-model", 2, 0.4, 0.5)).toBe(false));
  it("imbalance-trap", () => expect(start("imbalance-trap", 3, 0.4, 0.5)).toBe(false));
  it("best-f1 faisable à sep 2", () => expect(solvable("best-f1", 2, [0.4])).toBe(true));
});
