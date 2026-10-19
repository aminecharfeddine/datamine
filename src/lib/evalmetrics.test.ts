import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import {
  aucOf, BEST_MAE, BEST_RMSE, CAL_ECE_TARGET, calibration, constMetrics, DELAIS, MC_BEST_MACRO, MC_WEIGHTS, mcConfusion, mcEvaluate, mean, median,
  RANK_DOCS, RANK_START, rankMetrics, regMetrics,
} from "./evalmetrics";

describe("métriques de régression", () => {
  it("valeurs de base", () => {
    const m = regMetrics([10, 20, 30], [12, 18, 33]);
    expect(m.mae).toBeCloseTo(7 / 3);
    expect(m.rmse).toBeCloseTo(Math.sqrt(17 / 3));
    expect(m.r2).toBeCloseTo(1 - 17 / 200);
  });
  it("la médiane minimise la MAE, la moyenne la RMSE, R² nul pour la moyenne", () => {
    expect(median(DELAIS)).toBe(22);
    expect(constMetrics(median(DELAIS)).mae).toBeCloseTo(BEST_MAE);
    expect(constMetrics(27.5).rmse).toBeCloseTo(BEST_RMSE);
    expect(mean(DELAIS) - median(DELAIS)).toBeGreaterThan(4);
    expect(constMetrics(mean(DELAIS)).r2).toBeCloseTo(0);
    expect(constMetrics(median(DELAIS)).r2).toBeLessThan(0);
  });
  it("défi", () => {
    expect(CHALLENGES["mean-median"].check({ maeHit: true, rmseHit: true })).toBe(true);
    expect(CHALLENGES["mean-median"].check({ maeHit: true, rmseHit: false })).toBe(false);
  });
});

describe("multiclasse", () => {
  it("micro-F1 = accuracy en mono-étiquette", () => {
    const r = mcEvaluate([[5, 1], [2, 2]]);
    expect(r.microF1).toBeCloseTo(r.accuracy);
    expect(r.accuracy).toBeCloseTo(0.7);
  });
  it("le poids de la fraude a un optimum intérieur pour le macro-F1", () => {
    const base = mcConfusion(1);
    const best = MC_WEIGHTS.map(mcConfusion).findIndex((r) => r.macroF1 === MC_BEST_MACRO);
    expect(best).toBeGreaterThan(0);
    expect(best).toBeLessThan(MC_WEIGHTS.length - 1);
    expect(base.perClass[3].recall).toBeLessThan(0.25);
    expect(MC_BEST_MACRO - base.macroF1).toBeGreaterThan(0.03);
    expect(CHALLENGES["macro-f1"].check({ macroF1: base.macroF1, best: MC_BEST_MACRO })).toBe(false);
  });
});

describe("calibration", () => {
  it("AUC indépendante de la température", () => {
    expect(calibration("boosting", 0.5).auc).toBeCloseTo(calibration("boosting", 2.5).auc, 10);
    expect(aucOf([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1])).toBeCloseTo(0.75);
  });
  it("T > 1 corrige le surconfiant, T < 1 le sous-confiant", () => {
    expect(calibration("boosting", 1).ece).toBeGreaterThan(0.08);
    expect(calibration("regularise", 1).ece).toBeGreaterThan(0.08);
    expect(calibration("boosting", 2.2).ece).toBeLessThan(CAL_ECE_TARGET);
    expect(calibration("regularise", 0.55).ece).toBeLessThan(CAL_ECE_TARGET);
    expect(calibration("boosting", 2.2).logloss).toBeLessThan(calibration("boosting", 1).logloss);
  });
});

describe("ranking", () => {
  it("NDCG idéal = 1, ordre de départ médiocre", () => {
    const ideal = [...RANK_DOCS].sort((a, b) => b.grade - a.grade).map((d) => d.id);
    expect(rankMetrics(ideal).ndcg).toBeCloseTo(1);
    expect(rankMetrics(RANK_START).ndcg).toBeLessThan(0.6);
    expect(CHALLENGES["ndcg-ideal"].check({ ndcg: rankMetrics(ideal).ndcg })).toBe(true);
  });
  it("la precision@k ignore l'ordre dans le top k", () => {
    const a = rankMetrics(["c", "e", "f", "a", "b", "d", "g", "h"]);
    const b = rankMetrics(["a", "b", "f", "e", "c", "d", "g", "h"]);
    expect(a.precision).toBe(b.precision);
    expect(a.ndcg).toBeGreaterThan(b.ndcg);
    expect(b.mrr).toBeCloseTo(1 / 3);
  });
});
