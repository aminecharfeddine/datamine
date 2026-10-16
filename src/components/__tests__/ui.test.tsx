// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ThresholdLab } from "@/components/viz/ThresholdLab";
import { Review } from "@/components/pages/Review";
import { Predict } from "@/components/pedago/Predict";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { useProgress } from "@/lib/store";

/** Les cartes d'une leçon ne sont dues qu'après quelques heures : on les rend dues pour tester la session. */
const makeAllDue = () =>
  act(() =>
    useProgress.setState((st) => ({
      srs: Object.fromEntries(Object.entries(st.srs).map(([k, c]) => [k, { ...c, due: new Date(Date.now() - 1000).toISOString() }])),
    })),
  );

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
    makeAllDue();
    render(<Review />);
    await act(async () => {});
    expect(screen.getByText(/3 restantes/)).toBeTruthy();
    const first = screen.queryByText("Afficher la réponse");
    if (first) {
      fireEvent.click(first);
      fireEvent.click(screen.getByText("Correct"));
    } else {
      // Carte à choix multiple : on choisit une option, puis on note.
      const option = screen.getAllByRole("button").find((b) => /Micro|0,67/.test(b.textContent ?? ""))!;
      fireEvent.click(option);
      fireEvent.click(screen.queryByText("Correct") ?? screen.getByText("À revoir"));
    }
    expect(useProgress.getState().reviewsDone).toBe(1);
    expect(screen.getByText(/restante/)).toBeTruthy();
  });
});

describe("Révisions : intervalles et notation", () => {
  it("une nouvelle carte : 10 min si ratée, 4 h si correcte, première révision 4 h après la leçon", async () => {
    const { previewDue, humanDelay, FIRST_REVIEW_DELAY_MS } = await import("@/lib/store");
    act(() => useProgress.getState().completeLesson("roc-et-pr", ["roc-auc"]));
    const stored = Object.values(useProgress.getState().srs)[0];
    const delay = new Date(stored.due).getTime() - Date.now();
    expect(Math.abs(delay - FIRST_REVIEW_DELAY_MS)).toBeLessThan(5000);
    const now = new Date(stored.due);
    const p = previewDue(stored, now);
    expect(humanDelay(p[1], now)).toBe("10 min");
    expect(humanDelay(p[3], now)).toBe("4 h");
    expect((+p[4] - +now) / 86_400_000).toBeGreaterThan(3);
  });

  it("QCM : bonne réponse → choix Difficile / Correct / Facile ; mauvaise → À revoir", async () => {
    act(() => useProgress.getState().completeLesson("roc-et-pr", ["pr-curve"]));
    makeAllDue();
    render(<Review />);
    await act(async () => {});
    // prc-1 : choix multiple (« Precision-Recall » est la bonne réponse)
    let guard = 0;
    while (!screen.queryByText("Precision-Recall") && guard++ < 5) {
      fireEvent.click(screen.getByText("Afficher la réponse"));
      fireEvent.click(screen.getByText("Correct"));
    }
    fireEvent.click(screen.getByText("Precision-Recall"));
    expect(screen.getByText("Difficile")).toBeTruthy();
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("Facile")).toBeTruthy();
    expect(screen.queryByText("À revoir")).toBeNull();
    cleanup();
    useProgress.getState().reset();
    act(() => useProgress.getState().completeLesson("roc-et-pr", ["pr-curve"]));
    makeAllDue();
    render(<Review />);
    await act(async () => {});
    guard = 0;
    while (!screen.queryByText("ROC") && guard++ < 5) {
      fireEvent.click(screen.getByText("Afficher la réponse"));
      fireEvent.click(screen.getByText("Correct"));
    }
    fireEvent.click(screen.getByText("ROC"));
    expect(screen.getByText("À revoir")).toBeTruthy();
    expect(screen.queryByText("Facile")).toBeNull();
  });
});
