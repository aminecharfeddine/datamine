import { describe, expect, it } from "vitest";
import { auc, confusion, makeDataset, metricsFrom, rocCurve } from "./metrics";

describe("metrics", () => {
  it("calcule precision, recall et F1 sur un cas connu", () => {
    const m = metricsFrom({ tp: 8, fp: 2, fn: 4, tn: 86 });
    expect(m.precision).toBeCloseTo(0.8);
    expect(m.recall).toBeCloseTo(8 / 12);
    expect(m.f1).toBeCloseTo((2 * 0.8 * (8 / 12)) / (0.8 + 8 / 12));
    expect(m.accuracy).toBeCloseTo(0.94);
  });

  it("seuil 0 => tout est positif, recall = 1", () => {
    const data = makeDataset(2, 0.3);
    const c = confusion(data, 0);
    expect(c.fn).toBe(0);
    expect(c.tn).toBe(0);
  });

  it("respecte la prévalence demandée", () => {
    const data = makeDataset(2, 0.1, 500);
    expect(data.filter((d) => d.label === 1).length).toBe(50);
  });

  it("AUC ≈ 0.5 sans séparation et élevée avec séparation forte", () => {
    expect(auc(rocCurve(makeDataset(0, 0.5)))).toBeGreaterThan(0.4);
    expect(auc(rocCurve(makeDataset(0, 0.5)))).toBeLessThan(0.6);
    expect(auc(rocCurve(makeDataset(4, 0.5)))).toBeGreaterThan(0.95);
  });

  it("AUC d'un classifieur parfait = 1", () => {
    const pts = rocCurve([
      { score: 0.9, label: 1 },
      { score: 0.8, label: 1 },
      { score: 0.2, label: 0 },
    ]);
    expect(auc(pts)).toBeCloseTo(1);
  });
});
