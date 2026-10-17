import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ACHIEVEMENTS, AVAILABLE_LESSONS, computeStats, newlyEarned, TOTAL_LABS, weekOf, withEarnedBadges, type AchievementSource } from "./achievements";
import { COSMETICS, isUnlocked, nextLevelUnlock, rankTitle, resolveSlot, unlockedBetweenLevels, unlockedByBadge } from "./cosmetics";
import { EMPTY_DATA } from "./store";
import { mergeProgress } from "./sync/merge";
import { CARDS } from "./cards";

const base = (): AchievementSource => ({ ...EMPTY_DATA, explored: {} });

describe("catalogue", () => {
  it("identifiants uniques et récompenses valides", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cids = COSMETICS.map((c) => c.id);
    expect(new Set(cids).size).toBe(cids.length);
    for (const c of COSMETICS) if ("badge" in c.unlock) expect(ids, c.id).toContain(c.unlock.badge);
  });
  it("au moins 35 succès, cinq familles, et des paliers", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(35);
    expect(new Set(ACHIEVEMENTS.map((a) => a.family)).size).toBe(5);
    expect(ACHIEVEMENTS.filter((a) => a.tier === "or").length).toBeGreaterThanOrEqual(5);
  });
  it("chaque niveau de 2 à 16 débloque au moins un cosmétique", () => {
    for (let l = 2; l <= 16; l++) expect(unlockedBetweenLevels(l - 1, l).length, `niveau ${l}`).toBeGreaterThan(0);
    expect(unlockedBetweenLevels(1, 16).length).toBeGreaterThan(20);
  });
  it("TOTAL_LABS correspond aux labos des leçons publiées", () => {
    const dir = path.resolve(__dirname, "../content/lessons");
    let n = 0;
    for (const l of AVAILABLE_LESSONS) n += (fs.readFileSync(path.join(dir, `${l.slug}.mdx`), "utf8").match(/<[A-Z]\w*Lab\b/g) ?? []).length;
    expect(TOTAL_LABS).toBe(n);
  });
  it("les thèmes ont un contraste suffisant avec le texte blanc", () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    for (const t of COSMETICS.filter((c) => c.slot === "theme")) expect(1.05 / (lum(t.colors![0]) + 0.05), t.id).toBeGreaterThanOrEqual(4.5);
  });
});

describe("statistiques et succès", () => {
  it("rien n'est mérité au départ", () => {
    expect(newlyEarned(base())).toEqual([]);
  });
  it("semaines réussies : 4 jours actifs dans la même semaine (lundi-dimanche)", () => {
    expect(weekOf("2026-10-18")).toBe("2026-10-12"); // dimanche → lundi précédent
    expect(weekOf("2026-10-12")).toBe("2026-10-12");
    const d = { ...base(), dailyXp: { "2026-10-12": 5, "2026-10-13": 5, "2026-10-15": 5, "2026-10-18": 5, "2026-10-19": 5 } };
    expect(computeStats(d).weeksComplete).toBe(1);
    expect(newlyEarned(d).map((a) => a.id)).toContain("week-1");
  });
  it("Rebond : retour après au moins 8 jours", () => {
    expect(computeStats({ ...base(), dailyXp: { "2026-10-01": 5, "2026-10-05": 5 } }).comeback).toBe(0);
    expect(computeStats({ ...base(), dailyXp: { "2026-10-01": 5, "2026-10-09": 5 } }).comeback).toBe(1);
  });
  it("Sans filet : un défi réussi après l'indice ne compte pas", () => {
    const awarded: Record<string, true> = {};
    for (let i = 0; i < 5; i++) awarded[`l:challenge:lab:c${i}`] = true;
    expect(computeStats({ ...base(), awarded }).challengesNoHint).toBe(5);
    expect(computeStats({ ...base(), awarded, explored: { "hint:l:challenge:lab:c0": true } }).challengesNoHint).toBe(4);
  });
  it("maîtrise : concept maîtrisé puis consolidé selon la stabilité des cartes", () => {
    const card = (stability: number) => ({ reps: 3, stability, due: "", difficulty: 5, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, lapses: 0, state: 2 });
    const ids = CARDS.filter((c) => c.concept === "proba").map((c) => c.id);
    const mk = (s: number) => ({ ...base(), srs: Object.fromEntries(ids.map((id) => [id, card(s)])) });
    expect(computeStats(mk(2)).mastered).toBe(0);
    expect(computeStats(mk(8)).mastered).toBe(1);
    expect(computeStats(mk(30)).consolidated).toBe(1);
    expect(newlyEarned(mk(30)).map((a) => a.id)).toEqual(expect.arrayContaining(["mastered-1", "consolidated-1"]));
  });
  it("curiosité : labos, fiches, secrets", () => {
    const explored: Record<string, true> = { "time:night": true, revisit: true };
    for (let i = 0; i < 5; i++) explored[`lab:x:${i}`] = true;
    for (let i = 0; i < 3; i++) explored[`fiche:${i}`] = true;
    const ids = newlyEarned({ ...base(), explored }).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["labs-5", "fiches-3", "night", "revisit"]));
    expect(ids).not.toContain("labs-15");
  });
  it("withEarnedBadges est idempotent et ne retire rien", () => {
    const d = { ...base(), challengesDone: 5, badges: { "streak-7": "2026-01-01T00:00:00Z" } };
    const once = withEarnedBadges(d, "2026-10-17T00:00:00Z");
    expect(Object.keys(once.badges)).toEqual(expect.arrayContaining(["streak-7", "first-challenge", "challenges-5"]));
    expect(withEarnedBadges(once)).toBe(once);
  });
});

describe("cosmétiques", () => {
  const ctx = (level: number, badges: Record<string, string> = {}) => ({ level, badges });
  it("déblocage par niveau et par succès", () => {
    const sigma = COSMETICS.find((c) => c.id === "g-sigma")!;
    expect(isUnlocked(sigma, ctx(3))).toBe(false);
    expect(isUnlocked(sigma, ctx(4))).toBe(true);
    const flame = COSMETICS.find((c) => c.id === "f-flame")!;
    expect(isUnlocked(flame, ctx(30))).toBe(false);
    expect(isUnlocked(flame, ctx(1, { "streak-7": "x" }))).toBe(true);
    expect(unlockedByBadge("streak-7").map((c) => c.id)).toContain("f-flame");
  });
  it("un cosmétique verrouillé équipé retombe sur le défaut", () => {
    expect(resolveSlot("glyph", { glyph: "g-inf" }, ctx(3)).id).toBe("g-initial");
    expect(resolveSlot("glyph", { glyph: "g-mu" }, ctx(3)).glyph).toBe("μ");
    expect(resolveSlot("theme", {}, ctx(1)).id).toBe("th-indigo");
  });
  it("le titre par défaut suit le niveau", () => {
    expect(rankTitle(1).name).toBe("Point de donnée");
    expect(rankTitle(5).name).toBe("Estimateur");
    expect(resolveSlot("title", {}, ctx(11)).name).toBe("Ensemble");
    expect(resolveSlot("title", { title: "t-chasseur" }, ctx(11, { "challenges-5": "x" })).name).toBe("Chasseur de seuils");
  });
  it("prochain déblocage", () => {
    expect(nextLevelUnlock(1)?.level).toBe(2);
    expect(nextLevelUnlock(16)?.level).toBe(18);
    expect(nextLevelUnlock(99)).toBeNull();
  });
});

describe("fusion entre appareils", () => {
  it("explorations : union ; cosmétiques : le changement le plus récent", () => {
    const a = { ...EMPTY_DATA, explored: { "lab:a": true as const }, cosmetics: { glyph: "g-mu", u: "2026-10-10T00:00:00Z" } };
    const b = { ...EMPTY_DATA, explored: { "fiche:b": true as const }, cosmetics: { glyph: "g-sigma", u: "2026-10-12T00:00:00Z" } };
    const m = mergeProgress(a, b);
    expect(Object.keys(m.explored).sort()).toEqual(["fiche:b", "lab:a"]);
    expect(m.cosmetics.glyph).toBe("g-sigma");
    expect(mergeProgress(b, a).cosmetics.glyph).toBe("g-sigma");
  });
});
