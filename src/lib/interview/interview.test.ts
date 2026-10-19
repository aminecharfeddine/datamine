import { describe, expect, it } from "vitest";
import { ALL_LESSONS } from "../curriculum";
import {
  checkCalc, filterQuestions, parseNumber, pickSimulation, QUESTIONS, sessionReport, SIMULATION_SIZE, statusOf, TOPICS, topicProgress,
} from "./index";

const slugs = new Set(ALL_LESSONS.filter((l) => l.available).map((l) => l.slug));

describe("banque de questions d'entretien", () => {
  it("assez de questions, réparties sur tous les thèmes et formats", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(120);
    for (const t of TOPICS) expect(QUESTIONS.filter((q) => q.topic === t.id).length, t.id).toBeGreaterThanOrEqual(10);
    for (const k of ["qcm", "oral", "bug", "calcul"]) expect(QUESTIONS.filter((q) => q.kind === k).length, k).toBeGreaterThanOrEqual(15);
    expect(QUESTIONS.filter((q) => q.trap).length).toBeGreaterThanOrEqual(25);
  });

  it("identifiants uniques", () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });

  it.each(QUESTIONS.map((q) => [q.id, q] as const))("%s est bien formée", (_, q) => {
    expect(JSON.stringify(q).includes("—"), "tiret cadratin").toBe(false);
    expect(q.q.length).toBeGreaterThan(20);
    if (q.lesson) expect(slugs.has(q.lesson), `leçon ${q.lesson}`).toBe(true);
    if (q.kind === "qcm") {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
    if (q.kind === "oral") {
      expect(q.points.length).toBeGreaterThanOrEqual(3);
      expect(q.answer.length).toBeGreaterThan(200);
    }
    if (q.kind === "bug") {
      const lines = q.code.split("\n");
      expect(q.line).toBeGreaterThanOrEqual(1);
      expect(q.line).toBeLessThanOrEqual(lines.length);
      expect(lines[q.line - 1].trim().length).toBeGreaterThan(0);
      expect(q.fix.length).toBeGreaterThan(10);
    }
    if (q.kind === "calcul") {
      expect(q.tolerance).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(q.answer)).toBe(true);
    }
  });
});

describe("logique de session", () => {
  it("lit les nombres à la française", () => {
    expect(parseNumber("0,727")).toBeCloseTo(0.727);
    expect(parseNumber("14 400")).toBe(14400);
    expect(parseNumber("")).toBeNull();
    expect(checkCalc("0,73", 0.727, 0.005)).toBe(true);
    expect(checkCalc("0,8", 0.727, 0.005)).toBe(false);
  });

  it("statut d'une question", () => {
    expect(statusOf("x", {})).toBe("new");
    expect(statusOf("x", { "itv:x": 100 })).toBe("ok");
    expect(statusOf("x", { "itv:x": 40 })).toBe("retry");
  });

  it("entretien blanc : 10 questions, formats mélangés, thèmes variés, difficulté croissante", () => {
    for (const seed of [1, 2, 3, 42, 2026]) {
      const sim = pickSimulation(seed, {});
      expect(sim).toHaveLength(SIMULATION_SIZE);
      expect(new Set(sim.map((q) => q.id)).size).toBe(SIMULATION_SIZE);
      expect(sim.filter((q) => q.kind === "oral")).toHaveLength(2);
      expect(sim.filter((q) => q.kind === "bug")).toHaveLength(2);
      expect(sim.filter((q) => q.kind === "calcul")).toHaveLength(2);
      const perTopic = new Map<string, number>();
      sim.forEach((q) => perTopic.set(q.topic, (perTopic.get(q.topic) ?? 0) + 1));
      expect(Math.max(...perTopic.values())).toBeLessThanOrEqual(2);
      sim.forEach((q, i) => i && expect(q.level).toBeGreaterThanOrEqual(sim[i - 1].level));
    }
  });

  it("l'entretien blanc privilégie les questions à retravailler", () => {
    const retry = QUESTIONS.filter((q) => q.kind === "oral").slice(0, 2);
    const answers = Object.fromEntries(retry.map((q) => [`itv:${q.id}`, 20]));
    const sim = pickSimulation(7, answers);
    retry.forEach((q) => expect(sim.map((x) => x.id)).toContain(q.id));
  });

  it("filtres et bilan", () => {
    const traps = filterQuestions({ topics: ["stats"], kinds: [], levels: [], trapsOnly: true, scope: "all" }, {});
    expect(traps.length).toBeGreaterThan(0);
    traps.forEach((q) => expect(q.topic === "stats" && q.trap).toBe(true));
    const [a, b] = QUESTIONS;
    const r = sessionReport([{ id: a.id, score: 1 }, { id: b.id, score: 0.4 }]);
    expect(r.score).toBeCloseTo(0.7);
    expect(r.passed).toBe(1);
    expect(r.toReview.map((q) => q.id)).toEqual([b.id]);
    expect(topicProgress({ [`itv:${a.id}`]: 100 })[a.topic].ok).toBe(1);
  });
});
