// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ThresholdLab } from "@/components/viz/ThresholdLab";
import { Review } from "@/components/pages/Review";
import { Predict } from "@/components/pedago/Predict";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { useProgress } from "@/lib/store";

vi.mock("next/link", () => ({ default: (p: any) => <a {...p} /> }));

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
});

describe("ThresholdLab", () => {
  it("valide le défi quand le seuil atteint l'objectif", async () => {
    vi.useFakeTimers();
    render(
      <LessonProvider slug="test" concepts={[]}>
        <ThresholdLab id="t" panels={["dist", "matrix", "metrics", "roc", "pr"]} separation={2} prevalence={0.4} threshold={0.5} challenge="recall-90" />
      </LessonProvider>,
    );
    expect(screen.getByText("+25 XP")).toBeTruthy();
    const slider = screen.getByLabelText(/Seuil de décision/) as HTMLInputElement;
    // cherche un seuil qui satisfait le défi
    let ok = false;
    for (let t = 0.3; t <= 0.5 && !ok; t += 0.01) {
      fireEvent.change(slider, { target: { value: t.toFixed(2) } });
      ok = !!screen.queryByText("Réussi !");
    }
    expect(ok).toBe(true);
    await act(async () => vi.advanceTimersByTime(600));
    expect(useProgress.getState().xp).toBe(25);
    expect(useProgress.getState().challengesDone).toBe(1);
    vi.useRealTimers();
  });
});

describe("Predict", () => {
  it("révèle l'explication et donne de l'XP une seule fois", () => {
    render(
      <LessonProvider slug="test" concepts={["f1"]}>
        <Predict id="p" question="Q ?" options={["A", "B"]} answer={1}>
          <p>Explication</p>
        </Predict>
      </LessonProvider>,
    );
    expect(screen.queryByText("Explication")).toBeNull();
    fireEvent.click(screen.getByText("B"));
    expect(screen.getByText("Explication")).toBeTruthy();
    expect(useProgress.getState().xp).toBe(10);
    expect(useProgress.getState().discovered.f1).toBe(true);
  });
});

describe("Review", () => {
  it("affiche les cartes ajoutées par une leçon et les note", async () => {
    act(() => useProgress.getState().completeLesson("matrice-de-confusion", ["f1"]));
    render(<Review />);
    await act(async () => {});
    expect(screen.getByText(/2 restantes/)).toBeTruthy();
    const first = screen.queryByText("Afficher la réponse");
    if (first) {
      fireEvent.click(first);
      fireEvent.click(screen.getByText("Correct"));
    } else {
      fireEvent.click(screen.getByText("0,67"));
      fireEvent.click(screen.getByText("Continuer"));
    }
    expect(useProgress.getState().reviewsDone).toBe(1);
    expect(screen.getByText(/1 restante/)).toBeTruthy();
  });
});
