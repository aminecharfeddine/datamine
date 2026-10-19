import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { countParams, GPT2_SMALL, inferenceBudget, lowRank, makeDelta, PRESETS, ragEval, retrieve, samplingDist, symEig, drawSamples, expandQuery } from "./llm2";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("taille d'un Transformer", () => {
  it("retrouve les tailles publiées", () => {
    expect(countParams(GPT2_SMALL).total / 1e6).toBeCloseTo(124.44, 1);
    expect(countParams(PRESETS["Llama 2 7B"]).total / 1e9).toBeCloseTo(6.74, 2);
    expect(countParams(PRESETS["Llama 3 70B"]).total / 1e9).toBeCloseTo(70.55, 1);
    expect(C("tf-gpt2", { total: countParams(GPT2_SMALL).total, usedPreset: false })).toBe(true);
    expect(C("tf-gpt2", { total: countParams({ ...GPT2_SMALL, tied: false }).total, usedPreset: false })).toBe(false);
  });
});

describe("LoRA", () => {
  it("Jacobi diagonalise une matrice symétrique", () => {
    const { values } = symEig([[2, 1], [1, 2]]);
    expect(values[0]).toBeCloseTo(3, 9);
    expect(values[1]).toBeCloseTo(1, 9);
  });
  it("l'erreur décroît avec le rang ; rang 4 suffit à 5 %", () => {
    const lr = lowRank(makeDelta());
    expect(lr.error(0)).toBeCloseTo(1, 9);
    for (let r = 1; r < 10; r++) expect(lr.error(r)).toBeLessThanOrEqual(lr.error(r - 1) + 1e-12);
    const minR = [...Array(33).keys()].find((r) => lr.error(r) < 0.05)!;
    expect(minR).toBe(4);
    const M = makeDelta(), A = lowRank(M).approx(32);
    expect(Math.abs(A[3][7] - M[3][7])).toBeLessThan(1e-6);
    expect(C("lora-rank", { r: 4, err: lr.error(4), minR })).toBe(true);
    expect(C("lora-rank", { r: 6, err: lr.error(6), minR })).toBe(false);
  });
});

describe("sampling", () => {
  it("température, top-k, top-p", () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(samplingDist(0.7, 5, 0.9).final)).toBeCloseTo(1, 12);
    expect(samplingDist(1, 5, 1).kept).toBe(5);
    expect(samplingDist(0.2, 0, 1).raw[0]).toBeGreaterThan(0.9);
    expect(samplingDist(3, 0, 1).raw[0]).toBeLessThan(0.2);
    expect(C("samp-topp", { T: 1, topK: 0, kept: samplingDist(1, 0, 0.65).kept })).toBe(true);
    expect(C("samp-topp", { T: 1, topK: 3, kept: 3 })).toBe(false);
    const draws = drawSamples(samplingDist(1, 0, 0.65).final, 200, 3);
    expect(new Set(draws).size).toBe(3);
  });
});

describe("inférence", () => {
  it("70B sur 80 Go : int4 + GQA tient, pas int8 ni MHA", () => {
    const base = { model: "70B", ctx: 32768, batch: 1, gpu: "80 Go" } as const;
    expect(inferenceBudget({ ...base, precision: "int4", gqa: true }).fits).toBe(true);
    expect(inferenceBudget({ ...base, precision: "int8", gqa: true }).fits).toBe(false);
    expect(inferenceBudget({ ...base, precision: "int4", gqa: false }).fits).toBe(false);
    expect(inferenceBudget({ ...base, precision: "fp16", gqa: true }).weights).toBeCloseTo(141.1, 0);
  });
});

describe("RAG", () => {
  it("la réécriture aide ; le défi est atteignable ; les gros morceaux coûtent cher", () => {
    expect(ragEval("paragraphe", 1, false).recall).toBeLessThan(1);
    const best = ragEval("paragraphe", 1, true);
    expect(C("rag-recall", { recall: best.recall, avgTokens: best.avgTokens })).toBe(true);
    const page = ragEval("page", 3, true);
    expect(page.recall).toBe(1);
    expect(C("rag-recall", { recall: page.recall, avgTokens: page.avgTokens })).toBe(false);
    expect(expandQuery("Quand serai-je remboursé ?")).toContain("remboursement");
    expect(retrieve("Combien coûte la livraison express ?", "paragraphe", 1, false)[0].chunk.para).toBe(0);
  });
});
