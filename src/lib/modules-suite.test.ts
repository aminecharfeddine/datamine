import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { backtest, bestOf, CLIENTS, CREDIT_FEATURES, HP_BEST, hpSearch, permutationImportance, shapValues, sigmoid, BASE_LOGIT } from "./practice2";
import { DIFF_STEPS, DIFF_TARGET, GT, iou, matchDetections, nms, PREDS, sample, sampleQuality } from "./dl3";
import { judgeWinRate, JUDGE_LENGTH_BIAS, JUDGE_POSITION_BIAS, TRUE_WIN_B } from "./llm3";
import { orchestrate, ORCH_MAX_SECONDS, ORCH_MAX_TOKENS } from "./agents2";

describe("séries temporelles", () => {
  it("la régression tendance + saison bat la baseline saisonnière, qui bat la dernière valeur", () => {
    const reg = backtest("regression", 28).mae;
    const sea = backtest("saisonnier", 28).mae;
    expect(reg).toBeLessThan(sea);
    expect(sea).toBeLessThan(backtest("naive", 28).mae);
    expect(CHALLENGES["forecast-beat"].check({ model: "regression", horizon: 28, mae: reg, seasonalMae: sea })).toBe(true);
    expect(CHALLENGES["forecast-beat"].check({ model: "moyenne", horizon: 28, mae: backtest("moyenne", 28).mae, seasonalMae: sea })).toBe(false);
  });
});

describe("interprétabilité", () => {
  it("les SHAP somment à l'écart entre la prédiction et la valeur de base", () => {
    for (const c of CLIENTS) {
      const s = shapValues(c);
      const sum = Object.values(s.phi).reduce((a, b) => a + b, 0);
      expect(BASE_LOGIT + sum).toBeCloseTo(s.logit, 10);
      expect(s.proba).toBeCloseTo(sigmoid(s.logit), 10);
    }
  });
  it("un seul client accepté malgré l'endettement comme pire facteur", () => {
    const hits = CLIENTS.filter((c) => {
      const s = shapValues(c);
      const worst = CREDIT_FEATURES.map((f) => f.id).reduce((a, b) => (s.phi[b] < s.phi[a] ? b : a));
      return CHALLENGES["shap-compensation"].check({ clientId: c.id, accepted: s.proba >= 0.5, worstFeature: worst });
    });
    expect(hits).toHaveLength(1);
  });
  it("chaque variable a une importance positive", () => {
    permutationImportance(false).forEach((i) => expect(i.importance, i.id).toBeGreaterThan(0.003));
  });
  it("une copie corrélée dilue l'importance du revenu", () => {
    const before = permutationImportance(false).find((i) => i.id === "revenu")!.importance;
    const after = permutationImportance(true);
    expect(after.find((i) => i.id === "revenu")!.importance).toBeLessThan(before / 2);
    expect(after.find((i) => i.id === "copie")!.importance).toBeLessThan(before / 2);
  });
});

describe("optimisation d'hyperparamètres", () => {
  it("à 9 essais, la grille échoue et la bayésienne réussit", () => {
    expect(HP_BEST - bestOf(hpSearch("grille", 9, 1)).score).toBeGreaterThan(0.005);
    for (const seed of [1, 2, 3, 4, 5]) expect(HP_BEST - bestOf(hpSearch("bayesienne", 9, seed)).score).toBeLessThan(0.005);
  });
});

describe("diffusion", () => {
  it("une seule étape s'effondre ; assez d'étapes atteignent la cible", () => {
    const one = sampleQuality(sample(1));
    expect(one.coverage).toBeLessThan(0.1);
    const min = DIFF_STEPS.find((k) => sampleQuality(sample(k)).dist < DIFF_TARGET);
    expect(min).toBeDefined();
    expect(min).toBeGreaterThan(5);
  });
});

describe("détection", () => {
  it("IoU", () => {
    expect(iou({ x1: 0, y1: 0, x2: 2, y2: 2 }, { x1: 1, y1: 0, x2: 3, y2: 2 })).toBeCloseTo(1 / 3);
  });
  it("le défi est atteignable, et un NMS trop strict ou trop laxiste échoue", () => {
    const ok = matchDetections(nms(PREDS, 0.55, 0.5));
    expect(ok).toMatchObject({ tp: 3, fp: 0, fn: 0 });
    expect(matchDetections(nms(PREDS, 0.55, 0.1)).fn).toBeGreaterThan(0);
    expect(matchDetections(nms(PREDS, 0.55, 0.9)).fp).toBeGreaterThan(0);
    expect(matchDetections(nms(PREDS, 0.4, 0.5)).fp).toBeGreaterThan(0);
    expect(GT).toHaveLength(3);
  });
});

describe("LLM juge", () => {
  it("seuls les deux ordres avec contrôle de longueur s'approchent de la vérité", () => {
    const setups = (["A-first", "B-first", "both"] as const).flatMap((order) => [false, true].map((lengthControl) => ({ order, lengthControl })));
    const ok = setups.filter((s) => CHALLENGES["judge-unbiased"].check({ estimate: judgeWinRate({ ...s, positionBias: JUDGE_POSITION_BIAS, lengthBias: JUDGE_LENGTH_BIAS }), truth: TRUE_WIN_B }));
    expect(ok).toEqual([{ order: "both", lengthControl: true }]);
  });
});

describe("orchestration", () => {
  it("seuls 6 sous-agents avec résumés tiennent les deux budgets", () => {
    const ok = [0, 2, 3, 6].flatMap((k) => [false, true].map((compact) => ({ k, compact }))).filter(({ k, compact }) => {
      const r = orchestrate({ subAgents: k, compact });
      return r.seconds <= ORCH_MAX_SECONDS && r.tokens <= ORCH_MAX_TOKENS;
    });
    expect(ok).toEqual([{ k: 6, compact: true }]);
    expect(orchestrate({ subAgents: 0, compact: false }).tokens).toBeGreaterThan(orchestrate({ subAgents: 6, compact: true }).tokens);
  });
});

import { APPARTS, pca2, prepare, projection, SCREE } from "./pca";
import { CHALLENGES as CH } from "./challenges";

describe("ACP", () => {
  it("sans standardisation, la surface écrase tout ; standardisé, l'axe est à 45°", () => {
    const raw = pca2(prepare(APPARTS, false));
    expect(raw.l1 / raw.total).toBeGreaterThan(0.99);
    expect(Math.min(raw.angle, 180 - raw.angle)).toBeLessThan(5);
    const std = pca2(prepare(APPARTS, true));
    expect(std.total).toBeCloseTo(2, 6);
    expect(std.angle).toBeCloseTo(45, 0);
  });
  it("le premier axe maximise la variance projetée, et le défi est atteignable au degré près", () => {
    const pts = prepare(APPARTS, true);
    const { l1, total, angle } = pca2(pts);
    for (const d of [0, 30, 60, 90, 120, 150]) expect(projection(pts, d).variance).toBeLessThanOrEqual(l1 + 1e-9);
    const share = projection(pts, Math.round(angle)).share;
    expect(CH["pca-axis"].check({ standardized: true, share, best: l1 / total })).toBe(true);
    expect(CH["pca-axis"].check({ standardized: true, share: projection(pts, 120).share, best: l1 / total })).toBe(false);
  });
  it("éboulis : 8 valeurs propres décroissantes de somme 8", () => {
    expect(SCREE).toHaveLength(8);
    expect(SCREE.reduce((a, b) => a + b, 0)).toBeCloseTo(8, 6);
    SCREE.forEach((l, i) => i && expect(l).toBeLessThanOrEqual(SCREE[i - 1]));
  });
});

import { avgLogLik, BEST_POISSON_LL, CALLS, sampleMean, simpson, pearson, spearman } from "./stats2";
import { clusterQuality, dbscan, fitLine, kmeans, LOSS_POINTS, MOONS, OUTLIERS, trainSvm, SVM_TRAIN, lossValue } from "./ml2";

describe("modules 1 à 3 (suite)", () => {
  it("vraisemblance : la Poisson au paramètre λ = moyenne bat la meilleure normale", () => {
    const lam = Math.round(sampleMean(CALLS) * 10) / 10;
    expect(avgLogLik({ law: "poisson", lambda: lam })).toBeGreaterThan(BEST_POISSON_LL - 0.003);
    let bestNormal = -Infinity;
    for (let mu = 2; mu <= 5; mu += 0.1) for (let s = 1; s <= 3; s += 0.05) bestNormal = Math.max(bestNormal, avgLogLik({ law: "normale", mu, sigma: s }));
    expect(bestNormal).toBeLessThan(BEST_POISSON_LL - 0.003);
  });
  it("Simpson : répartition équilibrée sans inversion, A aux graves avec inversion", () => {
    expect(simpson(0.5, 0.5).reversed).toBe(false);
    expect(simpson(0.8, 0.2).reversed).toBe(true);
    expect(simpson(0.8, 0.2).adjA).toBeGreaterThan(simpson(0.8, 0.2).adjB);
  });
  it("corrélations : Spearman capte une relation monotone non linéaire", () => {
    const x = Array.from({ length: 50 }, (_, i) => i);
    const y = x.map((v) => Math.exp(v / 6));
    expect(spearman(x, y)).toBeCloseTo(1, 10);
    expect(pearson(x, y)).toBeLessThan(0.8);
  });
  it("pertes : la MAE résiste aux aberrants, pas la MSE", () => {
    const clean = fitLine(LOSS_POINTS, "mse").slope;
    const all = [...LOSS_POINTS, ...OUTLIERS];
    expect(Math.abs(fitLine(all, "mse").slope - clean)).toBeGreaterThan(0.2);
    expect(Math.abs(fitLine(all, "mae").slope - clean)).toBeLessThan(0.05);
    expect(lossValue("huber", 3)).toBeCloseTo(2.5);
  });
  it("SVM : linéaire échoue, RBF réussit avec peu de vecteurs de support, γ trop grand sur-apprend", () => {
    expect(trainSvm(SVM_TRAIN, "lineaire", 1, 1).testAcc).toBeLessThan(0.8);
    const good = trainSvm(SVM_TRAIN, "rbf", 10, 1);
    expect(good.testAcc).toBeGreaterThanOrEqual(0.98);
    expect(good.supportVectors.length).toBeLessThanOrEqual(20);
    const over = trainSvm(SVM_TRAIN, "rbf", 10, 100);
    expect(over.testAcc).toBeLessThan(good.testAcc);
    expect(over.supportVectors.length).toBeGreaterThan(60);
  });
  it("clustering : k-means échoue sur les lunes, DBSCAN réussit et isole le bruit", () => {
    expect(clusterQuality(kmeans(MOONS, 2)).ari).toBeLessThan(0.5);
    const q = clusterQuality(dbscan(MOONS, 0.2, 5));
    expect(q.ari).toBeGreaterThanOrEqual(0.95);
    expect(q.noiseFound).toBeGreaterThanOrEqual(0.8);
    expect(q.noiseCount).toBeGreaterThan(3);
  });
});

describe("maths : variance et matrices", () => {
  it("diversification : à ρ = 0,2 le mélange optimal est w = 0,75 et bat les deux actifs", async () => {
    const { mix, minSdOnGrid, W_GRID, ASSET_A, ASSET_B, averagedSd } = await import("./maths2");
    const best = W_GRID.reduce((b, w) => (mix(w, 0.2).sd < mix(b, 0.2).sd ? w : b), 0);
    expect(best).toBeCloseTo(0.75, 9);
    expect(minSdOnGrid(0.2)).toBeLessThan(Math.min(ASSET_A.sd, ASSET_B.sd));
    expect(CHALLENGES["diversify"].check({ rho: 0.2, sd: mix(0.75, 0.2).sd, minSd: minSdOnGrid(0.2) })).toBe(true);
    expect(averagedSd(10, 1, 0.5) ** 2).toBeCloseTo(0.55, 9);
  });
  it("valeurs propres : symétrique (2,1,1,2) → 3 et 1 ; rotation → pas de valeur propre réelle", async () => {
    const { eigen, det } = await import("./maths2");
    const e = eigen([2, 1, 1, 2]);
    expect(e.real).toBe(true);
    expect(e.values[0]).toBeCloseTo(3, 9);
    expect(e.values[1]).toBeCloseTo(1, 9);
    expect(eigen([0, -1, 1, 0]).real).toBe(false);
    expect(det([1, 2, 0.5, 1])).toBe(0);
  });
});

describe("évaluation : comparaison, lift, équité", () => {
  it("le test apparié devient significatif à n = 800, le non apparié non", async () => {
    const { compareModels, TEST_SIZES } = await import("./eval2");
    const ok = TEST_SIZES.filter((n, i) => {
      const r = compareModels(n);
      const prev = i > 0 ? compareModels(TEST_SIZES[i - 1]).paired.p : 1;
      return CHALLENGES["paired-test"].check({ n, pairedP: r.paired.p, unpairedP: r.unpaired.p, smallerPairedP: prev });
    });
    expect(ok).toEqual([800]);
  });
  it("le profit maximal est atteint en ciblant 20 % des clients", async () => {
    const { targeting, TARGET_SHARES, BEST_PROFIT } = await import("./eval2");
    const best = TARGET_SHARES.filter((s) => targeting(s).profit === BEST_PROFIT);
    expect(best.map((s) => Math.round(s * 100))).toEqual([20]);
    expect(targeting(1).lift).toBeCloseTo(1, 9);
  });
  it("aucun seuil commun ne satisfait l'égalité des chances, des seuils par groupe oui", async () => {
    const { fairness } = await import("./eval2");
    const st = (tA: number, tB: number) => {
      const f = fairness(tA, tB);
      return { tprGap: f.tprGap, minTpr: Math.min(f.a.tpr, f.b.tpr), precision: f.precision };
    };
    for (let t = 0.05; t <= 0.95; t += 0.01) expect(CHALLENGES["equal-opportunity"].check(st(t, t))).toBe(false);
    expect(CHALLENGES["equal-opportunity"].check(st(0.46, 0.31))).toBe(true);
  });
});

describe("recommandation, anomalies, déséquilibre, prompting, alignement", () => {
  it("la factorisation bat les voisins, qui battent la popularité ; l'optimum unique est k = 2, λ = 1", async () => {
    const { recoScores, bestMf, MF_K, MF_LAMBDA } = await import("./models3");
    const best = bestMf();
    expect(best).toMatchObject({ k: 2, lambda: 1 });
    expect(best.valid).toBeLessThan(recoScores("knn").valid);
    expect(recoScores("knn").valid).toBeLessThan(recoScores("pop").valid);
    // surapprentissage : beaucoup de facteurs sans régularisation
    const over = recoScores("mf", 8, 0.01);
    expect(over.train).toBeLessThan(0.1);
    expect(over.valid).toBeGreaterThan(1);
    const ok = MF_K.flatMap((k) => MF_LAMBDA.filter((l) => CHALLENGES["reco-factors"].check({ method: "mf", valid: recoScores("mf", k, l).valid, best: best.valid })));
    expect(ok).toHaveLength(1);
  });
  it("seul le LOF atteint 90 % de recall avec 75 % de precision", async () => {
    const { detect, CONTAMINATIONS } = await import("./models3");
    const solves = (["zscore", "knn", "iforest", "lof"] as const).filter((m) => CONTAMINATIONS.some((c) => CHALLENGES["anomaly-catch"].check(detect(m, c))));
    expect(solves).toEqual(["lof"]);
  }, 20000);
  it("seul le modèle non rééquilibré, avec un seuil abaissé, est à la fois performant et calibré", async () => {
    const { imbalance, IMB_THRESHOLDS, averagePrecision } = await import("./models3");
    const solves = (["none", "weights", "under", "smote"] as const).filter((s) => IMB_THRESHOLDS.some((t) => CHALLENGES["imbalance-threshold"].check(imbalance(s, t))));
    expect(solves).toEqual(["none"]);
    expect(CHALLENGES["imbalance-threshold"].check(imbalance("none", 0.5))).toBe(false);
    expect(imbalance("weights", 0.5).meanProba).toBeGreaterThan(0.05);
    expect(averagePrecision("under")).toBeLessThan(averagePrecision("none") - 0.1);
  });
  it("un seul prompt atteint 90 % de réponses exploitables sous 800 tokens", async () => {
    const { promptEval } = await import("./models3");
    const ok: string[] = [];
    for (const instructions of ["vague", "precise"] as const)
      for (const examples of ["0", "3-biased", "3", "8"] as const)
        for (const format of ["free", "json"] as const)
          for (const reasoning of [false, true]) {
            const r = promptEval({ instructions, examples, format, reasoning });
            expect(r.predicted.reduce((a, p) => a + p.n, 0)).toBe(60);
            if (CHALLENGES["prompt-budget"].check(r)) ok.push(`${instructions}/${examples}/${format}/${reasoning}`);
          }
    expect(ok).toEqual(["precise/3/json/false"]);
    const biased = promptEval({ instructions: "precise", examples: "3-biased", format: "json", reasoning: false }).predicted;
    expect(biased.find((p) => p.cat === "Technique")!.n).toBeGreaterThan(20);
  });
  it("la qualité réelle passe par un maximum ; le grand reward model va plus loin", async () => {
    const { alignment, KL_STEPS, BEST_GOLD } = await import("./models3");
    const argmax = (rm: "small" | "large") => KL_STEPS.reduce((b, k) => (alignment(k, rm).gold > alignment(b, rm).gold ? k : b), 0);
    expect(argmax("small")).toBe(16);
    expect(argmax("large")).toBe(64);
    expect(alignment(100, "small").proxy).toBeGreaterThan(alignment(16, "small").proxy);
    const ok = (["small", "large"] as const).flatMap((rm) => KL_STEPS.filter((k) => CHALLENGES["align-sweetspot"].check({ gold: alignment(k, rm).gold, best: BEST_GOLD })).map((k) => `${rm}:${k}`));
    expect(ok).toEqual(["large:64"]);
  });
});
