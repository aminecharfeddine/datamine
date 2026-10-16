import { describe, expect, it } from "vitest";
import { levelInfo, touchStreak, type Streak } from "./gamification";

const base: Streak = { current: 0, best: 0, lastDay: null, freezes: 1 };

describe("streak", () => {
  it("démarre puis incrémente sur jours consécutifs", () => {
    let s = touchStreak(base, "2026-10-01");
    s = touchStreak(s, "2026-10-02");
    s = touchStreak(s, "2026-10-02");
    expect(s.current).toBe(2);
  });
  it("un gel couvre un jour manqué", () => {
    let s = touchStreak(base, "2026-10-01");
    s = touchStreak(s, "2026-10-03");
    expect(s.current).toBe(2);
    expect(s.freezes).toBe(0);
  });
  it("repart à 1 après une vraie coupure", () => {
    let s = touchStreak(base, "2026-10-01");
    s = touchStreak(s, "2026-10-05");
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });
});

describe("levels", () => {
  it("niveau 1 à 0 XP, niveau 2 à 100 XP", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
  });
});
