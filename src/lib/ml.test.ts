import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { errorCurve, makeBvData } from "./sims";
import {
  accuracy, argmin, buildTree, countLeaves, cvCurve, foldAssignment, knn, KNN_KS, knnAccuracyCurve, leakageCv, mean,
  MOON_TEST, MOON_TRAIN, neighborLabels, noiseDataset, treeClassifier, TREE_MAX_DEPTH,
} from "./ml";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("validation croisée", () => {
  it("plis équilibrés", () => {
    const f = foldAssignment(40, 5);
    for (let k = 0; k < 5; k++) expect(f.filter((x) => x === k).length).toBe(8);
  });
  it("la CV retrouve le bon degré (proche de l'optimum réel)", () => {
    const { train, test } = makeBvData(40, 0.3);
    const truth = errorCurve(train, test).slice(0, 13).map((e) => e.test);
    const cv = cvCurve(train, 5);
    expect(truth[argmin(cv)]).toBeLessThan(Math.min(...truth) * 1.1);
    expect(C("cv-select", { degree: 10, k: 5, cv })).toBe(false);
    expect(C("cv-select", { degree: argmin(cv), k: 5, cv })).toBe(true);
  });
});

describe("fuite de données", () => {
  it("sélection avant la CV : précision illusoire ; dans chaque pli : hasard", () => {
    for (const seed of [2, 3, 4]) {
      const d = noiseDataset(60, 2000, seed);
      expect(mean(leakageCv(d, 20, true))).toBeGreaterThanOrEqual(0.75);
      expect(mean(leakageCv(d, 20, false))).toBeLessThanOrEqual(0.65);
    }
  });
  it("défi leak-illusion", () => {
    expect(C("leak-illusion", { leakyAcc: 0.95, cleanAcc: null })).toBe(false);
    expect(C("leak-illusion", { leakyAcc: 0.95, cleanAcc: 0.5 })).toBe(true);
  });
});

describe("k-NN", () => {
  const curve = knnAccuracyCurve(neighborLabels(MOON_TRAIN, MOON_TEST), MOON_TEST);
  const best = Math.max(...curve);
  it("k = 1 mémorise l'entraînement", () => {
    expect(accuracy(knn(MOON_TRAIN, 1), MOON_TRAIN)).toBe(1);
  });
  it("courbe cohérente avec le classifieur direct", () => {
    expect(curve[KNN_KS.indexOf(7)]).toBeCloseTo(accuracy(knn(MOON_TRAIN, 7), MOON_TEST), 6);
  });
  it("défis : départ non résolu, solutions atteignables", () => {
    expect(C("knn-best", { k: 1, scaled: false, testAcc: curve[0], bestAcc: best })).toBe(false);
    expect(C("knn-best", { k: 1, scaled: false, testAcc: best, bestAcc: best })).toBe(true);
    const scaled = knnAccuracyCurve(neighborLabels(MOON_TRAIN, MOON_TEST, 20), MOON_TEST);
    expect(C("knn-scale", { k: 15, scaled: false, testAcc: curve[7], bestAcc: best })).toBe(false);
    expect(KNN_KS.some((k, i) => C("knn-scale", { k, scaled: true, testAcc: scaled[i], bestAcc: best }))).toBe(true);
  });
  it("k très grand sous-apprend nettement", () => {
    expect(curve[KNN_KS.length - 1]).toBeLessThan(best - 0.1);
  });
});

describe("arbres", () => {
  const trees = Array.from({ length: TREE_MAX_DEPTH }, (_, d) => buildTree(MOON_TRAIN, d + 1));
  const test = trees.map((t) => accuracy(treeClassifier(t), MOON_TEST));
  const train = trees.map((t) => accuracy(treeClassifier(t), MOON_TRAIN));
  it("plus profond = plus de feuilles et meilleure précision d'entraînement", () => {
    expect(countLeaves(trees[0])).toBe(2);
    expect(train[11]).toBe(1);
    expect(train[0]).toBeLessThan(train[5]);
  });
  it("défis : départs non résolus, solutions atteignables", () => {
    const best = Math.max(...test);
    expect(C("tree-memorize", { depth: 1, trainAcc: train[0], testAcc: test[0], bestAcc: best })).toBe(false);
    expect(C("tree-best", { depth: 10, trainAcc: train[9], testAcc: test[9], bestAcc: best })).toBe(false);
    expect(test.some((t, i) => C("tree-best", { depth: i + 1, trainAcc: train[i], testAcc: t, bestAcc: best }))).toBe(true);
  });
});
