// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { CvLab } from "@/components/viz/CvLab";
import { LeakLab } from "@/components/viz/LeakLab";
import { KnnLab } from "@/components/viz/KnnLab";
import { TreeLab } from "@/components/viz/TreeLab";
import { useProgress } from "@/lib/store";

const wrap = (ui: React.ReactNode) => render(<LessonProvider slug="t" concepts={[]}>{ui}</LessonProvider>);
const flush = () => act(async () => vi.advanceTimersByTime(600));

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
  vi.useFakeTimers();
});

describe("labos modèles", () => {
  it("CvLab : régler le degré au minimum de la CV valide le défi", async () => {
    wrap(<CvLab id="c" degree={10} challenge="cv-select" />);
    for (let d = 0; d <= 12 && useProgress.getState().challengesDone === 0; d++) {
      fireEvent.change(screen.getByLabelText(/Degré du polynôme/), { target: { value: String(d) } });
      await flush();
    }
    expect(useProgress.getState().challengesDone).toBe(1);
  });

  it("LeakLab : les deux modes donnent l'illusion puis la vérité", async () => {
    wrap(<LeakLab id="l" challenge="leak-illusion" />);
    fireEvent.click(screen.getByText("Lancer la validation croisée"));
    expect(screen.getByText(/trop beau pour être vrai/)).toBeTruthy();
    fireEvent.click(screen.getByText("Dans chaque pli, sur le train seulement"));
    fireEvent.click(screen.getByText("Lancer la validation croisée"));
    expect(screen.getByText(/la vérité/)).toBeTruthy();
    await flush();
    expect(useProgress.getState().challengesDone).toBe(1);
  });

  it("KnnLab : activer l'échelle piégée valide knn-scale", async () => {
    wrap(<KnnLab id="k" k={15} allowScale={true} challenge="knn-scale" />);
    fireEvent.click(screen.getByLabelText(/centimètres/));
    await flush();
    expect(useProgress.getState().challengesDone).toBe(1);
  });

  it("TreeLab : profondeur 12 mémorise l'entraînement", async () => {
    wrap(<TreeLab id="t" depth={1} challenge="tree-memorize" />);
    fireEvent.change(screen.getByLabelText(/Profondeur maximale/), { target: { value: "12" } });
    expect(screen.getAllByText("100,0 %").length).toBeGreaterThan(0);
    await flush();
    expect(useProgress.getState().challengesDone).toBe(1);
  });
});
