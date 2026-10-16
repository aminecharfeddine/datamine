// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { FicheGate } from "@/components/fiche/FicheGate";
import { useProgress } from "@/lib/store";

vi.mock("next/link", () => ({ default: (p: any) => <a {...p} /> }));

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
});

describe("fiches récap", () => {
  const ui = () =>
    render(
      <FicheGate slug="bayes" title="Bayes">
        <p>Contenu de la fiche</p>
      </FicheGate>,
    );

  it("verrouillée tant que la leçon n'est pas terminée", async () => {
    ui();
    await act(async () => {});
    expect(screen.getByText("Fiche verrouillée")).toBeTruthy();
    expect(screen.queryByText("Contenu de la fiche")).toBeNull();
  });

  it("débloquée après la leçon, avec un toast et le bouton PDF", async () => {
    act(() => useProgress.getState().completeLesson("bayes", ["proba"]));
    expect(useProgress.getState().toasts.some((t) => t.text === "Fiche récap débloquée")).toBe(true);
    ui();
    await act(async () => {});
    expect(screen.getByText("Contenu de la fiche")).toBeTruthy();
    const print = vi.fn();
    window.print = print;
    screen.getByText("Télécharger en PDF").click();
    expect(print).toHaveBeenCalled();
  });
});
