import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { BUGS, CIRCLE_TEST, CIRCLE_TRAIN, netAccuracy, trainFull, trainLoop, initNet, backward, zeroGrads, meanLoss } from "./nn";
import { attentionMatrix, BPE_CORPUS, BPE_MAX, encodeBpe, meanEntropy, preTokenize, softmax, steeredWeights, trainBpe } from "./llm";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("réseau de neurones", () => {
  it("le gradient analytique correspond au gradient numérique", () => {
    const net = initNet(4, "tanh", 2);
    const batch = CIRCLE_TRAIN.slice(0, 20);
    const g = zeroGrads(4);
    backward(net, batch, g);
    const eps = 1e-5;
    for (const i of [0, 3, 6]) {
      const w0 = net.W1[i];
      net.W1[i] = w0 + eps;
      const up = meanLoss(net, batch);
      net.W1[i] = w0 - eps;
      const down = meanLoss(net, batch);
      net.W1[i] = w0;
      expect(g.W1[i]).toBeCloseTo((up - down) / (2 * eps), 5);
    }
  });
  it("activation linéaire : le hasard, quelle que soit la taille ; 3 neurones tanh suffisent", () => {
    const lin = trainFull(CIRCLE_TRAIN, 32, "linear");
    const acc = netAccuracy(lin.net, CIRCLE_TEST);
    expect(acc).toBeLessThan(0.6);
    expect(C("nn-collapse", { H: 32, act: "linear", trained: true, testAcc: acc })).toBe(true);
    const t3 = netAccuracy(trainFull(CIRCLE_TRAIN, 3, "tanh").net, CIRCLE_TEST);
    expect(C("nn-minimal", { H: 3, act: "tanh", trained: true, testAcc: t3 })).toBe(true);
    const r1 = netAccuracy(trainFull(CIRCLE_TRAIN, 1, "relu").net, CIRCLE_TEST);
    expect(C("nn-minimal", { H: 1, act: "relu", trained: true, testAcc: r1 })).toBe(false);
  });
  it("chaque bug laisse une signature distincte sur la loss", () => {
    const runs = Object.fromEntries(BUGS.map((b) => [b.id, trainLoop(CIRCLE_TRAIN, CIRCLE_TEST, b.id)]));
    const late = (id: string) => runs[id].loss.slice(runs[id].loss.length / 2);
    expect(runs.none.loss.at(-1)!).toBeLessThan(0.15);
    expect(runs.none.valAcc.at(-1)!).toBeGreaterThan(0.97);
    expect(Math.max(...late("zero-grad"))).toBeGreaterThan(1); // pics qui reviennent
    expect(Math.max(...runs.lr.loss.slice(0, 60))).toBeGreaterThan(2); // chaos au début
    expect(Math.min(...late("scale"))).toBeGreaterThan(0.5); // plateau
    expect(runs.shuffle.loss.at(-1)!).toBeGreaterThan(runs.none.loss.at(-1)!); // plus lent, en dents de scie
  });
  it("la courbe mystère (autre graine) garde la signature des batches non mélangés", () => {
    const m = trainLoop(CIRCLE_TRAIN, CIRCLE_TEST, "shuffle", 40, 11);
    const clean = trainLoop(CIRCLE_TRAIN, CIRCLE_TEST, "none", 40, 11);
    const late = m.loss.slice(m.loss.length / 2);
    expect(Math.max(...late) - Math.min(...late)).toBeGreaterThan(0.15); // oscillations
    expect(m.loss.at(-1)!).toBeGreaterThan(clean.loss.at(-1)!);
  });
});

describe("tokenisation BPE", () => {
  const merges = trainBpe(BPE_CORPUS, BPE_MAX);
  const chars = preTokenize(BPE_CORPUS).join("").length;
  const ratio = (k: number) => chars / encodeBpe(BPE_CORPUS, merges, k).length;
  it("les fusions compressent le texte, sans rien perdre", () => {
    expect(ratio(0)).toBe(1);
    expect(ratio(100)).toBeGreaterThan(ratio(50));
    const s = "Le modèle apprend à prédire.";
    expect(encodeBpe(s, merges).join("").replaceAll("▁", " ").trim()).toBe(s);
  });
  it("défis BPE atteignables", () => {
    expect(C("bpe-compress", { merges: 150, ratio: ratio(150), words: 0, tokens: 0, allMerges: false })).toBe(true);
    expect(C("bpe-compress", { merges: 50, ratio: ratio(50), words: 0, tokens: 0, allMerges: false })).toBe(false);
    const t = encodeBpe("anticonstitutionnellement", merges).length;
    expect(C("bpe-rare", { merges: merges.length, ratio: 1, words: 1, tokens: t, allMerges: true })).toBe(true);
  });
});

describe("attention", () => {
  it("softmax", () => {
    const p = softmax([1, 2, 3]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(softmax([0, -Infinity])).toEqual([1, 0]);
  });
  it("défi attn-focus atteignable avec les curseurs", () => {
    let best = 0;
    for (let a = -180; a <= 180; a += 5) for (let n = 0.5; n <= 8; n += 0.5) best = Math.max(best, steeredWeights(a, n)[1]);
    expect(C("attn-focus", { weight: best })).toBe(true);
    expect(C("attn-focus", { weight: steeredWeights(90, 1)[1] })).toBe(false);
  });
  it("sans division par √d, le softmax sature ; le masque causal annule le futur", () => {
    expect(meanEntropy(attentionMatrix(7, 64, true, false))).toBeGreaterThan(0.6);
    expect(meanEntropy(attentionMatrix(7, 64, false, false))).toBeLessThan(0.3);
    const A = attentionMatrix(5, 16, true, true);
    expect(A[0][1]).toBe(0);
    expect(A[2][4]).toBe(0);
    expect(A[0][0]).toBeCloseTo(1, 12);
  });
});
