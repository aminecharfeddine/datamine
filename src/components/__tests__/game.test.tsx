// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { BayesLab } from "@/components/viz/BayesLab";
import { Exercise } from "@/components/pedago/Exercise";
import { Quiz } from "@/components/pedago/Quiz";
import { Profile } from "@/components/pages/Profile";
import { ThemeApplier } from "@/components/game/ThemeApplier";
import { Celebrations } from "@/components/game/Celebrations";
import { useProgress } from "@/lib/store";
import { xpForLevel } from "@/lib/gamification";

vi.mock("next/link", () => ({ default: (p: any) => <a {...p} /> }));
const wrap = (ui: React.ReactNode) => render(<LessonProvider slug="t" concepts={[]}>{ui}</LessonProvider>);

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

describe("niveaux et déblocages", () => {
  it("passer un niveau affiche ce qui est débloqué et lance une célébration", () => {
    act(() => {
      useProgress.setState({ xp: xpForLevel(4) - 5 });
      useProgress.getState().award(null, 10, "test");
    });
    const t = useProgress.getState().toasts.find((x) => x.tone === "level")!;
    expect(t.text).toBe("Niveau 4 atteint");
    expect(t.detail).toMatch(/Sigma/);
    expect(t.detail).toMatch(/Estimateur/);
    expect(useProgress.getState().celebrations.length).toBeGreaterThan(0);
  });
  it("un succès avec récompense l'annonce", () => {
    act(() => {
      useProgress.setState({ challengesDone: 4, awarded: {} });
      useProgress.getState().recordChallenge("t:challenge:lab:x");
    });
    const t = useProgress.getState().toasts.find((x) => x.text === "Succès débloqué · Chasseur de seuils")!;
    expect(t.detail).toMatch(/Chasseur de seuils/);
  });
});

describe("instrumentation", () => {
  it("manipuler un labo le compte comme exploré", () => {
    wrap(<BayesLab id="b1" controls={["prevalence"]} />);
    fireEvent.change(screen.getByLabelText(/Prévalence/), { target: { value: "0.05" } });
    expect(useProgress.getState().explored["lab:t:b1"]).toBe(true);
  });
  it("exercice du premier coup, et persévérance après deux erreurs", () => {
    const ui = (id: string) => wrap(<Exercise id={id} question="?" answer={2} tolerance={0}><p>C</p></Exercise>);
    ui("a");
    fireEvent.change(screen.getByLabelText("Ta réponse"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("Vérifier"));
    expect(useProgress.getState().explored["ex-first:t:exercise:a"]).toBe(true);
    cleanup();
    ui("b");
    for (const v of ["1", "3", "2"]) {
      fireEvent.change(screen.getByLabelText("Ta réponse"), { target: { value: v } });
      fireEvent.click(screen.getByText("Vérifier"));
    }
    expect(useProgress.getState().explored["ex-persist:t:exercise:b"]).toBe(true);
    expect(useProgress.getState().explored["ex-first:t:exercise:b"]).toBeUndefined();
  });
  it("quiz parfait", () => {
    wrap(<Quiz id="q" questions={[{ q: "?", options: ["oui", "non"], answer: 0, explain: "." }]} />);
    fireEvent.click(screen.getByText("oui"));
    fireEvent.click(screen.getByText("Voir mon score"));
    expect(useProgress.getState().explored["quiz-perfect:t:quizscore:q"]).toBe(true);
  });
});

describe("profil et atelier", () => {
  it("les quatre onglets s'affichent", async () => {
    render(<Profile />);
    await act(async () => {});
    expect(screen.getByText("Objectif de la semaine")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Succès" }));
    expect(screen.getAllByText("???").length).toBe(3);
    fireEvent.click(screen.getByText("Premier pas"));
    expect(screen.getByText("Terminer une leçon.")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Atlas" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Vestiaire" }));
    fireEvent.click(screen.getByRole("tab", { name: /Titre/ }));
    expect(screen.getByText("Rang automatique")).toBeTruthy();
  });
  it("équiper un thème débloqué change l'accent du site ; un thème verrouillé ne s'équipe pas", async () => {
    act(() => useProgress.setState({ xp: xpForLevel(3) }));
    render(
      <>
        <ThemeApplier />
        <Profile />
      </>,
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole("tab", { name: "Vestiaire" }));
    fireEvent.click(screen.getByRole("tab", { name: /Thème/ }));
    fireEvent.click(screen.getByText("Prune"));
    expect(useProgress.getState().cosmetics.theme).toBeUndefined();
    expect(screen.getByText(/Aperçu · Niveau 9/)).toBeTruthy();
    fireEvent.click(screen.getByText("Émeraude"));
    expect(useProgress.getState().cosmetics.theme).toBe("th-emeraude");
    await act(async () => {});
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#047857");
  });
  it("équiper une célébration la joue", async () => {
    act(() => useProgress.setState({ xp: xpForLevel(5) }));
    const { container } = render(
      <>
        <Celebrations />
        <Profile />
      </>,
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole("tab", { name: "Vestiaire" }));
    fireEvent.click(screen.getByRole("tab", { name: /Célébration/ }));
    fireEvent.click(screen.getByText("Confettis"));
    expect(useProgress.getState().celebrations.at(-1)?.effect).toBe("e-confetti");
    expect(container.querySelector(".pointer-events-none.fixed")).toBeTruthy();
  });
});
