// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { Predict } from "@/components/pedago/Predict";
import { Quiz } from "@/components/pedago/Quiz";
import { Exercise } from "@/components/pedago/Exercise";
import { Review } from "@/components/pages/Review";
import { useProgress } from "@/lib/store";

vi.mock("next/link", () => ({ default: (p: any) => <a {...p} /> }));
const wrap = (ui: React.ReactNode) => render(<LessonProvider slug="t" concepts={[]}>{ui}</LessonProvider>);

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
});

describe("le site se souvient des réponses", () => {
  it("prédiction : la réponse et l'explication réapparaissent au retour", async () => {
    const ui = () => wrap(<Predict id="p" question="Q ?" options={["A", "B"]} answer={1}><p>Explication</p></Predict>);
    ui();
    fireEvent.click(screen.getByText("A"));
    cleanup();
    ui();
    await act(async () => {});
    expect(screen.getByText("Explication")).toBeTruthy();
    expect(useProgress.getState().xp).toBe(3); // pas de nouvel XP
  });

  it("quiz : le meilleur score est réaffiché", async () => {
    const qs = [{ q: "1+1 ?", options: ["2", "3"], answer: 0, explain: "." }];
    const ui = () => wrap(<Quiz id="q" questions={qs} />);
    ui();
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("Voir mon score"));
    cleanup();
    ui();
    await act(async () => {});
    expect(screen.getByText(/1\/1/)).toBeTruthy();
    expect(screen.getByText("Recommencer le quiz")).toBeTruthy();
  });

  it("exercice : déjà réussi au retour, avec la correction", async () => {
    const ui = () => wrap(<Exercise id="e" question="?" answer={0.6} tolerance={0.01}><p>Correction détaillée</p></Exercise>);
    ui();
    fireEvent.change(screen.getByLabelText("Ta réponse"), { target: { value: "0,6" } });
    fireEvent.click(screen.getByText("Vérifier"));
    cleanup();
    ui();
    await act(async () => {});
    expect(screen.getByText("Correction détaillée")).toBeTruthy();
    expect((screen.getByLabelText("Ta réponse") as HTMLInputElement).value).toBe("0,6");
  });
});

describe("deck et remise en révision", () => {
  it("rien à réviser : le deck est visible et « Réviser maintenant » remet la carte dans la session", async () => {
    act(() => useProgress.getState().completeLesson("bayes", ["proba"]));
    render(<Review />);
    await act(async () => {});
    expect(screen.getByText("Rien à réviser")).toBeTruthy();
    expect(screen.getByText("Ton deck")).toBeTruthy();
    const buttons = screen.getAllByText("Réviser maintenant");
    expect(buttons.length).toBe(4);
    fireEvent.click(buttons[0]);
    expect(screen.queryByText("Rien à réviser")).toBeNull();
    expect(screen.getByText(/1 restante/)).toBeTruthy();
    fireEvent.click(screen.getByText("Ton deck"));
    expect(screen.getByText("dans la session")).toBeTruthy();
  });

  it("l'historique liste les révisions effectuées", async () => {
    act(() => useProgress.getState().completeLesson("bayes", ["proba"]));
    const id = Object.keys(useProgress.getState().srs)[0];
    act(() => useProgress.getState().review(id, 3));
    render(<Review />);
    await act(async () => {});
    fireEvent.click(screen.getByText(/Voir l'historique des révisions \(1\)/));
    expect(screen.getAllByText("Correct").length).toBeGreaterThan(0);
  });
});
