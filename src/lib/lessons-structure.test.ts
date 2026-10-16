import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_LESSONS } from "./curriculum";
import { CHALLENGES } from "./challenges";
import { cardsForConcepts } from "./cards";
import { FICHE_CONTENT } from "./fiches";

// Grille de complétude : chaque leçon publiée doit contenir tous les blocs pédagogiques.
const dir = path.resolve(__dirname, "../content/lessons");
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe.each(ALL_LESSONS.filter((l) => l.available))("leçon $slug", (lesson) => {
  const src = fs.readFileSync(path.join(dir, `${lesson.slug}.mdx`), "utf8");

  it("commence par une prédiction", () => expect(src.trimStart().startsWith("<Predict")).toBe(true));
  it("au moins un labo interactif ou une illustration", () => expect(count(src, /<[A-Z]\w*Lab\b|<NormBalls|<LearningCurves/g)).toBeGreaterThanOrEqual(1));
  it("au moins un défi, et tous les défis existent", () => {
    const ids = [...src.matchAll(/challenge="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(1);
    ids.forEach((id) => expect(CHALLENGES[id], id).toBeDefined());
  });
  it("au moins un exercice de calcul", () => expect(count(src, /<Exercise\b/g)).toBeGreaterThanOrEqual(1));
  it("un quiz d'au moins 4 questions", () => {
    expect(count(src, /<Quiz\b/g)).toBe(1);
    expect(count(src, /^\s+q: "/gm)).toBeGreaterThanOrEqual(4);
  });
  it("au moins deux questions d'entretien", () => expect(count(src, /<Interview\b/g)).toBeGreaterThanOrEqual(2));
  it("un encadré « À retenir » et la fin de leçon", () => {
    expect(count(src, /<Recap>/g)).toBe(1);
    expect(src.trimEnd().endsWith("<LessonComplete />")).toBe(true);
  });
  it("au moins trois types d'encadrés", () => {
    const types = new Set([...src.matchAll(/<Callout type="(\w+)"/g)].map((m) => m[1]));
    expect(types.size).toBeGreaterThanOrEqual(3);
  });
  it("au moins une formule", () => expect(count(src, /\$\$/g)).toBeGreaterThanOrEqual(2));
  it("des cartes de révision pour chaque concept", () => {
    lesson.concepts.forEach((c) => expect(cardsForConcepts([c]).length, c).toBeGreaterThanOrEqual(2));
  });
  it("pas de tiret cadratin", () => expect(src.includes("—")).toBe(false));

  it("une fiche récap complète", () => {
    const fichePath = path.resolve(__dirname, "../content/fiches", `${lesson.slug}.mdx`);
    expect(fs.existsSync(fichePath), "fiche manquante").toBe(true);
    const fiche = fs.readFileSync(fichePath, "utf8");
    for (const kind of ["essentiel", "formules", "pieges", "entretien"]) expect(fiche, kind).toContain(`kind="${kind}"`);
    expect(fiche.includes("—")).toBe(false);
    expect(FICHE_CONTENT[lesson.slug]).toBeDefined();
  });
});
