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
