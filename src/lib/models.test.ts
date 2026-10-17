import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { MOON_TEST, MOON_TRAIN } from "./ml";
import {
  accuracy1, assignAll, BLOBS, BOOST_LRS, boostCurve, boostScores, buildForest, elbowCurve, fitPolyLogistic, fitStudy, forestCurve,
  forestVotes, initCentroids, lloyd, logit1, logLoss, monomials, polyLogitProba, recenter, inertia, sigmoid, solve, STUDY, trainBoosting,
} from "./models";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("outils", () => {
  it("solve résout un système linéaire", () => {
    const x = solve([[2, 1], [1, 3]], [3, 5]);
    expect(x[0]).toBeCloseTo(0.8, 9);
    expect(x[1]).toBeCloseTo(1.4, 9);
  });
  it("sigmoïde", () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(2) + sigmoid(-2)).toBeCloseTo(1, 12);
  });
  it("monômes", () => expect(monomials(2)).toEqual([[1, 0], [0, 1], [2, 0], [1, 1], [0, 2]]));
});

describe("régression logistique", () => {
  const fit = fitStudy(STUDY);
  const best = logLoss(logit1(fit.w, fit.x0), STUDY);
  it("le maximum de vraisemblance minimise bien la log-loss", () => {
    for (const [dw, dx] of [[0.1, 0], [-0.1, 0], [0, 0.3], [0, -0.3]]) expect(logLoss(logit1(fit.w + dw, fit.x0 + dx), STUDY)).toBeGreaterThan(best);
    expect(fit.x0).toBeGreaterThan(3);
    expect(fit.x0).toBeLessThan(7);
    expect(accuracy1(logit1(fit.w, fit.x0), STUDY)).toBeGreaterThan(0.8);
  });
  it("défi logit-fit atteignable avec les pas des curseurs", () => {
    const w = Math.round(fit.w / 0.05) * 0.05, x0 = Math.round(fit.x0 * 10) / 10;
    expect(C("logit-fit", { w, x0, loss: logLoss(logit1(w, x0), STUDY), bestLoss: best })).toBe(true);
    expect(C("logit-fit", { w: 0.5, x0: 5, loss: logLoss(logit1(0.5, 5), STUDY), bestLoss: best })).toBe(false);
  });
  it("variables polynomiales : la frontière se courbe et le défi est atteignable", () => {
    const acc = (d: number) => {
      const f = polyLogitProba(fitPolyLogistic(MOON_TRAIN, d));
      return MOON_TEST.filter((p) => (f(p.x, p.y) >= 0.5 ? 1 : 0) === p.c).length / MOON_TEST.length;
    };
    const lin = acc(1);
    expect(C("logit-poly", { degree: 1, testAcc: lin, linearAcc: lin })).toBe(false);
    expect(C("logit-poly", { degree: 3, testAcc: acc(3), linearAcc: lin })).toBe(true);
  });
});

describe("forêt aléatoire", () => {
  const forest = buildForest();
  const test = forestCurve(forestVotes(forest, MOON_TEST), MOON_TEST);
  const train = forestCurve(forestVotes(forest, MOON_TRAIN), MOON_TRAIN);
  it("beaucoup d'arbres profonds battent un arbre profond", () => {
    expect(test[99]).toBeGreaterThan(test[0] + 0.04);
    expect(train[99]).toBeGreaterThan(0.99);
  });
  it("défi forest-gain", () => {
    expect(C("forest-gain", { trees: 1, testAcc: test[0], singleAcc: test[0] })).toBe(false);
    expect(test.some((t, i) => C("forest-gain", { trees: i + 1, testAcc: t, singleAcc: test[0] }))).toBe(true);
  });
});

describe("gradient boosting", () => {
  const curves = BOOST_LRS.map((lr) => {
    const b = trainBoosting(MOON_TRAIN, lr);
    return { lr, test: boostCurve(boostScores(b, MOON_TEST), MOON_TEST), train: boostCurve(boostScores(b, MOON_TRAIN), MOON_TRAIN) };
  });
  const best = Math.max(...curves.flatMap((c) => c.test));
  it("le boosting finit par apprendre le bruit", () => {
    const fast = curves.find((c) => c.lr === 1)!;
    expect(fast.train.at(-1)).toBe(1);
    expect(fast.test.at(-1)!).toBeLessThan(best - 0.03);
  });
  it("défi boost-best", () => {
    const fast = curves.find((c) => c.lr === 1)!;
    expect(C("boost-best", { lr: 1, rounds: 300, trainAcc: 1, testAcc: fast.test[299], bestAcc: best })).toBe(false);
    expect(curves.some((c) => c.test.some((t) => C("boost-best", { lr: c.lr, rounds: 1, trainAcc: 0, testAcc: t, bestAcc: best })))).toBe(true);
  });
});

describe("k-means", () => {
  const elbow = elbowCurve();
  it("l'inertie décroît avec k et le coude est à 4", () => {
    elbow.slice(1).forEach((v, i) => expect(v).toBeLessThanOrEqual(elbow[i] + 1e-9));
    const drops = elbow.slice(1).map((v, i) => elbow[i] - v);
    expect(drops[2]).toBeGreaterThan(3 * drops[3]); // gros gain de 3 à 4, petit de 4 à 5
  });
  it("une itération de Lloyd ne fait jamais monter l'inertie", () => {
    let cs = initCentroids(BLOBS, 4, 3, "random");
    let labels = assignAll(BLOBS, cs);
    let prev = inertia(BLOBS, labels, cs);
    for (let i = 0; i < 10; i++) {
      cs = recenter(BLOBS, labels, cs);
      labels = assignAll(BLOBS, cs);
      const now = inertia(BLOBS, labels, cs);
      expect(now).toBeLessThanOrEqual(prev + 1e-9);
      prev = now;
    }
  });
  it("défis : un mauvais minimum local existe en aléatoire, k-means++ trouve l'optimum", () => {
    const best = elbow[3];
    const runs = Array.from({ length: 30 }, (_, s) => lloyd(BLOBS, initCentroids(BLOBS, 4, s + 1, "random")).inertia);
    expect(runs.some((v) => C("kmeans-local", { k: 4, mode: "random", converged: true, inertia: v, best }))).toBe(true);
    const pp = Array.from({ length: 30 }, (_, s) => lloyd(BLOBS, initCentroids(BLOBS, 4, s + 1, "pp")).inertia);
    expect(pp.filter((v) => C("kmeans-elbow", { k: 4, mode: "pp", converged: true, inertia: v, best })).length).toBeGreaterThan(20);
    expect(C("kmeans-elbow", { k: 5, mode: "pp", converged: true, inertia: elbow[4], best })).toBe(false);
  });
});

describe("réglages initiaux des labos k-means", () => {
  const best = elbowCurve()[3];
  it("le labo pas à pas ne démarre pas déjà sur le mauvais minimum ; le labo du coude converge vers l'optimum avec k-means++", () => {
    expect(lloyd(BLOBS, initCentroids(BLOBS, 4, 2, "random")).inertia).toBeLessThan(best * 1.25);
    expect(lloyd(BLOBS, initCentroids(BLOBS, 4, 1, "pp")).inertia).toBeLessThanOrEqual(best * 1.01);
  });
});
