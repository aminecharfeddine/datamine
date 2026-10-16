// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { AbLab } from "@/components/viz/AbLab";
import { CiLab } from "@/components/viz/CiLab";
import { RidgeLab } from "@/components/viz/RidgeLab";
import { useProgress } from "@/lib/store";

const wrap = (ui: React.ReactNode) => render(<LessonProvider slug="t" concepts={[]}>{ui}</LessonProvider>);

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
  vi.useFakeTimers();
});

describe("nouveaux labos", () => {
  it("AbLab : lancer des expériences met à jour p-value et compteur", () => {
    wrap(<AbLab id="a" n={1000} effect={0} />);
    fireEvent.click(screen.getByText("Lancer une expérience"));
    expect(screen.getByText(/significatif au seuil de 5 %/i)).toBeTruthy();
    fireEvent.click(screen.getByText("+20"));
    expect(screen.getByText(/\/ 21/)).toBeTruthy();
  });

  it("AbLab : défi de puissance validé avec 6 000 visiteurs", async () => {
    wrap(<AbLab id="p" n={500} effect={0.02} controls={["n"]} challenge="pv-power" />);
    fireEvent.change(screen.getByLabelText(/Visiteurs par version/), { target: { value: "6000" } });
    fireEvent.click(screen.getByText("+20"));
    fireEvent.click(screen.getByText("+20"));
    await act(async () => vi.advanceTimersByTime(600));
    expect(useProgress.getState().challengesDone).toBe(1);
  });

  it("CiLab : 100 sondages valident ci-coverage", async () => {
    wrap(<CiLab id="c" challenge="ci-coverage" />);
    fireEvent.click(screen.getByText("+100 sondages"));
    expect(screen.getByText(/sur 100/)).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(600));
    expect(useProgress.getState().challengesDone).toBe(1);
  });

  it("RidgeLab : pousser λ au maximum valide ridge-under", async () => {
    wrap(<RidgeLab id="r" logLambda={-2} challenge="ridge-under" />);
    fireEvent.change(screen.getByLabelText(/Force de régularisation/), { target: { value: "2" } });
    await act(async () => vi.advanceTimersByTime(600));
    expect(useProgress.getState().challengesDone).toBe(1);
  });
});
