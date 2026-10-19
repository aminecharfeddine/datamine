// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QuestionView } from "@/components/interview/QuestionView";
import { Interview } from "@/components/pages/Interview";
import { questionById, type BugQ, type CalcQ, type OralQ, type QcmQ } from "@/lib/interview";
import { useProgress } from "@/lib/store";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

beforeEach(() => {
  cleanup();
  useProgress.getState().reset();
});

const view = (id: string) => {
  const onDone = vi.fn();
  render(<QuestionView q={questionById(id)!} onDone={onDone} onNext={() => {}} nextLabel="Suivante" />);
  return onDone;
};

describe("questions d'entretien", () => {
  it("QCM : la bonne option donne 1 et affiche l'explication", () => {
    const q = questionById("eval-accuracy-fraude") as QcmQ;
    const onDone = view(q.id);
    fireEvent.click(screen.getByText(q.options[q.answer]));
    expect(onDone).toHaveBeenCalledWith(1);
    expect(screen.getByText("Bonne réponse")).toBeTruthy();
    expect(screen.getByText("Question piège")).toBeTruthy();
  });

  it("bug : cliquer une mauvaise ligne donne 0 et révèle la bonne", () => {
    const q = questionById("data-having") as BugQ;
    const onDone = view(q.id);
    const lines = screen.getAllByRole("button").filter((b) => b.textContent?.match(/^\d/));
    fireEvent.click(lines[0]);
    expect(onDone).toHaveBeenCalledWith(0);
    expect(screen.getByText(`Le problème est à la ligne ${q.line}.`)).toBeTruthy();
  });

  it("calcul : accepte la virgule", () => {
    const q = questionById("eval-f1-calc") as CalcQ;
    const onDone = view(q.id);
    fireEvent.change(screen.getByLabelText("Ta réponse"), { target: { value: "0,727" } });
    fireEvent.click(screen.getByText("Valider"));
    expect(onDone).toHaveBeenCalledWith(1);
  });

  it("oral : auto-évaluation sur les points attendus", () => {
    const q = questionById("fond-biais-variance") as OralQ;
    const onDone = view(q.id);
    fireEvent.click(screen.getByText("Voir les points attendus"));
    q.points.slice(0, 4).forEach((p) => fireEvent.click(screen.getByText(p)));
    fireEvent.click(screen.getByText(`Valider : 4 / ${q.points.length} points`));
    expect(onDone).toHaveBeenCalledWith(4 / q.points.length);
  });
});

describe("page Entretiens", () => {
  it("un entretien blanc enchaîne 10 questions et enregistre les résultats", () => {
    render(<Interview />);
    fireEvent.click(screen.getByText("Commencer l'entretien blanc"));
    expect(screen.getByText("Question 1 / 10")).toBeTruthy();
    fireEvent.click(screen.getByText("Quitter"));
    expect(screen.getByText("Entretiens")).toBeTruthy();
    expect(Object.keys(useProgress.getState().answers).filter((k) => k.startsWith("itv:"))).toHaveLength(0);
  });
});
