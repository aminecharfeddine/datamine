// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { BayesLab } from "@/components/viz/BayesLab";
import { GradientLab } from "@/components/viz/GradientLab";
import { CltLab } from "@/components/viz/CltLab";
import { PolyFitLab } from "@/components/viz/PolyFitLab";
import { useProgress } from "@/lib/store";

const wrap = (ui: React.ReactNode) => render(<LessonProvider slug="t" concepts={[]}>{ui}</LessonProvider>);
const setSlider = (label: RegExp, v: number) =>
  fireEvent.change(screen.getByLabelText(label) as HTMLInputElement, { target: { value: String(v) } });

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
  vi.useFakeTimers();
});

describe("labos", () => {
  it("BayesLab : ~15 % au départ, défi ppv-90 validé avec specificity 0,999", async () => {
    wrap(<BayesLab id="b" controls={["sensitivity", "specificity"]} challenge="ppv-90" />);
    expect(screen.getByText("15,4 %")).toBeTruthy();
    setSlider(/Sensitivity/, 0.99);
    setSlider(/Specificity/, 0.999);
    await act(async () => vi.advanceTimersByTime(600));
    expect(useProgress.getState().challengesDone).toBe(1);
  });

  it("GradientLab : 10 pas animés avec un bon learning rate valident gd-converge", async () => {
    wrap(<GradientLab id="g" w0={-0.3} lr={0.05} controls={["lr"]} challenge="gd-converge" />);
    setSlider(/Learning rate/, 0.22);
    fireEvent.click(screen.getByText("10 pas ▸"));
    for (let i = 0; i < 12; i++) await act(async () => vi.advanceTimersByTime(120));
    expect(screen.getByText(/10 pas effectués/)).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(600));
    expect(useProgress.getState().challengesDone).toBe(1);
  });

  it("GradientLab : divergence détectée", async () => {
    wrap(<GradientLab id="d" w0={-0.3} lr={0.1} controls={["lr"]} challenge="gd-diverge" />);
    setSlider(/Learning rate/, 1.1);
    fireEvent.click(screen.getByText("10 pas ▸"));
    for (let i = 0; i < 12; i++) await act(async () => vi.advanceTimersByTime(120));
    expect(screen.getByText(/Divergence/)).toBeTruthy();
  });

  it("CltLab : tirer des moyennes et valider clt-sqrt", async () => {
    wrap(<CltLab id="c" dist="exponentielle" dists={["exponentielle"]} challenge="clt-sqrt" />);
    setSlider(/Taille de chaque échantillon/, 16);
    fireEvent.click(screen.getByText("+1 000"));
    expect(screen.getByText("1000 moyennes")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(600));
    expect(useProgress.getState().challengesDone).toBe(1);
  });

  it("PolyFitLab : un degré élevé valide bv-overfit, ensemble affichable", async () => {
    wrap(<PolyFitLab id="p" degree={1} ensemble={true} challenge="bv-overfit" />);
    setSlider(/Degré du polynôme/, 14);
    await act(async () => vi.advanceTimersByTime(600));
    expect(useProgress.getState().challengesDone).toBe(1);
    fireEvent.click(screen.getByLabelText(/Montrer 20 modèles/));
    expect(screen.getByText(/Trait épais/)).toBeTruthy();
  });
});
