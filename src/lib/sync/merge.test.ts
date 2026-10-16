import { describe, expect, it } from "vitest";
import { mergeProgress, sameData } from "./merge";
import { EMPTY_DATA, type ProgressData, type StoredCard } from "@/lib/store";

const card = (reps: number, last?: string): StoredCard => ({
  due: "2026-10-20T00:00:00.000Z", stability: reps * 3, difficulty: 5, elapsed_days: 0,
  scheduled_days: 1, learning_steps: 0, reps, lapses: 0, state: 2, last_review: last,
});

const guest: ProgressData = {
  ...EMPTY_DATA,
  xp: 120,
  dailyXp: { "2026-10-16": 120 },
  awarded: { "a:1": true },
  completedLessons: { bayes: "2026-10-16T10:00:00Z" },
  challengesDone: 1,
  streak: { current: 1, best: 1, lastDay: "2026-10-16", freezes: 1 },
  srs: { c1: card(0), c2: card(2, "2026-10-16") },
};
const account: ProgressData = {
  ...EMPTY_DATA,
  xp: 300,
  dailyXp: { "2026-10-14": 200, "2026-10-15": 100 },
  awarded: { "b:1": true },
  completedLessons: { bayes: "2026-10-15T10:00:00Z", "roc-et-pr": "2026-10-14T10:00:00Z" },
  challengesDone: 3,
  streak: { current: 2, best: 4, lastDay: "2026-10-15", freezes: 0 },
  srs: { c1: card(3, "2026-10-15"), c2: card(1, "2026-10-14") },
  badges: { "first-lesson": "2026-10-14T10:00:00Z" },
};

describe("mergeProgress", () => {
  const m = mergeProgress(guest, account);

  it("unit les acquis des deux côtés", () => {
    expect(Object.keys(m.awarded).sort()).toEqual(["a:1", "b:1"]);
    expect(Object.keys(m.completedLessons).sort()).toEqual(["bayes", "roc-et-pr"]);
    expect(m.completedLessons.bayes).toBe("2026-10-15T10:00:00Z");
    expect(m.badges["first-lesson"]).toBeDefined();
  });
  it("additionne l'XP de jours différents", () => {
    expect(m.xp).toBe(420);
    expect(m.challengesDone).toBe(3);
  });
  it("garde la carte la plus révisée", () => {
    expect(m.srs.c1.reps).toBe(3);
    expect(m.srs.c2.reps).toBe(2);
  });
  it("série : la plus récente, meilleure série conservée", () => {
    expect(m.streak.lastDay).toBe("2026-10-16");
    expect(m.streak.best).toBe(4);
  });
  it("commutative et idempotente", () => {
    expect(sameData(m, mergeProgress(account, guest))).toBe(true);
    expect(sameData(mergeProgress(m, m), m)).toBe(true);
    expect(sameData(mergeProgress(m, account), m)).toBe(true);
  });
  it("tolère un état distant vide ou partiel", () => {
    expect(sameData(mergeProgress(guest, null), mergeProgress(guest, {}))).toBe(true);
    expect(mergeProgress(null, { xp: 5 }).xp).toBe(5);
  });
});

describe("réponses, historique et remise en révision", () => {
  const base = { ...EMPTY_DATA };
  it("réponses : union, meilleure valeur gardée", () => {
    const m = mergeProgress({ ...base, answers: { a: 1, q: 2 } }, { ...base, answers: { q: 3, b: 0 } });
    expect(m.answers).toEqual({ a: 1, q: 3, b: 0 });
  });
  it("historique : union sans doublons, ordre chronologique", () => {
    const e1 = { c: "x", g: 3, t: "2026-10-01T10:00:00Z" };
    const e2 = { c: "y", g: 1, t: "2026-10-02T10:00:00Z" };
    const e3 = { c: "x", g: 4, t: "2026-10-03T10:00:00Z" };
    const m = mergeProgress({ ...base, reviewLog: [e1, e3] }, { ...base, reviewLog: [e1, e2] });
    expect(m.reviewLog).toEqual([e1, e2, e3]);
    expect(sameData(m, mergeProgress({ ...base, reviewLog: [e1, e2] }, { ...base, reviewLog: [e3, e1] }))).toBe(true);
  });
  it("une remise en révision (plus récente) l'emporte sur l'état d'un autre appareil", () => {
    const old = { ...card(2, "2026-10-10"), due: "2026-10-20T00:00:00.000Z", u: "2026-10-10T00:00:00.000Z" };
    const requeued = { ...old, due: "2026-10-16T12:00:00.000Z", u: "2026-10-16T12:00:00.000Z" };
    const m1 = mergeProgress({ ...base, srs: { c: requeued } }, { ...base, srs: { c: old } });
    const m2 = mergeProgress({ ...base, srs: { c: old } }, { ...base, srs: { c: requeued } });
    expect(m1.srs.c.due).toBe(requeued.due);
    expect(m2.srs.c.due).toBe(requeued.due);
  });
});
