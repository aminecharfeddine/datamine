// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { Exercise, parseAnswer, isClose } from "@/components/pedago/Exercise";
import { Interview } from "@/components/pedago/Interview";
import { useProgress } from "@/lib/store";

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
});

describe("parseAnswer", () => {
  it("formats acceptés", () => {
    expect(parseAnswer("0,8")).toBe(0.8);
    expect(parseAnswer(" 0.8 ")).toBe(0.8);
    expect(parseAnswer("1/3")).toBeCloseTo(1 / 3);
    expect(parseAnswer("15 %")).toBeCloseTo(0.15);
    expect(parseAnswer("15", true)).toBeCloseTo(0.15);
    expect(parseAnswer("0,15", true)).toBeCloseTo(0.15);
    expect(parseAnswer("abc")).toBeNull();
    expect(parseAnswer("1 200")).toBe(1200);
  });
  it("tolérance", () => {
    expect(isClose(0.154, 0.1538, 0.005)).toBe(true);
    expect(isClose(0.2, 0.1538, 0.005)).toBe(false);
  });
});

describe("Exercise", () => {
  const ui = () =>
    render(
      <LessonProvider slug="t" concepts={[]}>
        <Exercise id="e" question="Combien ?" answer={0.8} tolerance={0.01}>
          <p>Solution détaillée</p>
        </Exercise>
      </LessonProvider>,
    );
  it("mauvaise réponse puis bonne : XP une seule fois, correction affichée", () => {
    ui();
    const input = screen.getByLabelText("Ta réponse");
    fireEvent.change(input, { target: { value: "0,5" } });
    fireEvent.click(screen.getByText("Vérifier"));
    expect(screen.getByText("Pas encore")).toBeTruthy();
    expect(screen.queryByText("Solution détaillée")).toBeNull();
    fireEvent.change(input, { target: { value: "0,8" } });
    fireEvent.click(screen.getByText("Vérifier"));
    expect(screen.getByText("Exact")).toBeTruthy();
    expect(screen.getByText("Solution détaillée")).toBeTruthy();
    expect(useProgress.getState().xp).toBe(15);
  });
  it("correction accessible après deux essais ratés, sans XP", () => {
    ui();
    const input = screen.getByLabelText("Ta réponse");
    for (const v of ["1", "2"]) {
      fireEvent.change(input, { target: { value: v } });
      fireEvent.click(screen.getByText("Vérifier"));
    }
    fireEvent.click(screen.getByText("Voir la correction"));
    expect(screen.getByText("Solution détaillée")).toBeTruthy();
    expect(useProgress.getState().xp).toBe(0);
  });
});

describe("Interview", () => {
  it("révèle la réponse type au clic", () => {
    render(<Interview q="Question ?"><p>Réponse modèle</p></Interview>);
    expect(screen.queryByText("Réponse modèle")).toBeNull();
    fireEvent.click(screen.getByText(/Question \?/));
    expect(screen.getByText("Réponse modèle")).toBeTruthy();
  });
});
