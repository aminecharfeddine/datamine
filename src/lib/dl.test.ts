import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { analogy, EMB_GROUPS, conv, KERNELS, kernelResponses, lstmGradient, maxPool, neighbors, groupOf, rnnGradient, trainEmbeddings, trainRegularized, transferRun, vBar } from "./dl";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("régularisation", () => {
  it("sans régularisation la validation s'envole ; early stopping et weight decay passent le défi", () => {
    const none = trainRegularized({ dropout: 0, wd: 0 });
    expect(none.trainLoss.at(-1)!).toBeLessThan(0.05);
    expect(none.valLoss.at(-1)!).toBeGreaterThan(1);
    expect(C("reg-val", { valLoss: none.valLoss.at(-1)! })).toBe(false);
    expect(C("reg-val", { valLoss: none.valLoss[none.best] })).toBe(true); // early stopping
    const wd = trainRegularized({ dropout: 0, wd: 0.01 });
    expect(C("reg-val", { valLoss: wd.valLoss.at(-1)! })).toBe(true);
  }, 20000);
});

describe("convolutions", () => {
  it("le filtre vertical voit la barre verticale ; le pooling divise la taille", () => {
    const r = kernelResponses(KERNELS.verticaux);
    expect(r.vertical).toBeGreaterThan(r.horizontal * 3);
    expect(maxPool(conv(vBar(), KERNELS.identite)).length).toBe(10);
  });
  it("défi : un filtre « ligne diagonale » réussit, Sobel diagonal non", () => {
    const line = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];
    expect(C("cnn-diag", { custom: true, ...kernelResponses(line) })).toBe(true);
    expect(C("cnn-diag", { custom: true, ...kernelResponses([[0, 1, 2], [-1, 0, 1], [-2, -1, 0]]) })).toBe(false);
    expect(C("cnn-diag", { custom: false, ...kernelResponses(line) })).toBe(false);
  });
});

describe("transfer learning", () => {
  it("avec 8 exemples, le pré-entraînement fait la différence", () => {
    const scratch = transferRun("scratch", 8).acc;
    const ft = transferRun("finetune", 8).acc;
    expect(ft).toBeGreaterThan(scratch + 0.1);
    expect(C("transfer-8", { mode: "finetune", n: 8, acc: ft })).toBe(true);
    expect(C("transfer-8", { mode: "scratch", n: 8, acc: scratch })).toBe(false);
  });
});

describe("embeddings", () => {
  const E = trainEmbeddings();
  it("les plus proches voisins sont de la même catégorie", () => {
    for (const w of ["chat", "pomme", "paris", "france"]) neighbors(E, E[w], [w]).forEach((n) => expect(groupOf(n.w), `${w} → ${n.w}`).toBe(groupOf(w)));
  });
  it("certaines analogies capitale/pays fonctionnent", () => {
    let ok = 0;
    EMB_GROUPS.capitales.forEach((cap, i) =>
      EMB_GROUPS.pays.forEach((pc, j) => {
        if (i === j) return;
        if (analogy(E, cap, EMB_GROUPS.pays[i], pc)[0].w === EMB_GROUPS.capitales[j]) ok++;
      }),
    );
    expect(ok).toBeGreaterThanOrEqual(5);
  });
});

describe("RNN", () => {
  it("le gradient du RNN s'évanouit ou explose ; le LSTM peut le préserver", () => {
    expect(rnnGradient(1, 100)).toBeLessThan(1e-6);
    expect(rnnGradient(1.5, 100)).toBeGreaterThan(1e6);
    expect(C("rnn-memory", { model: "lstm", T: 100, grad: lstmGradient(0.98, 100) })).toBe(true);
    expect(C("rnn-memory", { model: "rnn", T: 100, grad: rnnGradient(1, 100) })).toBe(false);
  });
});
